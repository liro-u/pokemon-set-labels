"""Update the English set data in one go: download Bulbapedia's expansion list and pokemontcg.io's set list, then run
parse_bulba -> build_data -> fetch_images -> make_setsjs (writes ../public/sets.js and ../public/img/logos/).
Images already in img/ are kept, so later runs only download new sets.
    python update_en.py
"""
import os, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PokemonSetLabels/1.0 (personal label printing)'}
SOURCES = {
    'bulba_expansions.html': 'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions',
    'sets_p1.json': 'https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=releaseDate',
}


def download(url, dest):
    for i in range(3):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
            if len(data) < 10000: raise ValueError(f'only {len(data)} bytes')
            open(os.path.join(HERE, dest), 'wb').write(data); return
        except Exception as e:
            err = e; time.sleep(3 + 3 * i)
    raise SystemExit(f'Could not download {url}: {err}')


for dest, url in SOURCES.items():
    print('Downloading', dest, flush=True); download(url, dest)
for script in ('parse_bulba.py', 'build_data.py', 'fetch_images.py', 'make_setsjs.py'):
    print('Running', script, flush=True)
    r = subprocess.run([sys.executable, script], cwd=HERE)
    if r.returncode: raise SystemExit(f'{script} failed ({r.returncode})')
print('English data updated', flush=True)
