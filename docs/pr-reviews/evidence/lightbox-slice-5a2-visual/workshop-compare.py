"""Compare the Workshop's sessions menu and browser shots before and after.

Adapted from ../lightbox-source-picker/compare.py. For each shot
workshop-harness.js took with the base bundle (`-before-`) and the head
bundle (`-after-`), report how many pixels differ in the whole shot, and the
largest channel difference.

Usage: python3 -I workshop-compare.py <harness outDir>
"""
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
    for name in sorted(os.listdir(workshop)):
        if '-before-' not in name:
            continue
        after = name.replace('-before-', '-after-')
        pixels, largest = differing_pixels(os.path.join(workshop, name), os.path.join(workshop, after))
        shot, width = name[:-len('.png')].replace('-before', '').rsplit('-', 1)
        print(f"{shot} {width}: {pixels} differing pixels (largest channel difference {largest})")


if __name__ == '__main__':
    main(sys.argv[1])
