#!/usr/bin/env python3
"""Build a self-contained interactive repair map from a floor plan and a folder of photos.

    python tools/build_map.py --plan plan.png --photos ./photos --out map.html \
        --title "Warehouse Floor Repairs" --subtitle "North Warehouse - Dock 3"

The result is one HTML file with the plan and every photo embedded. Open it in a
browser, drag photos onto the plan to pin them, or publish it as a Claude Artifact
so the Save button can write new versions of the page itself.
"""
import argparse, base64, io, json, os, re, sys, datetime

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  pip install pillow")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(HERE, 'app', 'map-template.html')
IMG_EXT = ('.jpg', '.jpeg', '.png', '.webp', '.heic')


def shrink(path, max_px, quality):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    im.thumbnail((max_px, max_px), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def encode_plan(path, max_px):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    if max(im.size) > max_px:
        im.thumbnail((max_px, max_px), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'P', 'L') or path.lower().endswith('.png'):
        im.convert('L' if im.mode == 'L' else 'RGB').quantize(32).save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    im.convert('RGB').save(buf, 'JPEG', quality=80, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def load_hints(path):
    """hints.json: [["^soda", "Soda station"], ...] — regex on the file name, area label."""
    if not path:
        return []
    with open(path) as fh:
        data = json.load(fh)
    if isinstance(data, dict):
        data = list(data.items())
    return [[str(a), str(b)] for a, b in data]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--plan', required=True, help='floor plan image (png/jpg)')
    ap.add_argument('--photos', help='folder of photos to load into the tray')
    ap.add_argument('--out', default='map.html')
    ap.add_argument('--title', default='Repair Map', help='page title, shown in the top bar')
    ap.add_argument('--subtitle', default='', help='small line under the title, e.g. site and area')
    ap.add_argument('--hints', help='hints.json mapping file-name patterns to area names')
    ap.add_argument('--state', help='existing state.json to carry forward (keeps pins)')
    ap.add_argument('--max-px', type=int, default=1100, help='longest edge for photos (default 1100)')
    ap.add_argument('--quality', type=int, default=68, help='JPEG quality for photos (default 68)')
    ap.add_argument('--plan-px', type=int, default=2000, help='longest edge for the plan (default 2000)')
    a = ap.parse_args()

    state = {'v': 1, 'photos': {}, 'order': [], 'pins': [], 'nextNo': 1}
    if a.state:
        with open(a.state) as fh:
            state.update(json.load(fh))

    state['plan'] = encode_plan(a.plan, a.plan_px)
    state['subtitle'] = a.subtitle
    state['hints'] = load_hints(a.hints) or state.get('hints', [])

    known = {ph['n'] for ph in state['photos'].values()}
    if a.photos:
        files = sorted((f for f in os.listdir(a.photos) if f.lower().endswith(IMG_EXT)), key=str.lower)
        n = len(state['photos'])
        for f in files:
            name = os.path.splitext(f)[0]
            if name in known:
                continue
            n += 1
            pid = 'p%03d' % n
            state['photos'][pid] = {'n': name, 's': shrink(os.path.join(a.photos, f), a.max_px, a.quality)}
            state['order'].append(pid)
            print('  +', name)

    state['savedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

    with open(TEMPLATE, encoding='utf-8') as fh:
        html = fh.read()
    payload = json.dumps(state, separators=(',', ':')).replace('<', '\\u003c')
    html = (html.replace('__TITLE__', a.title)
                .replace('__SUBTITLE__', a.subtitle or '')
                .replace('__STATE_JSON__', payload))
    with open(a.out, 'w', encoding='utf-8') as fh:
        fh.write(html)

    mb = os.path.getsize(a.out) / 1e6
    print(f"\n{a.out}  {mb:.1f} MB  ·  {len(state['photos'])} photos  ·  {len(state['pins'])} pins")
    if mb > 15:
        print('WARNING: over 15 MB. Claude Artifacts cap a page at 16 MB — rerun with a smaller --max-px.')


if __name__ == '__main__':
    main()
