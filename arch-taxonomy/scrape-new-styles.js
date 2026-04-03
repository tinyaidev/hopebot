/**
 * scrape-new-styles.js — Images for 11 new arch-taxonomy styles
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');
const IMAGES_PER_STYLE = 5;

const PREFERRED_SOURCES = [
  'archdaily', 'dezeen', 'architectural', 'architizer', 'designboom',
  'archpaper', 'wikimedia', 'commons.wiki', 'galinsky', 'greatbuildings',
  'architecture.com', 'archinect', 'docomomo', 'architecturemedia',
  'architecturaldigest', 'arch2o', 'parametric-architecture', 'e-architect',
];
const BLOCKED_SOURCES = [
  'dreamstime','alamy','shutterstock','vecteezy','gettyimages','istockphoto',
  'depositphotos','123rf','stockadobe','adobe.stock','bigstockphoto',
  'stablediffusion','archsynth','ebay','amazon','walmart',
  'facebook','reddit','youtube','tiktok','pinterest','freepik',
];
const BLOCKED_EXTS = ['.gif','.svg','.webm','.mp4'];

function scoreImage(img) {
  let score = 0;
  const ratio = img.height / img.width;
  if (ratio >= 0.5 && ratio <= 1.4) score += 20;
  if (ratio < 0.4 || ratio > 2.2)   score -= 20;
  const px = img.width * img.height;
  if (px > 600000) score += 15;
  if (px > 300000) score += 10;
  if (px < 40000)  score -= 30;
  const src = (img.source || img.url || '').toLowerCase();
  if (PREFERRED_SOURCES.some(s => src.includes(s))) score += 35;
  if (BLOCKED_SOURCES.some(s => src.includes(s)))   score -= 60;
  if (img.url.match(/\.(jpg|jpeg)$/i)) score += 5;
  if (img.url.match(/\.(png)$/i))      score += 3;
  if (BLOCKED_EXTS.some(e => img.url.toLowerCase().endsWith(e))) score -= 100;
  if (src.includes('wikimedia') || src.includes('commons.wiki')) score += 20;
  return score;
}

function httpGet(reqUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib.get(reqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', ...headers },
      timeout: 15000,
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function searchDDG(query) {
  const r = await httpGet(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const m = r.body.match(/vqd=([\d-]+)/);
  if (!m) throw new Error('No VQD token');
  const r2 = await httpGet(
    `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd=${m[1]}`,
    { Referer: 'https://duckduckgo.com/' }
  );
  if (r2.status !== 200) throw new Error(`DDG status ${r2.status}`);
  return JSON.parse(r2.body).results || [];
}

function downloadImage(imgUrl, dest) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(imgUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(dest);
    lib.get(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36', 'Referer': 'https://duckduckgo.com/' },
      timeout: 20000,
    }, res => {
      if ([301,302,307,308].includes(res.statusCode)) { file.close(); fs.unlinkSync(dest); downloadImage(res.headers.location, dest).then(resolve).catch(reject); return; }
      if (res.statusCode !== 200) { file.close(); try{fs.unlinkSync(dest)}catch(e){}; return reject(new Error(`HTTP ${res.statusCode}`)); }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/') && !ct.startsWith('application/octet')) { file.close(); try{fs.unlinkSync(dest)}catch(e){}; return reject(new Error(`Not image: ${ct}`)); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { file.close(); try{fs.unlinkSync(dest)}catch(_){} reject(err); })
      .on('timeout', () => { reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

async function scrapeStyle(style) {
  const styleDir = path.join(OUT_DIR, style.id);
  ensureDir(styleDir);

  const existing = fs.readdirSync(styleDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (existing.length >= IMAGES_PER_STYLE) {
    console.log(`  [${style.id}] already complete (${existing.length} images)`);
    return existing.map(f => `images/${style.id}/${f}`);
  }

  let candidates = [];
  for (const query of style.queries) {
    console.log(`  searching: "${query}"`);
    try {
      const results = await searchDDG(query);
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
        .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }))
        .filter(img => img.score > 0)
        .sort((a, b) => b.score - a.score);
      console.log(`    ${results.length} results → ${scored.length} viable (top: ${scored[0]?.score ?? 'n/a'})`);
      candidates.push(...scored);
    } catch (e) {
      console.log(`    error: ${e.message}`);
    }
    await sleep(800);
  }

  const seen = new Set();
  candidates = candidates.filter(c => {
    if (seen.has(c.image)) return false;
    seen.add(c.image); return true;
  }).sort((a, b) => b.score - a.score);

  console.log(`  ${candidates.length} unique candidates, downloading top ${IMAGES_PER_STYLE}…`);
  const saved = [];
  for (const candidate of candidates) {
    if (saved.length >= IMAGES_PER_STYLE) break;
    const ext = (candidate.image.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0].toLowerCase().replace('jpeg','jpg');
    const idx = saved.length + 1;
    const dest = path.join(styleDir, `${idx}${ext}`);
    try {
      await downloadImage(candidate.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      saved.push(`images/${style.id}/${idx}${ext}`);
      console.log(`    [${idx}] ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0,70)}`);
    } catch (e) {
      console.log(`    [${idx}] err: ${e.message.slice(0,60)}`);
    }
    await sleep(300);
  }
  console.log(`  → ${saved.length}/${IMAGES_PER_STYLE} saved`);
  return saved;
}

const STYLES = [
  { id: 'byzantine', queries: [
    'hagia sophia interior byzantine architecture dome mosaic photo',
    'byzantine church interior gold mosaic dome Constantinople architecture photo',
    'ravenna byzantine mosaic church interior architecture photo',
  ]},
  { id: 'gothic-revival', queries: [
    'houses of parliament westminster gothic revival architecture exterior photo',
    'victorian gothic revival church exterior architecture photo england',
    'gothic revival university building exterior pointed arches stonework photo',
  ]},
  { id: 'beaux-arts', queries: [
    'grand central terminal new york beaux arts architecture interior photo',
    'beaux arts building classical columns sculpture civic architecture exterior photo',
    'paris opera garnier beaux arts architecture exterior photo',
  ]},
  { id: 'french-renaissance', queries: [
    'chateau de chambord french renaissance architecture exterior photo loire valley',
    'chateau de chenonceau french renaissance architecture exterior photo',
    'chateau azay le rideau french renaissance exterior reflection photo',
  ]},
  { id: 'english-arts-crafts', queries: [
    'arts and crafts house architecture exterior brick england lutyens photo',
    'arts crafts movement architecture red brick cottage garden exterior photo',
    'philip webb red house arts crafts architecture exterior photo',
  ]},
  { id: 'spanish-colonial', queries: [
    'california mission architecture exterior adobe tile roof photo',
    'spanish colonial mission santa barbara architecture exterior photo',
    'spanish colonial revival architecture exterior california stucco tile photo',
  ]},
  { id: 'chicago-school', queries: [
    'chicago school architecture sullivan building exterior terracotta photo',
    'louis sullivan auditorium building chicago school architecture ornament photo',
    'reliance building chicago school steel frame architecture exterior photo',
  ]},
  { id: 'german-expressionism', queries: [
    'einstein tower mendelsohn potsdam expressionist architecture exterior photo',
    'chilehaus hamburg german expressionism brick architecture exterior photo',
    'german expressionist architecture 1920s brick building exterior photo',
  ]},
  { id: 'russian-constructivism', queries: [
    'melnikov house moscow russian constructivism architecture exterior photo',
    'narkomfin building moscow constructivist architecture exterior photo',
    'russian constructivism architecture soviet avant garde building exterior photo',
  ]},
  { id: 'nordic-modernism', queries: [
    'alvar aalto architecture exterior finland nordic modernism photo',
    'scandinavian modernism architecture natural materials brick wood building exterior photo',
    'jorn utzon danish architecture nordic modernism exterior photo',
  ]},
  { id: 'brazilian-modernism', queries: [
    'oscar niemeyer brasilia architecture exterior concrete curves photo',
    'national congress brasilia niemeyer brazilian modernism architecture photo',
    'brazilian modernism architecture niemeyer concrete pilotis exterior photo',
  ]},
];

(async () => {
  ensureDir(OUT_DIR);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

  for (const style of STYLES) {
    console.log(`\n══ ${style.id} ══`);
    manifest[style.id] = await scrapeStyle(style);
    await sleep(1200);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n\nDone. Manifest written.');

  const newIds = STYLES.map(s => s.id);
  const total = newIds.reduce((n, id) => n + (manifest[id]?.length || 0), 0);
  console.log(`New styles: ${total}/${STYLES.length * IMAGES_PER_STYLE}`);
  for (const id of newIds) {
    console.log(`  ${id}: ${manifest[id]?.length ?? 0}`);
  }
})().catch(err => { console.error(err); process.exit(1); });
