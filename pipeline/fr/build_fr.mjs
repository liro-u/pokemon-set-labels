// Build the French card-language dataset: ../../public/sets_fr.js and ../../public/img/logos/fr/.
//
// French boosters are translations of the English sets, so each French record starts from the English one
// (card counts, set code, extras, symbol). TCGdex gives the French era name; Poképédia (pokepedia_fr.json, from
// fetch_pokepedia.mjs) gives the French release date and name; the logo comes from TCGdex, else Poképédia.
// A set is kept if TCGdex lists it in French or Poképédia has a French release date: Base Set 2, Gym Heroes/Challenge,
// Legendary Collection, Skyridge, Team Rocket Returns, Arceus, Legendary Treasures... were never printed in French.
//
//   node fetch_pokepedia.mjs     refreshes pokepedia_fr.json
//   node build_fr.mjs            uses tcgdex_fr.json if present
//   node build_fr.mjs --refresh  refetches TCGdex first
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', '..', 'public');
const LOGO_DIR = path.join(PUBLIC, 'img', 'logos', 'fr');
const CACHE = path.join(HERE, 'tcgdex_fr.json');
const UA = { 'User-Agent': 'SetLabelPress/1.0 (personal fan tool)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function get(url, as = 'json') {
  let err;
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return as === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) { err = e; await sleep(2000 * (a + 1)); }
  }
  throw err;
}

// ---------------- English data (the site's own snapshot) ----------------
const src = fs.readFileSync(path.join(PUBLIC, 'sets.js'), 'utf8');
const m = src.match(/window\.POKEMON_SETS = (\[.*\]);/s);
const EN = JSON.parse(m[1]);

// ---------------- TCGdex ----------------
const norm = (s) => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const PREFIX = /^(Pokémon TCG|Mega Evolution|Scarlet & Violet|Sword & Shield|Sun & Moon|XY|Black & White|HeartGold & SoulSilver|HS|Platinum|Diamond & Pearl|EX)\s*[:—–-]?\s+/i;
const ID_OVERRIDE = { 'HeartGold & SoulSilver': 'hgss1' };   // English site name -> TCGdex id, where the names differ
const NAME_FIX = { 'Dragons Éxaltés': 'Dragons Exaltés' };   // TCGdex typos
const capsNoAccent = (s) => s && s.replace(/\p{Lu}/gu, c => c.normalize('NFD').replace(/[̀-ͯ]/g, ''));   // "Écarlate" -> "Ecarlate"

let cache = fs.existsSync(CACHE) && !process.argv.includes('--refresh') ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : null;
if (!cache) {
  const en = await get('https://api.tcgdex.net/v2/en/sets');
  const frList = await get('https://api.tcgdex.net/v2/fr/sets');
  const fr = {};
  for (const s of frList) {
    const d = await get('https://api.tcgdex.net/v2/fr/sets/' + encodeURIComponent(s.id));
    if (d) { delete d.cards; fr[s.id] = d; }
    await sleep(150);
  }
  cache = { en: en.map(({ id, name }) => ({ id, name })), fr };
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  console.log('fetched TCGdex:', cache.en.length, 'en sets,', Object.keys(fr).length, 'fr sets');
}
const tcgByName = new Map(cache.en.map(t => [norm(t.name), t.id]));

