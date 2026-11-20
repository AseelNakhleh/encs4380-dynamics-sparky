#!/usr/bin/env python3
"""Protocol-level OFFLINE test harness for the professor's unmodified hal_sim.c.

This is NOT the official mms GUI. It serves the documented mms mouse protocol
via solver.exe stdin/stdout, captures map dumps and validates shortest race.
Run: python tests/mock_mms.py [--quick]
"""
import argparse
import collections
import os
import pathlib
import random
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DX = (0, 1, 0, -1)
DY = (1, 0, -1, 0)
BITS = (1, 2, 4, 8)  # local generator only; official solver uses MM_WALL


def generate(w, h, seed, extra=0.22):
    rng = random.Random(seed)
    a = [[15 for _ in range(w)] for _ in range(h)]
    seen = {(0, 0)}
    stack = [(0, 0)]
    while stack:
        x, y = stack[-1]
        options = []
        for d in range(4):
            nx, ny = x+DX[d], y+DY[d]
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                options.append((d, nx, ny))
        if not options:
            stack.pop()
            continue
        d, nx, ny = rng.choice(options)
        a[y][x] &= ~BITS[d]
        a[ny][nx] &= ~BITS[(d+2)&3]
        seen.add((nx, ny))
        stack.append((nx, ny))
    for y in range(h):
        for x in range(w):
            for d in (0, 1):
                nx, ny = x+DX[d], y+DY[d]
                if 0 <= nx < w and 0 <= ny < h and rng.random() < extra:
                    a[y][x] &= ~BITS[d]
                    a[ny][nx] &= ~BITS[(d+2)&3]
    return a


def read_local(path):
    lines=pathlib.Path(path).read_text(encoding='utf8').split()
    w,h=map(int,lines[:2])
    vals=list(map(int,lines[2:]))
    assert len(vals)==w*h
    return [vals[(h-1-y)*w:(h-y)*w] for y in range(h)]


def truth(a, x, y, d):
    return bool(a[y][x] & BITS[d])


def shortest(a, goal):
    h=len(a);w=len(a[0]); queue=collections.deque([(0,0,0)]);seen={(0,0)}
    while queue:
        x,y,dist=queue.popleft()
        if goal(x,y):return dist
        for d in range(4):
            nx,ny=x+DX[d],y+DY[d]
            if 0<=nx<w and 0<=ny<h and not truth(a,x,y,d) and (nx,ny) not in seen:
                queue.append((nx,ny,dist+1)); seen.add((nx,ny))
    return None


def crc16(s, crc=0xffff):
    for byte in s.encode('ascii'):
        crc ^= byte<<8
        for _ in range(8):
            crc=((crc<<1)^0x1021)&0xffff if crc&0x8000 else (crc<<1)&0xffff
    return crc


