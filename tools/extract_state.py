#!/usr/bin/env python3
"""Pull the saved state out of a repair map HTML file.

    python tools/extract_state.py map.html --out state.json --photos ./exported

`state.json` holds the pins, labels, notes and photo assignments and is what
build_pdf.py reads. `--photos` also writes every embedded photo back out as a
JPEG, named after the pin it belongs to.
"""
import argparse, base64, json, os, re, sys


def load_state(path):
    with open(path, encoding='utf-8') as fh:
        html = fh.read()
    m = re.search(r'<script type="application/json" id="app-state">(.*?)</script>', html, re.S)
    if not m:
        sys.exit('No map state found in that file — is it a map built by build_map.py?')
    return json.loads(m.group(1))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('map', help='the map HTML file')
    ap.add_argument('--out', default='state.json')
    ap.add_argument('--photos', help='folder to write the embedded photos into')
    ap.add_argument('--plan', help='write the floor plan image to this path')
    a = ap.parse_args()

    st = load_state(a.map)
    with open(a.out, 'w') as fh:
        json.dump(st, fh)
    placed = sum(len(p['photos']) for p in st['pins'])
    print(f"{a.out}: {len(st['pins'])} pins, {len(st['photos'])} photos ({placed} placed)")

    if a.plan and st.get('plan'):
        with open(a.plan, 'wb') as fh:
            fh.write(base64.b64decode(st['plan'].split(',', 1)[1]))
        print('plan ->', a.plan)

    if a.photos:
        os.makedirs(a.photos, exist_ok=True)
        pin_of = {pid: p for p in st['pins'] for pid in p['photos']}
        for pid, ph in st['photos'].items():
            pin = pin_of.get(pid)
            prefix = f"pin{pin['no']:02d}_" if pin else 'unplaced_'
            safe = re.sub(r'[^A-Za-z0-9._-]+', '_', ph['n'])
            with open(os.path.join(a.photos, f'{prefix}{safe}.jpg'), 'wb') as fh:
                fh.write(base64.b64decode(ph['s'].split(',', 1)[1]))
        print('photos ->', a.photos)


if __name__ == '__main__':
    main()
