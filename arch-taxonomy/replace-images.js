/**
 * replace-images.js — Targeted replacements for bad arch-taxonomy images
 * Bad images: watermarked (dreamstime/alamy/shutterstock), AI renders, vector illustrations
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');

const PREFERRED_SOURCES = [
  'archdaily', 'dezeen', 'architectural', 'architizer', 'designboom',
  'archpaper', 'wikimedia', 'commons.wiki', 'galinsky', 'greatbuildings',
  'architecture.com', 'archinect', 'docomomo', 'architecturemedia',
  'architecturaldigest', 'arch2o', 'parametric-architecture',
];
const BLOCKED_SOURCES = [
  'dreamstime','alamy','shutterstock','vecteezy','gettyimages','istockphoto',
  'depositphotos','123rf','stockadobe','adobe.stock','bigstockphoto',
  'stablediffusion','archsynth','ebay','amazon','walmart',
  'facebook','reddit','youtube','tiktok','pinterest',
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
  if (!m) throw new Error('No VQD');
  const r2 = await httpGet(`https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd=${m[1]}`, { Referer: 'https://duckduckgo.com/' });
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

// Each entry: styleId, slot (1-based file number), ext (default jpg), queries[]
const REPLACEMENTS = [
  // Greek Classical: /5 dreamstime watermark
  { styleId: 'greek-classical', slot: 5, queries: ['parthenon athens columns exterior architecture archdaily photo', 'acropolis athens greek temple ruins photo architecture'] },

  // Romanesque: /2 dreamstime, /3 alamy, /4 illustration, /5 alamy
  { styleId: 'romanesque', slot: 2, queries: ['romanesque church exterior stone arcades round arches architecture photo real building'] },
  { styleId: 'romanesque', slot: 3, queries: ['romanesque cathedral interior nave arcade pillar stone architecture photo'] },
  { styleId: 'romanesque', slot: 4, queries: ['speyer cathedral romanesque exterior germany photo architecture', 'pisa cathedral romanesque architecture exterior photo'] },
  { styleId: 'romanesque', slot: 5, queries: ['cluny abbey romanesque architecture france exterior stone photo', 'durham cathedral romanesque exterior architecture photo'] },

  // Gothic: /3 Leemage watermark
  { styleId: 'gothic', slot: 3, queries: ['gothic cathedral interior vaulted nave stained glass archdaily photo', 'chartres cathedral gothic interior architecture photo'] },

  // Renaissance: /2 alamy engraving, /5 old book illustration
  { styleId: 'renaissance', slot: 2, queries: ['florence cathedral brunelleschi dome exterior renaissance architecture photo', 'palazzo vecchio florence renaissance architecture photo'] },
  { styleId: 'renaissance', slot: 5, queries: ['tempietto bramante rome renaissance architecture exterior photo', 'villa rotonda palladio renaissance architecture exterior photo'] },

  // Baroque: /4 and /5 AI fantastical images
  { styleId: 'baroque', slot: 4, queries: ['st peters basilica rome baroque architecture exterior photo', 'trevi fountain rome baroque architecture photo'] },
  { styleId: 'baroque', slot: 5, queries: ['borromini san carlo alle quattro fontane baroque rome photo', 'bernini colonnade st peters square rome baroque photo'] },

  // Neoclassical: /1 3D render, /4 vecteezy, /5 vecteezy
  { styleId: 'neoclassical', slot: 1, queries: ['us capitol building neoclassical architecture exterior photo', 'pantheon paris neoclassical architecture exterior photo'] },
  { styleId: 'neoclassical', slot: 4, ext: 'jpg', queries: ['british museum neoclassical columns portico exterior photo', 'bank of england neoclassical architecture exterior london photo'] },
  { styleId: 'neoclassical', slot: 5, ext: 'jpg', queries: ['thomas jefferson monticello neoclassical architecture exterior photo', 'white house neoclassical architecture columns exterior photo'] },

  // Art Nouveau: /5 AI-generated
  { styleId: 'art-nouveau', slot: 5, queries: ['victor horta brussels art nouveau house facade exterior photo', 'art nouveau building riga latvia facade ornament photo'] },

  // Art Deco: /2 dreamstime isolated on white, /3 vecteezy illustration
  { styleId: 'art-deco', slot: 2, queries: ['chrysler building new york art deco eagle gargoyle exterior photo', 'empire state building art deco exterior photo new york'] },
  { styleId: 'art-deco', slot: 3, queries: ['miami beach art deco architecture exterior building photo', 'art deco theatre cinema building exterior architecture photo real'] },

  // Bauhaus: /2 dreamstime watermark
  { styleId: 'bauhaus', slot: 2, queries: ['bauhaus dessau gropius architecture exterior glass workshop photo', 'bauhaus building masters houses dessau exterior photo'] },

  // International Style: /3 alamy watermark
  { styleId: 'international-style', slot: 3, queries: ['lever house new york glass curtain wall international style photo', 'lake shore drive apartments mies van der rohe exterior photo'] },

  // Mid-Century Modern: /3 dreamstime AI
  { styleId: 'mid-century-modern', slot: 3, queries: ['case study house julius shulman exterior mid century modern photo', 'neutra kaufmann desert house palm springs exterior photo'] },

  // High-Tech: /2 adobe stock AI render
  { styleId: 'high-tech', slot: 2, queries: ['lloyd building london high tech architecture exterior rogers photo', 'norman foster hong kong hsbc building exterior high tech photo'] },

  // Postmodernism: /1 alamy watermark
  { styleId: 'postmodernism', slot: 1, queries: ['AT&T sony building philip johnson postmodern architecture new york photo', 'portland building michael graves postmodern architecture exterior photo'] },

  // Deconstructivism: /5 alamy watermark
  { styleId: 'deconstructivism', slot: 5, queries: ['jewish museum berlin libeskind deconstructivist architecture exterior photo', 'vitra fire station zaha hadid deconstructivist architecture photo'] },

  // Minimalism: /1 shutterstock AI watermark, /3 stablediffusion watermark
  { styleId: 'minimalism-arch', slot: 1, queries: ['tadao ando church of light osaka minimalist architecture photo interior', 'peter zumthor therme vals minimalist architecture stone bath photo'] },
  { styleId: 'minimalism-arch', slot: 3, queries: ['john pawson minimalist architecture interior light concrete photo', 'tadao ando museum minimalist concrete architecture exterior photo'] },

  // Parametric: /5 SketchUp render
  { styleId: 'parametric', slot: 5, queries: ['CCTV building beijing rem koolhaas parametric architecture exterior photo', 'guangzhou opera house zaha hadid parametric architecture exterior photo'] },
];

async function replaceOne(rep) {
  const ext = rep.ext || 'jpg';
  const styleDir = path.join(OUT_DIR, rep.styleId);
  // Remove old file (try both .jpg and .png extensions for neoclassical slots)
  for (const oldExt of ['jpg','png','webp']) {
    const oldPath = path.join(styleDir, `${rep.slot}.${oldExt}`);
    if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); console.log(`  removed old ${rep.slot}.${oldExt}`); }
  }
  const dest = path.join(styleDir, `${rep.slot}.${ext}`);

  let candidates = [];
  for (const query of rep.queries) {
    console.log(`  searching: "${query}"`);
    try {
      const results = await searchDDG(query);
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
        .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }))
        .filter(img => img.score > 0)
        .sort((a, b) => b.score - a.score);
      console.log(`    ${results.length} results → ${scored.length} viable`);
      candidates.push(...scored);
    } catch (e) { console.log(`    error: ${e.message}`); }
    await sleep(800);
  }

  const seen = new Set();
  candidates = candidates.filter(c => { if (seen.has(c.image)) return false; seen.add(c.image); return true; })
    .sort((a, b) => b.score - a.score);

  for (const c of candidates.slice(0, 30)) {
    try {
      await downloadImage(c.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      console.log(`  ✓ ${Math.round(stat.size/1024)}KB score=${c.score} ${c.image.slice(0,80)}`);
      return true;
    } catch (e) {
      console.log(`  err: ${e.message.slice(0,60)}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
    await sleep(300);
  }
  console.log(`  ✗ FAILED`);
  return false;
}

(async () => {
  for (const rep of REPLACEMENTS) {
    console.log(`\n══ ${rep.styleId}/${rep.slot} ══`);
    await replaceOne(rep);
    await sleep(1200);
  }

  // Update manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));
  const styleIds = [...new Set(REPLACEMENTS.map(r => r.styleId))];
  for (const id of styleIds) {
    const dir = path.join(OUT_DIR, id);
    manifest[id] = fs.readdirSync(dir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(f => `images/${id}/${f}`);
  }
  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest updated.');
})().catch(err => { console.error(err); process.exit(1); });
