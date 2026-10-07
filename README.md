# Set Label Press — Pokémon TCG set labels

**Live: https://labels.omg.irish/**

Printable labels for every English Pokémon TCG expansion, for binders, storage boxes and dividers, plus every
Japanese (1996 on), Korean (2011 on), Traditional Chinese (2019 on) and Simplified Chinese (2020 on) expansion.
Each label carries the set symbol, the HD set logo, the expansion number, release date, generation and card
count (secret rares included). Print one label per page on a Phomemo M110 label roll, lay them out at
true size on Letter / A4 / 3×5 index cards for a color printer and cut them out, or print straight onto
Avery label sheets: address, shipping, square, round, business-card and file-folder labels, and the
cardstock binder spine inserts (89103 to 89109) that slide into a view binder's clear spine pocket.
Spine strips are turned on their side to read top-to-bottom like a book on a shelf.

Runs entirely in the browser. No accounts, no tracking, no server-side anything: it is a static site.

![Set Label Press](public/og.png)

## Using it

1. Tick the sets you want (search, filter by series, or "New since 2023").
2. Pick a label size (M110 rolls, half an index card, an Avery sheet number, or a custom size). Avery
   labels are placed exactly where Avery's own templates put them on a US Letter sheet (spine inserts and
   the square/round sheets were measured from Avery's blank-template PDFs, the classic address/shipping
   layouts come from the glabels template database); print at 100% with margins set to None.
3. Check the preview: one label, the whole roll, or the exact pages of a sheet.
4. **Print labels** (label printer, one label per page) or **Print sheet** (color printer, cut guides).

Settings are saved in your browser only.

## Running locally (Windows)

`scripts\start.ps1` (re)starts `scripts/serve.mjs` in the background on http://localhost:8000 (this machine only)
and opens it in Google Chrome. Served this way, the page shows an **Update data** button that runs the pipelines
on the server and reloads when they finish: English (`pipeline/update_en.py`, then the French data is rebuilt on
top), French (`fetch_pokepedia.mjs` + `build_fr.mjs --refresh`), or both. The static site has no such button.
Needs Node 18+, and Python 3 with Pillow for the English update.

```
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

A desktop shortcut can run the same command.

## Layout

```
public/            the site, deployed as-is to Cloudflare Workers (static assets)
  index.html       app + all styling and logic
  sets.js          data snapshot: name, series, type, Bulbapedia set code, abbreviation, sequential
                   expansion number, release date, printed + secret card counts, set symbol (data URI),
                   logo path, "printed in the 2023 batch" flag
  img/logos/       set logos (1000 px wide, 256 colours)
  pokemon.js       species data for the Pokémon labels: dex number, name, category, types, height,
                   weight, generation, debut year, Pokédex entry (full + one sentence)
  img/art/         official artwork per species (PokeAPI, trimmed, webp)
