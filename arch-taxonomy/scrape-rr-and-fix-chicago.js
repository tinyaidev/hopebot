/**
 * scrape-rr-and-fix-chicago.js
 * 1. Scrape Richardsonian Romanesque (new style)
 * 2. Replace Chicago School images with better scale variety
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

// Per-slot queries: each query targets a distinct building scale/type
const STYLES = [
  {
    id: 'richardsonian-romanesque',
    // slot 1: large civic/religious landmark
    // slot 2: residential (Glessner House — Richardson's own residential masterwork)
    // slot 3: small public building (Richardson's library series)
    // slot 4: commercial warehouse — the Midwest brick industrial aesthetic
    // slot 5: another civic building at a different scale
    queries: [
      'trinity church boston richardson romanesque exterior architecture photo',
      'glessner house chicago richardson romanesque residential exterior photo',
      'crane memorial library quincy richardson romanesque small exterior photo',
      'richardsonian romanesque brick warehouse commercial building midwest exterior photo',
      'allegheny county courthouse pittsburgh richardson romanesque exterior photo',
    ],
  },
  {
    id: 'chicago-school',
    // slot 1: large commercial tower (Reliance, Monadnock)
    // slot 2: Sullivan jewel-box bank — small civic, his late career masterworks
    // slot 3: mid-size commercial block with Chicago windows
    // slot 4: ornamental detail / terra-cotta close-up (Sullivan's signature)
    // slot 5: the Rookery interior — shows the transition from masonry to metal
    queries: [
      'monadnock building chicago school exterior masonry skyscraper photo',
      'louis sullivan national farmers bank owatonna jewel box exterior photo',
      'chicago school mid rise commercial building terra cotta chicago windows exterior photo',
      'louis sullivan ornament terra cotta chicago school detail architecture photo',
      'rookery building chicago burnham root interior light court photo',
    ],
  },
];

async function scrapeStyle(style) {
  const styleDir = path.join(OUT_DIR, style.id);
  ensureDir(styleDir);

  // Wipe existing images
  fs.readdirSync(styleDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .forEach(f => fs.unlinkSync(path.join(styleDir, f)));

  const seenUrls = new Set();
  const byQuery = {};

  for (let qi = 0; qi < style.queries.length; qi++) {
    const query = style.queries[qi];
    console.log(`  [q${qi+1}] "${query}"`);
    try {
      const results = await searchDDG(query);
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)) && !seenUrls.has(img.image))
        .map(img => { seenUrls.add(img.image); return { ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }; })
        .filter(img => img.score > 0)
        .sort((a, b) => b.score - a.score);
      console.log(`       ${results.length} results → ${scored.length} viable`);
      byQuery[qi] = scored;
    } catch (e) {
      console.log(`       error: ${e.message}`);
      byQuery[qi] = [];
    }
    await sleep(800);
  }

  // Pick best from each query bucket first, then fill by score
  const picked = [];
  const usedImgs = new Set();
  for (let qi = 0; qi < style.queries.length && picked.length < 5; qi++) {
    const best = (byQuery[qi] || []).find(c => !usedImgs.has(c.image));
    if (best) { picked.push({ ...best, qi }); usedImgs.add(best.image); }
  }
  // Fill any remaining from global pool
  const allCandidates = Object.values(byQuery).flat().filter(c => !usedImgs.has(c.image)).sort((a,b) => b.score - a.score);
  for (const c of allCandidates) {
    if (picked.length >= 5) break;
    picked.push(c); usedImgs.add(c.image);
  }

  const saved = [];
  for (const candidate of picked) {
    const ext = (candidate.image.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0].toLowerCase().replace('jpeg','jpg');
    const idx = saved.length + 1;
    const dest = path.join(styleDir, `${idx}${ext}`);
    try {
      await downloadImage(candidate.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      saved.push(`images/${style.id}/${idx}${ext}`);
      console.log(`  [${idx}] q${(candidate.qi??'?')+1} ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0,70)}`);
    } catch (e) {
      console.log(`  [${idx}] err: ${e.message.slice(0,60)}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
    await sleep(300);
  }
  console.log(`  → ${saved.length}/5 saved`);
  return saved;
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

  for (const style of STYLES) {
    console.log(`\n══ ${style.id} ══`);
    manifest[style.id] = await scrapeStyle(style);
    await sleep(1500);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest updated.');
  for (const style of STYLES) {
    console.log(`  ${style.id}: ${manifest[style.id]?.length ?? 0}/5`);
  }
})().catch(err => { console.error(err); process.exit(1); });
