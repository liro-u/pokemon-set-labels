// Local server for public/, this machine only: node scripts/serve.mjs [port]
// Besides the static files it runs the data pipelines for the page's "Update data" button:
//   GET  /api/update          -> { running, job, log, ok, finished }
//   POST /api/update?what=en|fr|all
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(ROOT_DIR, 'public');
const PIPE = path.join(ROOT_DIR, 'pipeline');
const PORT = Number(process.argv[2]) || 8000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

// ---------------- data update jobs ----------------
// Python: $PYTHON, else the py launcher / user install from python.org, else whatever "python" is on the PATH
function python() {
  const local = process.env.LOCALAPPDATA || '';
  const cands = [process.env.PYTHON, path.join(local, 'Programs', 'Python', 'Launcher', 'py.exe'), path.join(local, 'Programs', 'Python', 'Python312', 'python.exe')];
  const hit = cands.find(c => c && fs.existsSync(c));
  return hit ? (hit.endsWith('py.exe') ? [hit, '-3'] : [hit]) : ['python'];
}
const node = process.execPath;
const STEPS = {   // French is built on top of the English sets.js, so an English update rebuilds it too
  en: [[...python(), 'update_en.py', '@pipeline'], [node, 'build_fr.mjs', '@fr']],
  fr: [[node, 'fetch_pokepedia.mjs', '@fr'], [node, 'build_fr.mjs', '--refresh', '@fr']],
};
STEPS.all = [STEPS.en[0], ...STEPS.fr];
const LABEL = { en: 'English', fr: 'French', all: 'English + French' };

let job = { running: false, job: null, log: '', ok: null, finished: null };
function runJob(what) {
  job = { running: true, job: LABEL[what], log: '', ok: null, finished: null };
  const say = (s) => { job.log = (job.log + s).slice(-60000); };
  const steps = STEPS[what].slice();
  const next = () => {
    const step = steps.shift();
    if (!step) { job.running = false; job.ok = true; job.finished = new Date().toISOString(); say('\nDone.\n'); return; }
    const where = step[step.length - 1] === '@fr' ? path.join(PIPE, 'fr') : PIPE;
    const [cmd, ...args] = step.slice(0, -1);
    say('\n> ' + path.basename(cmd) + ' ' + args.join(' ') + '\n');
    const p = spawn(cmd, args, { cwd: where, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }, windowsHide: true });
    p.stdout.on('data', d => say(d.toString()));
    p.stderr.on('data', d => say(d.toString()));
    p.on('error', e => { say('\n' + e.message + '\n'); fail(); });
    p.on('close', code => { if (!job.running) return; code === 0 ? next() : (say('\nFailed (exit ' + code + ').\n'), fail()); });
  };
  const fail = () => { job.running = false; job.ok = false; job.finished = new Date().toISOString(); };
  next();
}

function api(req, res) {
  const u = new URL(req.url, 'http://x');
  const send = (code, obj) => res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(obj));
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '')) return send(403, { error: 'host' });   // DNS rebinding
  if (req.method === 'GET') return send(200, job);
  if (req.method !== 'POST') return send(405, { error: 'method' });
  // only the page itself may start a job (a web page elsewhere can't, its Origin differs)
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)) return send(403, { error: 'origin' });
  const what = u.searchParams.get('what');
  if (!STEPS[what]) return send(400, { error: 'what = en, fr or all' });
  if (job.running) return send(409, job);
  runJob(what); send(202, job);
}

// ---------------- static files ----------------
function handle(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (rel === '/api/update') return api(req, res);
  let file = path.join(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }   // no ../ escapes
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    // no-cache: freshly rebuilt data shows up on a plain reload
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// IPv4 and IPv6 loopback: "localhost" tries ::1 first, and without it every request waits ~2 s for the fallback
http.createServer(handle).listen(PORT, '127.0.0.1', () => console.log('Serving ' + ROOT + ' on http://localhost:' + PORT));
http.createServer(handle).on('error', () => {}).listen(PORT, '::1');   // no IPv6 on this machine: IPv4 alone is fine
