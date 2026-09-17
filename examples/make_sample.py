#!/usr/bin/env python3
"""Generate a small synthetic site so the tools can be tried without real photos.

    python examples/make_sample.py          # writes examples/sample/

Creates a simple floor plan and a handful of fake "damage" photos, then you can run:

    python tools/build_map.py --plan examples/sample/plan.png --photos examples/sample/photos \
        --hints examples/hints.json --out sample-map.html --title "Sample Repair Map"
"""
import os, random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'sample')
random.seed(7)


def plan(path):
    W, H = 1200, 800
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    for x in range(60, W - 60, 24):
        d.line([(x, 60), (x, H - 60)], fill=(232, 232, 232))
    for y in range(60, H - 60, 24):
        d.line([(60, y), (W - 60, y)], fill=(232, 232, 232))
    d.rectangle([60, 60, W - 60, H - 60], outline='black', width=6)
    d.rectangle([60, 60, 420, 300], outline='black', width=5)          # storage
    d.rectangle([W - 380, 60, W - 60, 260], outline='black', width=5)  # cooler
    d.rectangle([430, 380, 860, 470], outline='black', width=5)        # line
    d.rectangle([430, 520, 860, 610], outline='black', width=5)
    d.rectangle([W - 320, H - 260, W - 60, H - 60], outline='black', width=5)  # dish
    im.save(path)


def photo(path, seed):
    rnd = random.Random(seed)
    W = H = 900
    im = Image.new('RGB', (W, H), (176, 108, 78))
    d = ImageDraw.Draw(im)
    step = 150
    for x in range(0, W, step):
        for y in range(0, H, step):
            d.rectangle([x + 6, y + 6, x + step - 6, y + step - 6],
                        fill=(186 + rnd.randint(-12, 12), 116 + rnd.randint(-12, 12), 84 + rnd.randint(-12, 12)))
    # a "failed grout line"
    gy = rnd.choice(range(step, H, step))
    for x in range(0, W, 3):
        w = rnd.randint(2, 9)
        d.rectangle([x, gy - w, x + 3, gy + w], fill=(70, 66, 60))
    im.save(path, quality=88)


if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'photos'), exist_ok=True)
    plan(os.path.join(OUT, 'plan.png'))
    for i, name in enumerate(['dish_01', 'dish_02', 'line_01', 'cooler_01', 'prep_01'], 1):
        photo(os.path.join(OUT, 'photos', name + '.jpg'), i)
    print('wrote', OUT)
