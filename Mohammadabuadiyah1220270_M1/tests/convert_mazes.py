"""Convert this project's LOCAL numeric mazes to official mms ASCII text mazes.

The files *.maze are for our offline protocol test harness ONLY.
The files mms_*.txt are the ones to load in mms with the 'Maze' button.
"""
from pathlib import Path

DIR = Path(__file__).resolve().parents[1] / 'mazes'
N,E,S,W = 1,2,4,8  # only for the LOCAL test maze encoding
for source in DIR.glob('*.maze'):
    vals=source.read_text(encoding='utf-8').split()
    width,height=map(int, vals[:2]);nums=list(map(int,vals[2:]))
    assert len(nums)==width*height
    # Top row (north) is first in local files.
    rows=[nums[y*width:(y+1)*width] for y in range(height)]
    out=[]
    for row in rows:
        out.append('+' + ''.join(('---' if c & N else '   ')+'+' for c in row))
        out.append(''.join(('|' if c & W else ' ')+'   ' for c in row)+('|' if row[-1]&E else ' '))
    out.append('+' + ''.join(('---' if c & S else '   ')+'+' for c in rows[-1]))
    dest=DIR/('mms_'+source.stem+'.txt')
    dest.write_text('\n'.join(out)+'\n',encoding='utf-8')
    g=list(map(int,(DIR/(source.stem+'.goal')).read_text().split()))
    (DIR/('mms_'+source.stem+'.goal')).write_text(f'{g[0]},{g[1]}\n',encoding='utf-8')
    print(dest.name)
