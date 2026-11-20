/*
 * ENCS4380 Micromouse M1 - Algorithm Lead solution
 */
#include "mouse_hal.h"
#include <stdint.h>
#include <stdio.h>   
#include <string.h>

#define MAX_CELLS (MM_MAX_SIZE * MM_MAX_SIZE)
#define INF UINT16_MAX
#define MAX_STEPS (MAX_CELLS * 128)

static const int8_t dx[4] = { 0, 1, 0, -1 };
static const int8_t dy[4] = { 1, 0, -1, 0 };

typedef struct {
    uint8_t walls;     /* Observed wall bits */
    uint8_t known;     /* Which edges have actually been observed */
    uint8_t visited;   /* The robot has sensed at this cell */
    uint16_t distance; /* Flood-fill distance */
} Cell;

static Cell map[MAX_CELLS];
static uint16_t queue[MAX_CELLS];
static uint16_t drawn[MAX_CELLS];
static mm_maze_t maze;
static int px, py, heading;
static int visited_count;
static int blocked_attempts;

static int inside(int x, int y)
{
    return x >= 0 && y >= 0 && x < maze.width && y < maze.height;
}

static int index_of(int x, int y) { return y * maze.width + x; }

static int is_goal(int x, int y)
{
    return x >= maze.goal_x0 && x <= maze.goal_x1 &&
           y >= maze.goal_y0 && y <= maze.goal_y1;
}

/* Always update BOTH ends of an edge; show newly found walls in mms. */
static void update_edge(int x, int y, int dir, int wall)
{
    int nx = x + dx[dir], ny = y + dy[dir];
    uint8_t here = MM_WALL(dir);
    Cell *a = &map[index_of(x,y)];
    int was_wall = (a->known & here) && (a->walls & here);
    if (!inside(nx,ny)) wall = 1; /* Outside perimeter is solid. */

    a->known |= here;
    if (wall) a->walls |= here;
    else      a->walls &= (uint8_t)~here;

    if (inside(nx,ny)) {
        uint8_t other = MM_WALL((dir + 2) & 3);
        Cell *b = &map[index_of(nx,ny)];
        b->known |= other;
        if (wall) b->walls |= other;
        else      b->walls &= (uint8_t)~other;
    }
    if (wall && !was_wall) mm_show_wall(x,y,dir);
}

/* A known wall is impassable. Exploration may assume UNKNOWN is open. */
static int passable(int x, int y, int dir, int allow_unknown)
{
    int nx = x + dx[dir], ny = y + dy[dir];
    uint8_t b = MM_WALL(dir);
    if (!inside(nx,ny)) return 0;
    if (map[index_of(x,y)].walls & b) return 0;
    return allow_unknown || !!(map[index_of(x,y)].known & b);
}

/* BFS from all goal cells, start, or all unvisited cells. */
/* kind: 0=goal, 1=start, 2=unvisited. */
static int flood(int kind, int allow_unknown, int show)
{
    int head=0, tail=0;
    for (int y=0; y<maze.height; y++) {
        for (int x=0; x<maze.width; x++) {
            int i = index_of(x,y);
            int seed = (kind == 0) ? is_goal(x,y) :
                       (kind == 1) ? (x == 0 && y == 0) : !map[i].visited;
            map[i].distance = seed ? 0 : INF;
            if (seed) queue[tail++] = (uint16_t)i;
        }
    }
    if (!tail) return 0;
    while (head < tail) {
        int i = queue[head++];
        int x = i % maze.width, y = i / maze.width;
        for (int d=0; d<4; d++) {
            if (!passable(x,y,d,allow_unknown)) continue;
            int ni = index_of(x+dx[d],y+dy[d]);
            if (map[ni].distance != INF) continue;
            map[ni].distance = (uint16_t)(map[i].distance+1);
            queue[tail++] = (uint16_t)ni; /* every cell enqueued at most once */
        }
    }
    if (show) {
        for (int y=0; y<maze.height; y++) for (int x=0; x<maze.width; x++) {
            int i=index_of(x,y);
            uint16_t n=map[i].distance;
            if (drawn[i] == n) continue; /* don't flood mms with redundant commands */
            drawn[i]=n;
            if (n == INF) mm_label(x,y,"-");
            else {
                char label[11];
                snprintf(label, sizeof label, "%u", (unsigned)n);
                mm_label(x,y,label);
            }
        }
    }
    return 1;
}

