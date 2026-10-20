"""Compare the Workshop's excerpt-mode picker before and after the shared picker.

Adapted from ../lightbox-slice-2a-visual/compare.py. For each Workshop shot
the harness took with the base bundle (`-before-`) and the head bundle
(`-after-`), report the size and the number of pixels that differ, and
whether the dialog's markup hashed the same in facts.json.

Usage: python3 -I compare.py <harness outDir>
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageChops


def differing_pixels(a_path, b_path):
    a = Image.open(a_path).convert('RGB')
    b = Image.open(b_path).convert('RGB')
    if a.size != b.size:
        return None, 255
    arr = np.asarray(ImageChops.difference(a, b))
    return int((arr.sum(axis=2) > 0).sum()), int(arr.max())


def main(out_dir):
    workshop = os.path.join(out_dir, 'workshop')
    with open(os.path.join(out_dir, 'facts.json'), encoding='utf8') as handle:
        facts = json.load(handle)
    for name in sorted(os.listdir(workshop)):
        if '-before-' not in name:
            continue
        after = name.replace('-before-', '-after-')
        pixels, largest = differing_pixels(os.path.join(workshop, name), os.path.join(workshop, after))
        shot, width = name[:-len('.png')].rsplit('-', 1)
        key = f"workshop/{shot}@{width}"
        before_dialog = facts[key]['dialog']['htmlSha256']
        after_dialog = facts[key.replace('-before', '-after')]['dialog']['htmlSha256']
        print(f"{shot.replace('-before', '')} {width}: {pixels} differing pixels (largest channel difference {largest}); "
              f"dialog markup {'identical' if before_dialog == after_dialog else 'DIFFERENT'}")


if __name__ == '__main__':
    main(sys.argv[1])