pipeline/          regeneration scripts (Python 3, Pillow)
wrangler.toml      Cloudflare Workers config (custom domain labels.omg.irish)
```

## Regenerating the data when new sets ship

`python pipeline/update_en.py` runs the downloads and the four set steps below in one go (images already in
`pipeline/img/` are kept, so only new sets download). By hand:

```
cd pipeline
curl -A "Mozilla/5.0" -o bulba_expansions.html "https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions"
curl -o sets_p1.json "https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=releaseDate"
python parse_bulba.py      # tables -> bulba_raw.json
python build_data.py       # normalise, number, fix rowspan-shifted rows -> sets_data.json
python fetch_images.py     # download + resize symbols and logos (skips files already present)
python make_setsjs.py      # writes ../public/sets.js and ../public/img/logos/
python build_pokemon.py    # PokeAPI CSVs + artwork -> ../public/pokemon.js and ../public/img/art/ (new species)
```

Numbering: main-series expansions and special expansions are counted on separate sequential counters,
matching the 2023 index-card batch (Legends Awakened 37, Team Up 79, Silver Tempest 94; Dragon Vault
special 1). `docx_abbrs.json` is the abbreviation list from that batch and drives the "New since 2023"
filter.

## Deploying

```
npx wrangler deploy
```

## Data and artwork

Set data and artwork come from [Bulbapedia's list of Pokémon TCG expansions](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions)
(CC BY-NC-SA) with Base Set artwork from [pokemontcg.io](https://pokemontcg.io/).

Pokémon and all set names, symbols and logos are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc.
This is an unofficial fan-made tool for personal, non-commercial use and is not affiliated with or endorsed by
The Pokémon Company.

## Japanese, Korean and Chinese sets

Pick the card language under **Cards** at the top of the set list. Each language loads its own data file
(`public/sets_ja.js`, `sets_ko.js`, `sets_zhtw.js`, `sets_zhcn.js`) and a Noto Sans font on demand, and keeps its
own selection. Labels can use English or native table headings, and can add the English set name under the logo.

| Language | Source | Notes |
|---|---|---|
| Japanese | Bulbapedia's Japanese expansion list (names, counts, dates, symbols, logos) + TCGdex set codes | DP, DPt and BW sets have no code (none was printed) |
| Korean | pokemoncard.co.kr product pages (names, official release dates) | Matched by hand to the Japanese twin for code, counts and symbol (`KO_TO_JP` in `build.py`); three Korea-only sets have no counts |
| Traditional Chinese | asia.pokemon-card.com/tw expansion index (codes, names, dates) | Counts and symbols from the Japanese twin by code; Taiwan-only sets read their printed count off the first card |
| Simplified Chinese | TCGdex `zh-cn` (mainland C-suffixed sets) | No artwork |

TCGdex's Korean release dates are copies of the Japanese dates, so the official Korean site is the date source.

Regenerate:

```
cd pipeline/cjk
python fetch_tcgdex.py     # TCGdex set lists + details for ja / ko / zh-tw / zh-cn -> tcgdex_raw.json
curl -s -A "Set Label Press" "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&format=json&prop=wikitext&page=List_of_Japanese_Pok%C3%A9mon_Trading_Card_Game_expansions" | python -c "import json,sys;print(json.load(sys.stdin)['parse']['wikitext']['*'])" > jp_list.wiki
python parse_ja.py         # jp_list.wiki + TCGdex codes -> ja_records.json
python fetch_img.py        # Japanese symbols + logos from Bulbapedia -> img/ (cache, gitignored)
python fetch_kr.py         # new Korean products since the last run -> kr_official.json (--full rescans)
python fetch_tw.py         # Taiwan expansion index + counts for Taiwan-only sets
python build.py            # -> ../../public/sets_{ja,ko,zhtw,zhcn}.js and ../../public/img/logos/ja/
```

A new Korean set needs one line in `KO_TO_JP` (Korean name -> Japanese code); `build.py` prints any it can't match.

## French sets

French boosters are translations of the English sets, so `public/sets_fr.js` reuses the English records (card
counts, codes, symbols). French names and release dates come from [Poképédia](https://www.pokepedia.fr/)'s
expansion infoboxes, era names from [TCGdex](https://tcgdex.dev/), logos from TCGdex or else Poképédia. A set is
listed if TCGdex has it in French or Poképédia gives a French release date (Base Set 2, Gym Heroes/Challenge,
Legendary Collection, Skyridge, Team Rocket Returns, Arceus and Legendary Treasures never came out in French).
Expansion numbers count the French releases only, in French release order. Set de Base never had a logo and gets
the plain Pokémon one; the POP series have none, so their labels print the name.

Regenerate after `sets.js` changes (Node 18+):

```
cd pipeline/fr
node fetch_pokepedia.mjs      # Poképédia infoboxes + logo URLs -> pokepedia_fr.json
node build_fr.mjs --refresh   # TCGdex -> tcgdex_fr.json, ../../public/sets_fr.js and ../../public/img/logos/fr/
```

The build prints what it couldn't match: a set whose English name differs from TCGdex's needs a line in `ID_OVERRIDE`,
one whose Poképédia page doesn't name the English set needs a line in `PKP_OVERRIDE`. Logos are cached by file;
delete one to refetch it.

## License

Code: MIT. Artwork remains the property of its owners as noted above.

## SetCode font

`public/fonts/SetCode.woff2` renders the Scarlet & Violet era set-code symbols. Twenty letters are traced from
the sharpest Bulbapedia symbol images (`pipeline/font/build_setcode_font.py`: potracer + fontTools); N Q U X Y Z
and the digits are constructed to the same stem width and cap height (3 is the traced B without its stem, 0 is O).
The box geometry in `index.html` is measured from the 480 px Scarlet & Violet original: outer margin 5.1% of the
box height, white inner stroke 4%, corner radius 14%, letters 58% of the height; the English "EN" tag follows the
Delta Reign original (baseline-aligned, about half the main cap height).
`pipeline/font/enhanced/<CODE>.png` holds upscaled symbol images (Topaz) that replace the Bulbapedia source for
their letters when larger; drop a better image there and rerun the builder.
