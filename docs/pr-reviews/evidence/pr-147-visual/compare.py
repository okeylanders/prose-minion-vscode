"""Compare two harness runs (baseline vs result) shot by shot.

Usage: python3 compare.py <baselineDir> <resultDir> [noiseDir]

For every <state>-<width>.png in both directories it reports the differing
pixel count, the largest per-channel difference (0-255) and the bounding box.
For the 1440-wide DOM snapshots it reports whether the result's #root markup
equals the baseline's once the new data-pm-frame="fulltab" stamp is removed.
An optional noiseDir (a second baseline run) gives the renderer's own
run-to-run noise for comparison. Prints a Markdown table.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageChops


def diff(a_path, b_path):
    a = Image.open(a_path).convert('RGB')
    b = Image.open(b_path).convert('RGB')
    if a.size != b.size:
        return f'size {a.size} vs {b.size}', '-', '-'
    d = ImageChops.difference(a, b)
    box = d.getbbox()
    if not box:
        return '0', '0', '-'
    arr = np.asarray(d)
    return str(int((arr.sum(axis=2) > 0).sum())), str(int(arr.max())), str(box)


base, res = sys.argv[1], sys.argv[2]
noise = sys.argv[3] if len(sys.argv) > 3 else None
shots = sorted(f for f in os.listdir(res) if f.endswith('.png') and os.path.exists(os.path.join(base, f)))

print('| Shot | DOM (1440 only) | Differing px | Max channel Δ | Diff box | Baseline-vs-baseline px |')
print('|---|---|---|---|---|---|')
for shot in shots:
    stem = shot[:-4]
    dom = '-'
    a_html, b_html = os.path.join(base, stem + '.html'), os.path.join(res, stem + '.html')
    if os.path.exists(a_html) and os.path.exists(b_html):
        a_dom = open(a_html).read()
        b_dom = open(b_html).read().replace(' data-pm-frame="fulltab"', '', 1)
        dom = 'identical' if a_dom == b_dom else 'DIFFERS'
    px, mx, box = diff(os.path.join(base, shot), os.path.join(res, shot))
    nz = '-'
    if noise and os.path.exists(os.path.join(noise, shot)):
        nz = diff(os.path.join(base, shot), os.path.join(noise, shot))[0]
    print(f'| {stem} | {dom} | {px} | {mx} | {box} | {nz} |')