def run_case(binary,a,goal_tuple,title,one_bad=False,missed=False):
    h=len(a);w=len(a[0]); x=y=heading=0
    motion=0; blocked=0; labels={}; wall_displays=set(); coords=[]
    first_goal=False; race_start=None; at_home=False; out_lines=[]
    gx0,gy0,gx1,gy1=goal_tuple
    def goal(x,y):return gx0<=x<=gx1 and gy0<=y<=gy1
    env=os.environ.copy()
    env['MM_GOAL']=f'{gx0},{gy0},{gx1},{gy1}'
    env['PYTHONUNBUFFERED']='1'
    proc=subprocess.Popen([str(binary)],cwd=ROOT,env=env,bufsize=1, text=True,
                          stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    # The official HAL writes debug/map to stderr (up to around 30 KB for 16x16).
    sensors=0; commands=0
    while True:
        line=proc.stdout.readline()
        if not line:break
        cmd=line.strip()
        if not cmd:continue
        commands += 1
        if commands>2000000:
            proc.kill();raise AssertionError(f'{title}: too many commands')
        args=cmd.split();command=args[0]
        reply=None
        if command=='mazeWidth':reply=str(w)
        elif command=='mazeHeight':reply=str(h)
        elif command=='wasReset':reply='false'
        elif command=='wallLeft' or command=='wallFront' or command=='wallRight':
            d=(heading+{'wallLeft':3,'wallFront':0,'wallRight':1}[command])&3
            val=truth(a,x,y,d)
            sensors+=1
            if one_bad and sensors==2 and command=='wallFront':val=not val
            if missed and x==0 and y==0 and command=='wallFront' and sensors<=9:val=False
            reply='true' if val else 'false'
        elif command=='turnRight':heading=(heading+1)&3;reply='ack'
        elif command=='turnLeft':heading=(heading+3)&3;reply='ack'
        elif command=='moveForward':
            cells=int(args[1]) if len(args)>1 else 1
            legal=True
            for _ in range(cells):
                if truth(a,x,y,heading): legal=False;blocked+=1;break
                x+=DX[heading];y+=DY[heading];motion+=1
                assert 0<=x<w and 0<=y<h, (title,'escaped maze')
                coords.append((x,y))
                if goal(x,y):first_goal=True
            reply='ack' if legal else 'crash'
        elif command=='setText':labels[(int(args[1]),int(args[2]))]=args[3]
        elif command=='clearText':labels.pop((int(args[1]),int(args[2])),None)
        elif command=='setWall':wall_displays.add((int(args[1]),int(args[2]),args[3]))
        elif command in ('setColor','clearColor','clearAllColor','clearAllText'):
            if command=='clearAllText':labels={}
        elif command=='ackReset':reply='ack'
        else:
            proc.kill();raise AssertionError((title,'unknown protocol command',cmd))
        if reply is not None:
            proc.stdin.write(reply+'\n');proc.stdin.flush()
    err=proc.stderr.read()
    if proc.stdin:proc.stdin.close()
    proc.wait(timeout=10)
    if proc.returncode:
        raise AssertionError((title,'nonzero return code',proc.returncode,err[-1200:]))
    assert 'GOAL REACHED' in err, (title,'failed first goal',err[-500:])
    assert 'HOME REACHED' in err, (title,'failed return',err[-500:])
    assert 'RACE COMPLETE' in err, (title,'failed race',err[-500:])
    assert goal(x,y), (title,'wrong finish',x,y)
    assert 'mapped' in err,(title,'no exploration log')
    rows=[];cr=0xffff;end=None
    for line in err.splitlines():
        if line.startswith('@C '):
            cr=crc16(line,cr);rows.append(line)
        if line.startswith('@END '):end=line
    assert end is not None and len(rows)==w*h,(title,'incomplete map dump',len(rows))
    assert f'n={w*h}' in end and f'crc={cr:04X}' in end,(title,'CRC mismatch',end,cr)
    for row in rows:
        _,xs,ys,*edges=row.split()
        rx,ry=int(xs),int(ys)
        assert 0<=rx<w and 0<=ry<h,(title,'bad map cell',row)
        for d,e in enumerate(edges):
            if e=='?':
                raise AssertionError((title,'unknown map edge',row))
            assert int(e)==int(truth(a,rx,ry,d)),(title,'incorrect map',row,d)
    assert labels.get((gx0,gy0))=='0',(title,'goal not labeled zero',labels.get((gx0,gy0)))
    if missed:assert blocked>0,(title,'missed wall was not exercised')
    else:assert blocked==0,(title,'unexpected collision',blocked)
    # A goal can be multi-cell. Find the final start entry and count post-home steps.
    assert (0,0) in coords or goal(0,0), (title,'not returned to start')
    final_home=max((i for i,p in enumerate(coords) if p==(0,0)),default=-1)
    race_len=len(coords)-final_home-1
    optimum=shortest(a,goal)
    assert race_len==optimum,(title,'race is not shortest',race_len,optimum)
    return {'case':title,'size':f'{w}x{h}','moves':motion,'race':race_len,'shortest':optimum,
            'blocked':blocked,'commands':commands}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--quick',action='store_true',help='run only 6 supplied mazes')
    p.add_argument('--exe',default='',help='path to compiled official solver')
    args=p.parse_args()
    binary=pathlib.Path(args.exe).resolve() if args.exe else ROOT/('solver.exe' if os.name=='nt' else 'solver')
    if not binary.is_file():
        print('First build official solver with: gcc -O2 -std=c99 -o solver.exe main_sim.c hal_sim.c mm_common.c solver.c')
        sys.exit(2)
    tests=[]
    e=ROOT/'mazes'
    for name in ('sample_4x4','sample_8x8','wall_follower_trap_8x8','changed_goal_10x7','narrow_1x7','blocked_move_recovery_3x3'):
        a=read_local(e/f'{name}.maze')
        g=list(map(int,(e/f'{name}.goal').read_text().split()))
        tests.append((a,(g[0],g[1],g[0],g[1]),name,name=='sample_8x8',name=='blocked_move_recovery_3x3'))
    if not args.quick:
        for w,h in [(4,4),(8,8),(10,7),(16,16),(1,7),(7,1),(2,2)]:
            for seed in range(10):
                a=generate(w,h,seed+2026)
                rng=random.Random(seed*100+13)
                gx=rng.randrange(w);gy=rng.randrange(h)
                tests.append((a,(gx,gy,gx,gy),f'random_{w}x{h}_seed{seed}',False,False))
        for w,h in [(8,8),(16,16)]:
            for seed in range(5):
                a=generate(w,h,seed+9000)
                tests.append((a,((w-1)//2,(h-1)//2,w//2,h//2),f'center_block_{w}x{h}_{seed}',False,False))
    results=[]
    for a,g,name,bad,missed in tests:
        result=run_case(binary,a,g,name,one_bad=bad,missed=missed)
        results.append(result)
        if len(results)<=10 or len(results)%10==0:
            print(f"PASS {name}: {result['size']}, race={result['race']} moves, optimal={result['shortest']}")
    print(f"ALL {len(results)} OFFICIAL-HAL PROTOCOL TESTS PASSED (no mms GUI used)")

if __name__=='__main__':main()
