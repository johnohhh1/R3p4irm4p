#!/usr/bin/env python3
"""Turn a saved repair map into a printable scope package (PDF).

    python tools/build_pdf.py state.json --out scope.pdf \
        --site "North Warehouse - Dock 3" --prepared-by "A. Manager"

Pages: cover with the counts and a breakdown by area, the floor plan with every
pin numbered, a worksheet with blank quantity and price columns, one page per
pin with its photos and a close-up of where it sits, and a sign-off page.

Pin numbers never change, so pages are ordered as a walk through the building
(banded top to bottom, left to right) and each page shows both numbers.
"""
import argparse, base64, io, json, os, sys, datetime

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_THEME = {
    "structure": "#22235B",   # titles, rules, table headers, pins
    "accent":    "#C0392B",   # the one emphasis colour — rules under titles
    "highlight": "#B88A00",   # the single number that matters most
    "page":      "#FAF9F5",
    "card":      "#EEECE7",
    "rule":      "#D4D2CD",
    "muted":     "#A19F9A",
    "ink":       "#17101D",
    "white":     "#FFFFFF",
}

ISSUE = {'grout': 'Grout repair', 'cracked': 'Cracked tile', 'chipped': 'Chipped / broken tile',
         'loose': 'Loose or missing tile', 'other': 'Other'}
STATUS = {'open': 'Open', 'sched': 'Scheduled', 'done': 'Done'}


# ---------------------------------------------------------------- fonts
def register_fonts(font_dir):
    """Use real fonts when a folder of TTFs is given, else fall back to the built-ins."""
    want = {'Body': 'Montserrat-Regular.ttf', 'BodyB': 'Montserrat-Bold.ttf',
            'Label': 'Montserrat-ExtraBold.ttf', 'Display': 'RobotoSlab-ExtraBold.ttf'}
    if font_dir and all(os.path.exists(os.path.join(font_dir, f)) for f in want.values()):
        for name, f in want.items():
            pdfmetrics.registerFont(TTFont(name, os.path.join(font_dir, f)))
        return dict.fromkeys(want, True), os.path.join(font_dir, want['Label'])
    print('note: --fonts not given or incomplete, falling back to Helvetica')
    return None, None