/* Read left/front/right in ROBOT coordinates, translate into N/E/S/W. */
/* Three reads reject a single transient incorrect sample. */
static void sense_cell(void)
{
    int left=0, front=0, right=0;
    for (int sample=0; sample<3; sample++) {
        uint8_t s=mm_sense();
        left  += !!(s & MM_SEE_LEFT);
        front += !!(s & MM_SEE_FRONT);
        right += !!(s & MM_SEE_RIGHT);
    }
    update_edge(px,py,(heading+3)&3,left>=2);
    update_edge(px,py,heading,front>=2);
    update_edge(px,py,(heading+1)&3,right>=2);
    if (!map[index_of(px,py)].visited) {
        map[index_of(px,py)].visited=1;
        visited_count++;
    }
}

/* Choose a neighboring cell with distance one less, preferring fewer turns. */
static int next_direction(int allow_unknown)
{
    int here=map[index_of(px,py)].distance;
    int best=-1, score=-1000000;
    if (here == 0 || here == INF) return -1;
    for (int d=0; d<4; d++) {
        if (!passable(px,py,d,allow_unknown)) continue;
        Cell *n=&map[index_of(px+dx[d],py+dy[d])];
        if (n->distance >= here) continue;
        int diff=(d-heading+4)&3;
        int turn_cost=(diff==0 ? 0 : diff==2 ? 2 : 1);
        int candidate=(n->visited ? 0 : 10) - turn_cost;
        if (candidate > score) { score=candidate; best=d; }
    }
    return best;
}

/* A reset changes robot pose only; the learned map survives. */
static int reset_if_requested(void)
{
    if (!mm_reset_requested()) return 0;
    px=0; py=0; heading=MM_NORTH;
    mm_reset_done();
    mm_log("reset acknowledged: position restored to (0,0) north, map retained");
    return 1;
}

/* Returns 1 if moved, 0 if blocked, -1 on serious HAL fault. */
static int step_one(int dir)
{
    int q=(dir-heading+4)&3;
    int turn=(q==3) ? -1 : q;
    if (turn) {
        mm_status_t status=mm_turn(turn);
        if (status != MM_OK) { mm_log("HAL turn failed: %d", (int)status); return -1; }
    }
    heading=dir;
    mm_status_t result=mm_forward(1);
    if (result == MM_OK) {
        update_edge(px,py,dir,0); /* Successful crossing proves edge is open. */
        px+=dx[dir]; py+=dy[dir];
        return 1;
    }
    if (result == MM_BLOCKED) {
        update_edge(px,py,dir,1); /* Failed move proves a wall, not new position. */
        blocked_attempts++;
        mm_log("unexpected wall at (%d,%d), dir=%d; recalculating",px,py,dir);
        return 0;
    }
    mm_log("HAL motion fault: %d", (int)result);
    return -1;
}

/* Official map dump: masks use MM_WALL(), and UNKNOWN edges remain unknown. */
static void dump_map(void)
{
    mm_map_begin();
    for (int y=0; y<maze.height; y++) for (int x=0; x<maze.width; x++) {
        Cell *c=&map[index_of(x,y)];
        mm_map_cell(x,y,c->walls,c->known);
    }
    mm_map_end();
}

