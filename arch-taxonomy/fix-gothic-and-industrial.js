/**
 * fix-gothic-and-industrial.js
 * 1. Replace gothic/2.jpg (Victorian house — wrong for medieval Gothic)
 * 2. Replace gothic-revival/1.jpg (diagram, not a building)
 * 3. Replace gothic-revival/4.jpg (same house as gothic/2)
 * 4. Scrape american-industrial-vernacular (new style)
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');

const PREFERRED_SOURCES = [
  'archdaily','dezeen','architectural','architizer','designboom','archpaper',
  'wikimedia','commons.wiki','galinsky','greatbuildings','architecture.com',
  'archinect','architecturaldigest','arch2o','e-architect','archello',
];
const BLOCKED_SOURCES = [
  'dreamstime','alamy','shutterstock','vecteezy','gettyimages','istockphoto',
  'depositphotos','123rf','stockadobe','adobe.stock','bigstockphoto',
  'stablediffusion','archsynth','freepik','ebay','amazon','walmart',
  'facebook','reddit','youtube','tiktok','pinterest',
];
const BLOCKED_EXTS = ['.gif','.svg','.webm','.mp4'];

function scoreImage(img) {
  let score = 0;
  const ratio = img.height / img.width;
  if (ratio >= 0.5 && ratio <= 1.5) score += 20;
  if (ratio < 0.35 || ratio > 2.2)  score -= 20;
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
      let body = ''; res.on('data', d => body += d);
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

async function bestFromQuery(query, excludeUrls = new Set()) {
  console.log(`  searching: "${query}"`);
  try {
    const results = await searchDDG(query);
    const scored = results
      .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)) && !excludeUrls.has(img.image))
      .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }))
      .filter(img => img.score > 0)
      .sort((a, b) => b.score - a.score);
    console.log(`    ${results.length} results → ${scored.length} viable`);
    return scored;
  } catch (e) {
    console.log(`    error: ${e.message}`);
    return [];
  }
}

async function downloadBest(candidates, dest) {
  for (const c of candidates.slice(0, 30)) {
    try {
      await downloadImage(c.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      console.log(`  ✓ ${Math.round(stat.size/1024)}KB score=${c.score} ${c.image.slice(0,70)}`);
      return true;
    } catch (e) {
      console.log(`  err: ${e.message.slice(0,50)}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
    await sleep(200);
  }
  console.log(`  ✗ FAILED`);
  return false;
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

  // ── Fix gothic/2.jpg — replace Victorian house with real medieval Gothic ──
  console.log('\n══ gothic/2 — replace Victorian house with medieval Gothic ══');
  fs.unlinkSync(path.join(OUT_DIR, 'gothic/2.jpg'));
  let candidates = await bestFromQuery('salisbury cathedral gothic exterior nave photo architecture');
  await sleep(800);
  candidates.push(...await bestFromQuery('wells cathedral gothic exterior west facade stonework photo'));
  await sleep(800);
  candidates = candidates.sort((a,b) => b.score - a.score);
  await downloadBest(candidates, path.join(OUT_DIR, 'gothic/2.jpg'));

  // ── Fix gothic-revival/1.jpg — replace diagram with real building ──
  console.log('\n══ gothic-revival/1 — replace diagram with Houses of Parliament ══');
  fs.unlinkSync(path.join(OUT_DIR, 'gothic-revival/1.jpg'));
  candidates = await bestFromQuery('houses of parliament westminster palace gothic revival exterior river photo');
  await sleep(800);
  candidates.push(...await bestFromQuery('palace of westminster gothic revival architecture exterior photo'));
  await sleep(800);
  candidates = candidates.sort((a,b) => b.score - a.score);
  await downloadBest(candidates, path.join(OUT_DIR, 'gothic-revival/1.jpg'));

  // ── Fix gothic-revival/4.jpg — replace duplicate house with different building ──
  console.log('\n══ gothic-revival/4 — replace with gothic revival university building ══');
  fs.unlinkSync(path.join(OUT_DIR, 'gothic-revival/4.jpg'));
  candidates = await bestFromQuery('oxford university gothic revival architecture exterior quadrangle photo');
  await sleep(800);
  candidates.push(...await bestFromQuery('keble college oxford gothic revival polychrome brick exterior photo'));
  await sleep(800);
  candidates = candidates.sort((a,b) => b.score - a.score);
  await downloadBest(candidates, path.join(OUT_DIR, 'gothic-revival/4.jpg'));

  // Update gothic manifest
  manifest['gothic'] = fs.readdirSync(path.join(OUT_DIR, 'gothic'))
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort((a,b) => parseInt(a)-parseInt(b))
    .map(f => `images/gothic/${f}`);
  manifest['gothic-revival'] = fs.readdirSync(path.join(OUT_DIR, 'gothic-revival'))
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort((a,b) => parseInt(a)-parseInt(b))
    .map(f => `images/gothic-revival/${f}`);

  // ── Scrape american-industrial-vernacular (new style) ──
  console.log('\n══ american-industrial-vernacular (new) ══');
  const aivDir = path.join(OUT_DIR, 'american-industrial-vernacular');
  ensureDir(aivDir);

  const aivQueries = [
    // slot 1: large warehouse/factory — the canonical multi-story brick block
    'midwest brick warehouse building industrial loft multi story exterior photo',
    // slot 2: street-level view of a brick commercial district
    'historic brick commercial district downtown indiana ohio street architecture photo',
    // slot 3: small brick storefront commercial building cast iron facade
    'victorian brick commercial storefront building small town midwest exterior photo',
    // slot 4: interior showing heavy timber and cast iron columns
    'brick warehouse interior heavy timber cast iron columns loft industrial photo',
    // slot 5: converted loft building showing reuse — the style's modern legacy
    'brick loft apartment building converted warehouse exterior urban photo',
  ];

  const seenUrls = new Set();
  const byQuery = {};
  for (let qi = 0; qi < aivQueries.length; qi++) {
    await sleep(qi > 0 ? 800 : 0);
    const results = await bestFromQuery(aivQueries[qi], seenUrls);
    results.forEach(r => seenUrls.add(r.image));
    byQuery[qi] = results;
  }

  const picked = [];
  const usedImgs = new Set();
  for (let qi = 0; qi < aivQueries.length && picked.length < 5; qi++) {
    const best = (byQuery[qi] || []).find(c => !usedImgs.has(c.image));
    if (best) { picked.push({ ...best, qi }); usedImgs.add(best.image); }
  }
  const allPool = Object.values(byQuery).flat().filter(c => !usedImgs.has(c.image)).sort((a,b) => b.score-a.score);
  for (const c of allPool) {
    if (picked.length >= 5) break;
    picked.push(c); usedImgs.add(c.image);
  }

  const aivSaved = [];
  for (const candidate of picked) {
    const ext = (candidate.image.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0].toLowerCase().replace('jpeg','jpg');
    const idx = aivSaved.length + 1;
    const dest = path.join(aivDir, `${idx}${ext}`);
    try {
      await downloadImage(candidate.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      aivSaved.push(`images/american-industrial-vernacular/${idx}${ext}`);
      console.log(`  [${idx}] q${(candidate.qi??'?')+1} ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0,70)}`);
    } catch (e) {
      console.log(`  [${idx}] err: ${e.message.slice(0,60)}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
    await sleep(300);
  }
  console.log(`  → ${aivSaved.length}/5 saved`);
  manifest['american-industrial-vernacular'] = aivSaved;

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest updated.');
})().catch(err => { console.error(err); process.exit(1); });