# ---------------------------------------------------------------- helpers
def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def walk_order(pins, bands=8):
    """Order pins as a walk: horizontal bands top to bottom, left to right inside each."""
    ordered = sorted(pins, key=lambda p: (int(p['y'] * bands), p['x']))
    for i, p in enumerate(ordered, 1):
        p['stop'] = i
    return ordered


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('state', help='state.json from extract_state.py (or a map .html)')
    ap.add_argument('--out', default='scope.pdf')
    ap.add_argument('--title', default='REPAIR SCOPE PACKAGE')
    ap.add_argument('--site', default='', help='site line on the cover, e.g. "North Warehouse - Dock 3"')
    ap.add_argument('--eyebrow', default='', help='small label in the page header (defaults to --site)')
    ap.add_argument('--prepared-by', default='')
    ap.add_argument('--date', default=datetime.date.today().strftime('%B %-d, %Y'))
    ap.add_argument('--surface', default='floor', help='what the work is on, used in the closing summary')
    ap.add_argument('--link', default='', help='optional link to the live map, printed on the cover')
    ap.add_argument('--theme', help='theme.json overriding the default colours')
    ap.add_argument('--fonts', default=os.path.join(HERE, 'assets', 'fonts'),
                    help='folder with Montserrat + Roboto Slab TTFs (optional)')
    ap.add_argument('--paper', choices=['letter', 'a4'], default='letter')
    ap.add_argument('--photo-px', type=int, default=860)
    ap.add_argument('--bands', type=int, default=8, help='how many horizontal bands the walk order uses')
    a = ap.parse_args()

    # ---------------- data
    if a.state.lower().endswith(('.html', '.htm')):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from extract_state import load_state
        st = load_state(a.state)
    else:
        with open(a.state) as fh:
            st = json.load(fh)
    pins = walk_order([dict(p) for p in st['pins']], a.bands)
    photos = st['photos']
    if not pins:
        sys.exit('That map has no pins yet — place some photos on the plan first.')
    nphoto = sum(len(p['photos']) for p in pins)
    eyebrow = a.eyebrow or a.site or a.title

    T = dict(DEFAULT_THEME)
    if a.theme:
        with open(a.theme) as fh:
            T.update(json.load(fh))
    NAVY, ACC, HL = T['structure'], T['accent'], T['highlight']
    PAGE, CARD, RULE, MUTED, INK, WHITE = T['page'], T['card'], T['rule'], T['muted'], T['ink'], T['white']

    fonts, label_ttf = register_fonts(a.fonts)
    BODY = 'Body' if fonts else 'Helvetica'
    BODYB = 'BodyB' if fonts else 'Helvetica-Bold'
    LABEL = 'Label' if fonts else 'Helvetica-Bold'
    DISP = 'Display' if fonts else 'Helvetica-Bold'

    tmp = os.path.join(os.path.dirname(os.path.abspath(a.out)) or '.', '.repairmap_tmp')
    os.makedirs(os.path.join(tmp, 'loc'), exist_ok=True)

    # ---------------- images
    for pid, ph in photos.items():
        im = Image.open(io.BytesIO(base64.b64decode(ph['s'].split(',', 1)[1]))).convert('RGB')
        im.thumbnail((a.photo_px, a.photo_px), Image.LANCZOS)
        im.save(os.path.join(tmp, pid + '.jpg'), 'JPEG', quality=62, optimize=True)
    plan_img = Image.open(io.BytesIO(base64.b64decode(st['plan'].split(',', 1)[1]))).convert('RGB')
    big = plan_img.resize((plan_img.width * 2, plan_img.height * 2), Image.LANCZOS)

    def marked(img, subset, r=27, fs=27, ring=None):
        im = img.copy()
        d = ImageDraw.Draw(im)
        for p in subset:
            x, y = p['x'] * im.width, p['y'] * im.height
            hl = ring == p['id']
            rr = r * 1.45 if hl else r
            size = int(fs * 1.45) if hl else fs
            f = ImageFont.truetype(label_ttf, size) if label_ttf else ImageFont.load_default()
            d.ellipse([x - rr - 5, y - rr - 5, x + rr + 5, y + rr + 5], fill=(255, 255, 255))
            if hl:
                d.ellipse([x - rr - 4, y - rr - 4, x + rr + 4, y + rr + 4], outline=hx(ACC), width=5)
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=hx(ACC) if hl else hx(NAVY))
            d.text((x, y - 1), str(p['no']), font=f, fill=(255, 255, 255), anchor='mm')
        return im

    marked(big, pins).save(os.path.join(tmp, 'plan_marked.png'))
    for p in pins:
        w = int(big.width * 0.34); h = int(w / 1.5)
        cx, cy = int(p['x'] * big.width), int(p['y'] * big.height)
        l = max(0, min(big.width - w, cx - w // 2)); t = max(0, min(big.height - h, cy - h // 2))
        near = [q for q in pins if abs(q['x'] * big.width - cx) < w and abs(q['y'] * big.height - cy) < h]
        crop = marked(big, near, r=20, fs=20, ring=p['id']).crop((l, t, l + w, t + h))
        crop.thumbnail((620, 620), Image.LANCZOS)
        crop.convert('P', palette=Image.ADAPTIVE, colors=32).save(os.path.join(tmp, 'loc', p['id'] + '.png'), optimize=True)

    # ---------------- pdf scaffolding
    PW, PH = letter if a.paper == 'letter' else A4
    M = 54
    c = canvas.Canvas(a.out, pagesize=(PW, PH), pageCompression=1)
    c.setTitle(a.title)
    if a.prepared_by:
        c.setAuthor(a.prepared_by)
    page_no = [0]
    foot = ' · '.join(x for x in [f'Prepared by {a.prepared_by}' if a.prepared_by else '', a.date] if x)

    def cap(txt, x, y, size=7.5, color=None, font=None, space=1.1, align='l'):
        c.setFont(font or LABEL, size); c.setFillColor(color or NAVY); c._charSpace = space
        (c.drawRightString if align == 'r' else c.drawString)(x, y, txt.upper())
        c._charSpace = 0

    def frame(land=False, right=''):
        w, hgt = (PH, PW) if land else (PW, PH)
        page_no[0] += 1
        c.setFillColor(PAGE); c.rect(0, 0, w, hgt, stroke=0, fill=1)
        c.setStrokeColor(NAVY); c.setLineWidth(3)
        c.line(M, hgt - 36, w - M, hgt - 36)
        cap(eyebrow, M, hgt - 28)
        cap(right or a.title, w - M, hgt - 28, align='r', color=MUTED)
        c.line(M, 46, w - M, 46)
        c.setFont(BODY, 7.5); c.setFillColor(MUTED); c.drawString(M, 34, foot)
        c.setFont(BODYB, 7.5); c.setFillColor(NAVY); c.drawRightString(w - M, 34, f'Page {page_no[0]}')

    def wrap(txt, font, size, maxw):
        out, cur = [], ''
        for word in txt.split():
            t = (cur + ' ' + word).strip()
            if pdfmetrics.stringWidth(t, font, size) <= maxw:
                cur = t
            else:
                out.append(cur); cur = word
        if cur:
            out.append(cur)
        return out

    def para(txt, x, y, maxw, size=9.5, leading=13.5, font=None, color=None):
        font = font or BODY
        c.setFont(font, size); c.setFillColor(color or INK)
        for ln in wrap(txt, font, size, maxw):
            c.drawString(x, y, ln); y -= leading
        return y

    def fit(path, x, y, w, h, bg=None, border=None):
        img = ImageReader(path); iw, ih = img.getSize()
        s = min(w / iw, h / ih)
        c.setFillColor(bg or CARD); c.setStrokeColor(border or RULE); c.setLineWidth(0.7)
        c.rect(x, y, w, h, stroke=1, fill=1)
        c.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s, mask='auto')

    def heading(txt, y, w=None):
        c.setFont(LABEL, 12); c.setFillColor(NAVY); c._charSpace = 0.8
        c.drawString(M, y, txt.upper()); c._charSpace = 0
        c.setStrokeColor(ACC); c.setLineWidth(2); c.line(M, y - 8, (w or PW) - M, y - 8)
        return y - 26

    # ---------------- cover
    frame()
    y = PH - 120
    c.setFont(DISP, 25); c.setFillColor(NAVY)
    for line in wrap(a.title.upper(), DISP, 25, PW - 2 * M):
        c.drawString(M, y, line); y -= 29
    y += 4
    c.setStrokeColor(ACC); c.setLineWidth(4); c.line(M, y, M + 180, y)
    y -= 28
    if a.site:
        c.setFont(BODYB, 11); c.setFillColor(INK); c.drawString(M, y, a.site); y -= 16
    c.setFont(BODY, 10); c.setFillColor(MUTED)
    c.drawString(M, y, f'Walkthrough {a.date}')

    y -= 34
    cw, ch = PW - 2 * M, 108
    c.setFillColor(CARD); c.setStrokeColor(NAVY); c.setLineWidth(1.2)
    c.rect(M, y - ch, cw, ch, stroke=1, fill=1)
    kinds = sorted({ISSUE.get(p['issue'], p['issue']) for p in pins})
    done = sum(1 for p in pins if p['status'] == 'done')
    for i, (n, l) in enumerate([(str(len(pins)), 'Locations marked'), (str(nphoto), 'Photos taken'),
                                (str(len(kinds)), 'Problem types'), (str(done), 'Repaired to date')]):
        cx = M + 22 + i * (cw - 30) / 4
        c.setFont(DISP, 30); c.setFillColor(HL if i == 1 else NAVY)
        c.drawString(cx, y - 54, n)
        cap(l, cx, y - 70, size=7, color=MUTED)
    c.setFont(BODY, 8.5); c.setFillColor(MUTED)
    c.drawString(M + 22, y - ch + 16, 'Conditions found: ' + ', '.join(kinds).lower() + '.')

    y = heading('Where the work is', y - ch - 22)
    areas = {}
    for p in pins:
        d = areas.setdefault(p['label'] or 'Unnamed', {'pins': [], 'ph': 0})
        d['pins'].append(p['no']); d['ph'] += len(p['photos'])
    rows = sorted(areas.items(), key=lambda kv: (-kv[1]['ph'], kv[0]))
    half = (len(rows) + 1) // 2
    yy = y
    for col in range(2):
        yy2 = y
        cx = M + col * (PW - 2 * M) / 2
        for k, d in rows[col * half:(col + 1) * half]:
            c.setFont(BODYB, 9); c.setFillColor(INK); c.drawString(cx, yy2, k[:34])
            c.setFont(BODY, 8.5); c.setFillColor(MUTED)
            tag = ('pin ' if len(d['pins']) == 1 else 'pins ') + ', '.join(str(n) for n in sorted(d['pins']))
            c.drawRightString(cx + (PW - 2 * M) / 2 - 24, yy2, f"{tag} · {d['ph']}p")
            yy2 -= 13.5
        yy = min(yy, yy2)
    y = yy - 16

    bh = 72
    c.setFillColor('#FFF3CC'); c.setStrokeColor(NAVY); c.setLineWidth(2)
    c.rect(M, y - bh, PW - 2 * M, bh, stroke=1, fill=1)
    cap('How to read the numbers', M + 14, y - 20, size=9, space=0.8)
    para('Pin numbers come from the live photo map and never change, so a pin number always points at the '
         'same spot. Pages run in walking order through the building, so the pin numbers themselves are not '
         'in order. Every page shows both.', M + 14, y - 36, PW - 2 * M - 28, size=8.8, leading=12)
    if a.link:
        y = max(y - bh - 20, 74)
        c.setFont(BODY, 8.5); c.setFillColor(MUTED)
        c.drawString(M, y, 'Live photo map (internal):')
        c.setFont(BODYB, 8.5); c.setFillColor(NAVY)
        c.drawString(M, y - 12, a.link)

    # ---------------- marked plan
    c.showPage(); c.setPageSize(landscape((PW, PH)))
    frame(True, 'MARKED PLAN')
    LW, LH = PH, PW
    c.setFont(DISP, 17); c.setFillColor(NAVY); c.drawString(M, LH - 74, 'MARKED FLOOR PLAN')
    c.setStrokeColor(ACC); c.setLineWidth(3); c.line(M, LH - 84, M + 120, LH - 84)
    c.setFont(BODY, 9); c.setFillColor(MUTED)
    c.drawRightString(LW - M, LH - 74, f'{len(pins)} locations · numbers match the photo map and the pages that follow')
    fit(os.path.join(tmp, 'plan_marked.png'), M, 62, LW - 2 * M, LH - 160, bg=WHITE)
    c.setFont(BODY, 8); c.setFillColor(MUTED)
    c.drawString(M, 54, 'Each pin sits on the failure; see that location page for how far it runs.')

    # ---------------- worksheet
    c.showPage(); c.setPageSize((PW, PH))
    frame(right='SCOPE WORKSHEET')
    y = PH - 80
    c.setFont(DISP, 17); c.setFillColor(NAVY); c.drawString(M, y, 'SCOPE WORKSHEET')
    c.setStrokeColor(ACC); c.setLineWidth(3); c.line(M, y - 10, M + 120, y - 10)
    y -= 26
    c.setFont(BODY, 9); c.setFillColor(INK)
    c.drawString(M, y, 'Blank columns are for the contractor to complete during the walk.')
    y -= 22
    cols = [('STOP', 34), ('PIN', 28), ('LOCATION', 132), ('CONDITION', 96), ('PHOTOS', 40),
            ('AREA / SQ FT', 74), ('PRICE', 82)]
    xs, x = [], M
    for name, w in cols:
        xs.append((name, x, w)); x += w
    rh = 22
    c.setFillColor(NAVY); c.rect(M, y - rh, x - M, rh, stroke=0, fill=1)
    for name, cx, w in xs:
        c.setFont(LABEL, 7); c.setFillColor(WHITE); c._charSpace = 0.8
        c.drawString(cx + 6, y - 14, name); c._charSpace = 0
    y -= rh
    for i, p in enumerate(pins):
        if y < 150:      # continue on a new page for long lists
            c.showPage(); frame(right='SCOPE WORKSHEET'); y = PH - 90
        c.setFillColor(WHITE if i % 2 == 0 else CARD)
        c.rect(M, y - rh, x - M, rh, stroke=0, fill=1)
        vals = [str(p['stop']), str(p['no']), (p['label'] or 'Unnamed')[:30],
                ISSUE.get(p['issue'], p['issue']), str(len(p['photos'])), '', '']
        for (name, cx, w), v in zip(xs, vals):
            if not v:
                continue
            c.setFont(BODYB if name in ('STOP', 'PIN') else BODY, 8.5)
            c.setFillColor(NAVY if name in ('STOP', 'PIN') else INK)
            c.drawString(cx + 6, y - 15, v)
        c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, y - rh, x, y - rh)
        y -= rh
    y -= 10
    c.setFont(BODYB, 9); c.setFillColor(NAVY)
    c.drawString(M, y, 'TOTAL')
    c.drawString(xs[5][1] + 6, y, '____________')
    c.drawString(xs[6][1] + 6, y, '______________')
    y -= 30
    bh = 64
    c.setFillColor('#FDE7E8'); c.rect(M, y - bh, PW - 2 * M, bh, stroke=0, fill=1)
    c.setStrokeColor(ACC); c.setLineWidth(5); c.line(M + 2, y - bh, M + 2, y)
    cap('Next actions', M + 16, y - 18, size=9, space=0.8)
    c.setFont(BODY, 9); c.setFillColor(INK)
    c.drawString(M + 16, y - 34, 'Walk the site with the contractor: ______________________   Owner: ____________   Date: _________')
    c.drawString(M + 16, y - 50, 'Quote returned and submitted: _________________________   Owner: ____________   Date: _________')

    # ---------------- one page per location
    for p in pins:
        ids = p['photos']
        chunks = [ids[i:i + 4] for i in range(0, len(ids), 4)] or [[]]
        for ci, chunk in enumerate(chunks):
            c.showPage(); frame(right=f"STOP {p['stop']} OF {len(pins)}")
            y = PH - 80
            c.setFillColor(NAVY); c.circle(M + 15, y - 4, 15, stroke=0, fill=1)
            c.setFont(LABEL, 13); c.setFillColor(WHITE)
            c.drawCentredString(M + 15, y - 9, str(p['no']))
            title = (p['label'] or 'Unnamed location').upper() + (' (CONT.)' if ci else '')
            c.setFont(DISP, 17); c.setFillColor(NAVY)
            c.drawString(M + 42, y - 10, title)
            c.setStrokeColor(ACC); c.setLineWidth(3)
            c.line(M + 42, y - 22, M + 42 + min(260, pdfmetrics.stringWidth(title, DISP, 17)), y - 22)

            lw = 168; lh = lw / 1.5
            fit(os.path.join(tmp, 'loc', p['id'] + '.png'), PW - M - lw, y - lh - 4, lw, lh, bg=WHITE)
            cap('where it is', PW - M - lw, y - lh - 16, size=6.5, color=MUTED)

            y -= 44
            c.setFont(LABEL, 7.5); c.setFillColor(MUTED); c._charSpace = 1.1
            c.drawString(M, y, 'CONDITION'); c.drawString(M + 118, y, 'STATUS'); c.drawString(M + 200, y, 'PHOTOS')
            c._charSpace = 0
            y -= 15
            c.setFont(BODYB, 10); c.setFillColor(NAVY)
            c.drawString(M, y, ISSUE.get(p['issue'], p['issue']))
            c.drawString(M + 118, y, STATUS.get(p['status'], p['status']))
            c.drawString(M + 200, y, str(len(ids)))
            y -= 20
            if p.get('note') and not ci:
                y = para('Note from the site: ' + p['note'], M, y, PW - 2 * M - lw - 20, size=9) - 6
            y = min(y, PH - 80 - lh - 34)

            n = len(chunk)
            cols_n = 1 if n == 1 else 2
            rws = max(1, (n + cols_n - 1) // cols_n)
            gap, capsp = 14, 14
            gw = (PW - 2 * M - (cols_n - 1) * gap) / cols_n
            gh = min(430, ((y - 140) - rws * capsp - (rws - 1) * gap) / rws)
            for i, pid in enumerate(chunk):
                gx = M + (i % cols_n) * (gw + gap)
                gy = y - (i // cols_n + 1) * (gh + capsp + gap) + gap
                fit(os.path.join(tmp, pid + '.jpg'), gx, gy, gw, gh)
                c.setFont(BODY, 7.5); c.setFillColor(MUTED)
                c.drawString(gx, gy - 11, photos[pid]['n'])
            y -= rws * (gh + capsp + gap)

            if ci == len(chunks) - 1:
                bh = 58; by = max(66, y - 10)
                c.setFillColor(CARD); c.setStrokeColor(RULE); c.setLineWidth(0.8)
                c.rect(M, by - bh, PW - 2 * M, bh, stroke=1, fill=1)
                cap('contractor use', M + 12, by - 16, size=6.5, color=MUTED)
                c.setFont(BODY, 9); c.setFillColor(INK)
                c.drawString(M + 12, by - 34, 'Area (sq ft): ____________     Units to replace: ____________     Repair only:  Y / N')
                c.drawString(M + 12, by - 50, 'Price: ____________     Notes: ______________________________________________________')

    # ---------------- sign-off
    c.showPage(); frame(right='APPROVAL')
    y = PH - 90
    c.setFont(DISP, 17); c.setFillColor(NAVY); c.drawString(M, y, 'APPROVAL & SIGN-OFF')
    c.setStrokeColor(ACC); c.setLineWidth(3); c.line(M, y - 10, M + 150, y - 10)
    y = para(f'This package documents the condition of the {a.surface} at {a.site or "the site"} as of {a.date}. '
             f'It covers {len(pins)} locations, photographed on the walk. Photographs are unedited.',
             M, y - 40, PW - 2 * M, size=10, leading=15) - 18
    for lab, val in [('Requested by', a.prepared_by), ('Site', a.site), ('Facilities contact', ''),
                     ('Contractor', ''), ('Approved amount', ''), ('Scheduled date', '')]:
        cap(lab, M, y, color=MUTED)
        c.setStrokeColor(RULE); c.setLineWidth(0.8); c.line(M + 150, y - 3, PW - M, y - 3)
        if val:
            c.setFont(BODYB, 10); c.setFillColor(NAVY); c.drawString(M + 156, y, val)
        y -= 34
    c.setFont(BODY, 8.5); c.setFillColor(MUTED)
    c.drawString(M, y - 10, f'Photos and pin numbers stay current on the live map; this PDF is a snapshot of {a.date}.')
    c.save()

    for root, _, files in os.walk(tmp, topdown=False):
        for f in files:
            os.remove(os.path.join(root, f))
        os.rmdir(root)
    print(f'{a.out}  {os.path.getsize(a.out)/1e6:.1f} MB  ·  {page_no[0]} pages  ·  {len(pins)} locations')


if __name__ == '__main__':
    main()