static void init_map(void)
{
    memset(map,0,sizeof map);
    visited_count=0; blocked_attempts=0;
    px=py=0; heading=MM_NORTH;
    for (int i=0; i<MAX_CELLS; i++) drawn[i]=(uint16_t)(INF-1);
    for (int y=0; y<maze.height; y++) for (int x=0; x<maze.width; x++) {
        if (x==0) update_edge(x,y,MM_WEST,1);
        if (x==maze.width-1) update_edge(x,y,MM_EAST,1);
        if (y==0) update_edge(x,y,MM_SOUTH,1);
        if (y==maze.height-1) update_edge(x,y,MM_NORTH,1);
    }
    mm_mark(0,0,MM_COLOR_BLUE);
    for (int y=maze.goal_y0; y<=maze.goal_y1; y++)
        for (int x=maze.goal_x0; x<=maze.goal_x1; x++)
            mm_mark(x,y,MM_COLOR_GREEN);
}

void solver_run(void)
{
    mm_begin(TEAM_ID);
    maze=mm_maze();
    if (maze.width<1 || maze.height<1 || maze.width>MM_MAX_SIZE ||
        maze.height>MM_MAX_SIZE || !inside(maze.goal_x0,maze.goal_y0) ||
        !inside(maze.goal_x1,maze.goal_y1)) {
        mm_log("invalid maze size or goal");
        return;
    }
    init_map();
    mm_log("M1 phase 1: discover walls and reach the goal");
    int ok=0, steps=0;
    while (steps++ < MAX_STEPS) {
        if (reset_if_requested()) continue;
        sense_cell();
        flood(0,1,1);
        if (is_goal(px,py)) { ok=1; break; }
        int d=next_direction(1);
        if (d<0 || step_one(d)<0) { mm_log("could not reach goal"); dump_map(); return; }
    }
    if (!ok) { mm_log("goal not reached (step limit)"); dump_map(); return; }
    mm_log("GOAL REACHED at (%d,%d) after %d decisions",px,py,steps);

    /* Map remaining reachable cells, then race on verified open edges only. */
    mm_log("M1 phase 2: map exploration");
    steps=0;
    while (visited_count < maze.width*maze.height && steps++ < MAX_STEPS) {
        if (reset_if_requested()) continue;
        sense_cell();
        if (visited_count == maze.width*maze.height) break;
        flood(0,1,1); /* keep goal numbers visible */
        flood(2,0,0); /* nearest unvisited cell via KNOWN-open edges */
        int d=next_direction(0);
        if (d<0) {
            mm_log("no reachable unsensed cell remains (%d/%d visited)",
                   visited_count,maze.width*maze.height);
            break; /* isolated areas cannot be measured from robot */
        }
        if (step_one(d)<0) { dump_map(); return; }
    }
    mm_log("mapped %d/%d cells", visited_count,maze.width*maze.height);

    mm_log("M1 phase 3: return to start");
    steps=0;
    while ((px!=0 || py!=0) && steps++ < MAX_STEPS) {
        if (reset_if_requested()) continue;
        sense_cell();
        flood(1,0,1);
        int d=next_direction(0);
        if (d<0 || step_one(d)<0) { mm_log("cannot return home");dump_map();return; }
    }
    if (px!=0 || py!=0) { mm_log("home not reached");dump_map();return; }
    mm_log("HOME REACHED");
    mm_mark(0,0,MM_COLOR_BLUE);

    mm_log("M1 phase 4: shortest-known-path speed run");
    steps=0;
    while (!is_goal(px,py) && steps++ < MAX_STEPS) {
        if (reset_if_requested()) continue;
        sense_cell();
        flood(0,0,1); /* verified-open passages ONLY */
        int d=next_direction(0);
        if (d<0 || step_one(d)<0) { mm_log("cannot finish speed run");dump_map();return; }
    }
    if (!is_goal(px,py)) { mm_log("speed run not finished");dump_map();return; }
    flood(0,0,1);
    mm_log("RACE COMPLETE at (%d,%d), blocked_attempts=%d", px,py,blocked_attempts);
    dump_map();
}
