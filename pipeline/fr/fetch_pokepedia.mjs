// Poképédia (the French Pokémon wiki): the infobox of every TCG expansion page -> pokepedia_fr.json
// Gives French release dates, logo file names, and French sets TCGdex doesn't list yet.
//   node fetch_pokepedia.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://www.pokepedia.fr/api.php?format=json&formatversion=2&';
const UA = { 'User-Agent': 'SetLabelPress/1.0 (personal fan tool)' };
const enc = encodeURIComponent;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(url) {
  let err;
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(r.status + ' ' + url); return await r.json(); }
    catch (e) { err = e; await sleep(2000 * (a + 1)); }
  }
  throw err;
}

// every article that uses {{Infobox Extension}}
const titles = [];
let cont = '';
do {
  const j = await get(API + 'action=query&list=embeddedin&eititle=' + enc('Modèle:Infobox Extension') + '&einamespace=0&eilimit=500' + cont);
  titles.push(...j.query.embeddedin.map(e => e.title));
  cont = j.continue ? '&eicontinue=' + enc(j.continue.eicontinue) : '';
} while (cont);
if (titles.length < 100) throw new Error('only ' + titles.length + ' expansion pages found: not overwriting pokepedia_fr.json');

// "| key=value" lines of the infobox
function infobox(text) {
  const start = text.indexOf('{{Infobox Extension');
  if (start < 0) return null;
  const out = {};
  for (const line of text.slice(start).split('\n').slice(1)) {
    if (/^\s*\}\}/.test(line)) break;
    const m = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const pages = [];
for (let i = 0; i < titles.length; i += 50) {
  const j = await get(API + 'action=query&prop=revisions&rvprop=content&rvslots=main&titles=' + enc(titles.slice(i, i + 50).join('|')));
  for (const p of j.query.pages) {
    const box = p.revisions && infobox(p.revisions[0].slots.main.content);
    if (box) pages.push({ title: p.title, ...box });
  }
  await sleep(300);
}

// logo files: "Logo <nom> JCC.png" (or the file the infobox names). Tried even when the infobox says logo=non:
// some pages lag behind their files. Plus the plain "Pokémon" logo for sets that never had one (Set de Base).
const GENERIC = 'Fichier:Logo Pokémon.png';
const want = [GENERIC, ...pages.filter(p => p.nom).map(p => {
  p.logo_file = 'Fichier:' + (p.logo && !['oui', 'non'].includes(p.logo) ? p.logo : 'Logo ' + p.nom + ' JCC.png');
  return p.logo_file;
})];
const urls = {};
for (let i = 0; i < want.length; i += 50) {
  // originals run to several MB: take the wiki's 700 px rendition (a 55 mm logo at 300 dpi) when it's wider
  const j = await get(API + 'action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=700&titles=' + enc(want.slice(i, i + 50).join('|')));
  for (const p of j.query.pages) if (p.imageinfo) urls[p.title] = p.imageinfo[0].thumburl || p.imageinfo[0].url;
  (j.query.normalized || []).forEach(n => { if (urls[n.to]) urls[n.from] = urls[n.to]; });
  await sleep(300);
}
pages.forEach(p => { p.logo_url = (p.logo_file && urls[p.logo_file]) || null; });

pages.unshift({ title: '(generic)', generic_logo_url: urls[GENERIC] || null });
fs.writeFileSync(path.join(HERE, 'pokepedia_fr.json'), JSON.stringify(pages, null, 1));
console.log(pages.length - 1, 'expansion infoboxes,', pages.filter(p => p.logo_url).length, 'with a logo file');
