"""Compare Workshop harness runs before and after Lightbox Slice 2A.

Adapted from ../pr-147-visual/compare.py. Both bundles already stamp
data-pm-frame="fulltab" (Slice 1), so the DOM is compared verbatim. Given
several runs of each bundle, it reports per shot the renderer's own
run-to-run noise within each bundle next to the smallest and largest
baseline-vs-result difference. A minimum of 0 means some result run is
pixel-identical to some baseline run.

Usage: python3 -I compare.py <base1,base2,...> <head1,head2,...>
"""
import itertools
import os
import sys

import numpy as np
from PIL import Image, ImageChops


def differing_pixels(a_path, b_path):
    a = Image.open(a_path).convert('RGB')
    b = Image.open(b_path).convert('RGB')
    if a.size != b.size:
        return 10 ** 9, 255
    arr = np.asarray(ImageChops.difference(a, b))
    return int((arr.sum(axis=2) > 0).sum()), int(arr.max())


def spread(pairs):
    results = [differing_pixels(a, b) for a, b in pairs]
    if not results:
        return '-'
    pixels = [r[0] for r in results]
    return f'{min(pixels)}–{max(pixels)} ({max(r[1] for r in results)})'


base_runs, head_runs = sys.argv[1].split(','), sys.argv[2].split(',')
shots = sorted(f for f in os.listdir(head_runs[0]) if f.endswith('.png'))

print('| Shot | DOM at 1440 | Base vs base: min–max px (max Δ) | Head vs head: min–max px (max Δ) | Base vs head: min–max px (max Δ) |')
print('|---|---|---|---|---|')
for shot in shots:
    stem = shot[:-4]
    html = stem + '.html'
    runs = base_runs + head_runs
    dom = '-'
    if all(os.path.exists(os.path.join(run, html)) for run in runs):
        dom = 'identical' if len({open(os.path.join(run, html)).read() for run in runs}) == 1 else 'DIFFERS'
    path = lambda run: os.path.join(run, shot)  # noqa: E731
    within_base = spread([(path(a), path(b)) for a, b in itertools.combinations(base_runs, 2)])
    within_head = spread([(path(a), path(b)) for a, b in itertools.combinations(head_runs, 2)])
    across = spread([(path(a), path(b)) for a, b in itertools.product(base_runs, head_runs)])
    print(f'| {stem} | {dom} | {within_base} | {within_head} | {across} |')