// ---------------- Poképédia (fetch_pokepedia.mjs): French dates, logos, French sets TCGdex lacks ----------------
const PKP = JSON.parse(fs.readFileSync(path.join(HERE, 'pokepedia_fr.json'), 'utf8'));
const MOIS = { janvier: 1, 'février': 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, 'août': 8, septembre: 9, octobre: 10, novembre: 11, 'décembre': 12 };
function frDate(v) {   // "{{#time:d F Y|1999-11-18}}", "18 novembre 1999", "novembre 1999", "1999" -> ISO (as precise as the source)
  if (!v) return null;
  let m = v.match(/\d{4}-\d{2}(-\d{2})?/); if (m) return m[0];
  m = v.toLowerCase().match(/(?:(\d{1,2})(?:er)?\s+)?(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/);
  if (m) return m[3] + '-' + String(MOIS[m[2]]).padStart(2, '0') + (m[1] ? '-' + m[1].padStart(2, '0') : '');
  m = v.match(/^\s*(\d{4})\s*$/); return m ? m[1] : null;
}
// Poképédia names carry the era ("Méga-Évolution Règne Delta"); like TCGdex, the labels drop it
const ERA_FR = /^(Méga-Évolution|Écarlate et Violet|Épée et Bouclier|Soleil et Lune|XY|Noir & Blanc|HS|Platine|Diamant & Perle)\s+(?=\S)/;
const pkpName = (p) => {
  let n = (p['nom-affiché'] || p.nom || '').replace(/<sup>e<\/sup>/g, 'ᵉ').replace(/<[^>]+>|'{2,}|\[\[|\]\]/g, '').replace(/\s*\(JCC\)$/, '').replace(ERA_FR, '').trim();
  const year = (p.title || '').match(/\((\d{4})\)$/);   // "Combat Express (2022)" and "(2023)": same name, keep them apart
  return year && !n.includes(year[1]) ? n + ' ' + year[1] : n;
};
// Poképédia pages whose English name doesn't say which English set they are
const PKP_OVERRIDE = { 'Wizards Black Star Promos': 'Promo Wizards', "McDonald's Collection 2022": 'Combat Express (2022)', "McDonald's Collection 2023": 'Combat Express (2023)' };
const GENERIC_LOGO = PKP.find(p => p.generic_logo_url)?.generic_logo_url;   // plain "Pokémon" logo
const pkpByName = new Map(), pkpByNom = new Map(), pkpByAbbr = new Map();
for (const p of PKP) {
  if (!p.nom || /[぀-ヿ一-鿿]/.test(p.title)) continue;   // Japanese-only pages
  if (p.nomen) pkpByName.set(norm(p.nomen), p);
  pkpByNom.set(norm(p.nom.replace(/\s*\(JCC\)$/, '')), p); pkpByNom.set(norm(pkpName(p)), p);
  const ab = (p['abréviation'] || '').trim();
  if (ab) pkpByAbbr.set(ab, pkpByAbbr.has(ab) ? null : p);   // null: shared by several pages
}
const enAbbrCount = EN.reduce((m, s) => m.set(s.abbr, (m.get(s.abbr) || 0) + 1), new Map());
// English name, then the French name TCGdex gives, then the abbreviation when only one set on each side has it
const pkpFor = (s, f) => PKP.find(p => p.title === PKP_OVERRIDE[s.name]) || pkpByName.get(norm(s.name)) || pkpByName.get(norm(s.name.replace(PREFIX, '')))
  || (f && pkpByNom.get(norm(f.name))) || (s.abbr && enAbbrCount.get(s.abbr) === 1 && pkpByAbbr.get(s.abbr)) || null;

// ---------------- match ----------------
const FR = [], notFrench = [], unmatched = [], used = new Map(), englishDate = [], fromPkp = [], renamed = [];
fs.mkdirSync(LOGO_DIR, { recursive: true });
async function saveLogo(url, file) {   // cached: delete the file to refetch
  const full = path.join(LOGO_DIR, file);
  if (!fs.existsSync(full)) { const buf = await get(url, 'buf'); if (buf) fs.writeFileSync(full, buf); await sleep(150); }
  return fs.existsSync(full) ? 'img/logos/fr/' + file : null;
}
for (const s of EN) {
  const id = ID_OVERRIDE[s.name] || tcgByName.get(norm(s.name)) || tcgByName.get(norm(s.name.replace(PREFIX, '')));
  const f = id ? cache.fr[id] : null;
  const p = pkpFor(s, f);
  const date = p && frDate(p['date-france']);
  // printed in French if TCGdex lists it in French, or Poképédia gives a French release date
  if (!f && !date) { (id || p ? notFrench : unmatched).push(s.name); continue; }
  if (f) {
    if (used.has(id)) console.warn('!! TCGdex', id, 'matched twice:', used.get(id), '/', s.name);
    used.set(id, s.name);
  } else fromPkp.push(s.name);
  if (!date) englishDate.push(s.name);
  // name: Poképédia's (TCGdex's French names have typos: "Tempète Plasma", "Duels au Sommets", "Triomphant")
  // (unless Poképédia kept the English name and TCGdex has a translation: "POP Series 7" / "POP Série 7")
  const usePkp = p && pkpName(p) && !(f && norm(pkpName(p)) === norm(s.name) && norm(f.name) !== norm(s.name));
  const name = capsNoAccent(usePkp ? pkpName(p) : NAME_FIX[f.name] || f.name);
  if (f && usePkp && norm(pkpName(p)) !== norm(f.name)) renamed.push(f.name + ' -> ' + pkpName(p));
  // logo: TCGdex, else Poképédia's file; else the English one when the name is the same in both languages
  // ("Jungle", "Neo Genesis"); Set de Base never had one: the plain Pokémon logo; else the French name as text
  let logo = null;
  if (f && f.logo) logo = await saveLogo(f.logo + '.webp', s.slug + '.webp');
  if (!logo && p && p.logo_url) logo = await saveLogo(p.logo_url, s.slug + path.extname(new URL(p.logo_url).pathname).toLowerCase());
  if (!logo && norm(name) === norm(s.name)) logo = s.logo_img;
  if (!logo && s.slug === 'base-set' && GENERIC_LOGO) logo = await saveLogo(GENERIC_LOGO, 'pokemon.png');
  FR.push({
    name, name_en: s.name, series: s.series, series_native: capsNoAccent((f && f.serie && f.serie.name) || s.series),
    type: s.type, setno: s.setno, abbr: s.abbr, cards: s.cards, secret: s.secret, extras: s.extras || [],
    release: date || s.release, expno: null, subtype: '', symbol_img: null, en_slug: s.slug, logo_img: logo,
    printed2023: false, slug: 'fr-' + s.slug,
  });
}

// drop logo files no set uses any more
const keep = new Set(FR.map(s => s.logo_img).filter(Boolean).map(l => path.basename(l)));
fs.readdirSync(LOGO_DIR).filter(f => !keep.has(f)).forEach(f => fs.unlinkSync(path.join(LOGO_DIR, f)));

// One French era name per English era: the most common TCGdex "serie" among its sets
const eraVotes = {};
FR.forEach(s => { const v = (eraVotes[s.series] ||= {}); v[s.series_native] = (v[s.series_native] || 0) + 1; });
FR.forEach(s => { s.series_native = Object.entries(eraVotes[s.series]).sort((a, b) => b[1] - a[1])[0][0]; });

// Sequential expansion numbers in release order, main and special counted separately (like the other languages)
FR.sort((a, b) => (a.release || '').localeCompare(b.release || ''));
const n = { 'Main Series Expansion': 0, 'Special Expansion': 0 };
FR.forEach(s => { if (s.type in n) s.expno = ++n[s.type]; });

const payload = {
  lang: 'fr', label: 'Français · French', date: new Date().toISOString().slice(0, 10),
  source: 'English set data (counts, codes, symbols) with French names, release dates and logos from Poképédia and TCGdex',
  sets: FR,
};
fs.writeFileSync(path.join(PUBLIC, 'sets_fr.js'),
  'window.SLP_LANG = window.SLP_LANG || {};\nwindow.SLP_LANG["fr"] = ' + JSON.stringify(payload) + ';\n');

console.log('fr', FR.length, 'sets |', n['Main Series Expansion'], 'main,', n['Special Expansion'], 'special | French logos:',
  FR.filter(s => s.logo_img && s.logo_img.startsWith('img/logos/fr/')).length, '| English logos reused:',
  FR.filter(s => s.logo_img && !s.logo_img.startsWith('img/logos/fr/')).length, '| text logos:', FR.filter(s => !s.logo_img).length);
console.log('Not released in French (TCGdex and Poképédia):', notFrench.join(', '));
console.log('In French per Poképédia only:', fromPkp.join(', '));
console.log('Poképédia name over TCGdex:', renamed.join(' | '));
console.log('No French date on Poképédia, English date kept:', englishDate.join(', '));
console.log('No TCGdex match (add to ID_OVERRIDE if it exists):', unmatched.join(', '));
