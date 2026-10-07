import json, base64, io, os, datetime
from PIL import Image
sets = json.load(open('sets_data.json', encoding='utf-8'))
printed = [a for a in json.load(open('docx_abbrs.json')) if not a.isdigit()]
PUBLIC = os.environ.get('SETS_PUBLIC') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')   # the site
os.makedirs(os.path.join(PUBLIC, 'img', 'logos'), exist_ok=True)
out = []
for s in sets:
    rec = {k: s.get(k) for k in ('name','series','type','setno','abbr','cards','secret','extras','release','expno','slug')}
    rec['printed2023'] = s['abbr'] in printed
    sym = s.get('symbol_img'); rec['symbol_img'] = None
    if sym and os.path.exists(sym):
        im = Image.open(sym).convert('RGBA')
        bb = im.getchannel('A').getbbox()                      # trim transparent margins
        if bb: im = im.crop(bb)
        side = max(im.size); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))   # centre on a square canvas
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2)); im = sq
        if im.width > 240: im = im.resize((240, 240), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True); rec['symbol_img'] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    logo = s.get('logo_img'); rec['logo_img'] = None
    if logo and os.path.exists(logo):
        # the site's logos: 1000 px wide, 256 colours with transparency (~50 KB instead of ~300 KB)
        im = Image.open(logo).convert('RGBA')
        if im.width > 1000: im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        dest = os.path.join(PUBLIC, 'img', 'logos', s['slug'] + '.png')
        im.quantize(256, method=Image.Quantize.FASTOCTREE).save(dest, optimize=True); rec['logo_img'] = f'img/logos/{s["slug"]}.png'
    out.append(rec)
js = 'window.POKEMON_SETS_DATE = ' + json.dumps(datetime.date.today().isoformat()) + ';\nwindow.POKEMON_SETS = ' + json.dumps(out, ensure_ascii=False) + ';\n'
open(os.path.join(PUBLIC, 'sets.js'), 'w', encoding='utf-8').write(js)
print('sets.js', round(len(js.encode())/1e6, 2), 'MB;', sum(1 for r in out if r['symbol_img']), 'symbols,', sum(1 for r in out if r['logo_img']), 'logos;', 'already-printed flags:', sum(1 for r in out if r['printed2023']))
LD = os.path.join(PUBLIC, 'img', 'logos'); tot = sum(os.path.getsize(os.path.join(LD, f)) for f in os.listdir(LD) if os.path.isfile(os.path.join(LD, f))); print('logos dir', round(tot/1e6, 1), 'MB', len(os.listdir(LD)), 'files')
