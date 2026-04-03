/**
 * scrape-scale-variety.js — Rebuild all 31 styles with deliberate scale variety
 * Each style targets: landmark/civic, residential house, small commercial/civic,
 * medium urban, interior or alternate angle.
 * Also fixes German Expressionism and Brazilian Modernism duplicates.
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
  'architecturaldigest', 'arch2o', 'e-architect', 'archello',
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

// Each style has 5 queries targeting different scales/types.
// Order: [large civic/landmark, residential house, small commercial or civic, medium urban, interior/detail or 2nd landmark]
const STYLES = [
  { id: 'greek-classical', queries: [
    'parthenon athens exterior ancient greek temple architecture photo',
    'greek revival house residential exterior columns portico photo',
    'greek revival small bank courthouse portico columns exterior photo',
    'ancient greek treasury small temple delphi olympia ruins photo',
    'temple of hephaestus athens greek classical exterior ruins photo',
  ]},
  { id: 'romanesque', queries: [
    'speyer cathedral romanesque exterior germany architecture photo',
    'romanesque revival house residential exterior stone round arches photo',
    'romanesque village church small stone exterior rural photo',
    'durham cathedral romanesque exterior architecture photo',
    'romanesque cloister arcade courtyard stone columns photo',
  ]},
  { id: 'gothic', queries: [
    'notre dame paris gothic cathedral exterior flying buttresses photo',
    'gothic revival cottage house residential exterior pointed arches photo',
    'english village gothic church small stone exterior photo',
    'chartres cathedral gothic exterior west facade photo',
    'gothic cathedral interior nave vaulted ceiling stained glass photo',
  ]},
  { id: 'renaissance', queries: [
    'florence cathedral brunelleschi dome renaissance exterior photo',
    'palladio villa rotonda residential renaissance architecture exterior photo',
    'tempietto bramante small renaissance chapel rome exterior photo',
    'palazzo medici riccardi renaissance palace florence exterior photo',
    'renaissance loggia colonnade courtyard interior architecture photo',
  ]},
  { id: 'baroque', queries: [
    'st peters basilica rome baroque architecture exterior colonnade photo',
    'baroque country manor house residential exterior formal garden photo',
    'baroque parish church small facade ornate exterior photo',
    'versailles palace baroque grand facade exterior photo',
    'borromini san carlo quattro fontane baroque church facade rome photo',
  ]},
  { id: 'neoclassical', queries: [
    'us capitol building washington neoclassical architecture exterior photo',
    'neoclassical plantation house monticello residential exterior photo',
    'neoclassical bank small portico columns exterior small town photo',
    'british museum neoclassical facade columns exterior london photo',
    'neoclassical townhouse terraced street columns facade exterior photo',
  ]},
  { id: 'art-nouveau', queries: [
    'sagrada familia gaudi barcelona art nouveau exterior architecture photo',
    'victor horta brussels art nouveau townhouse residential exterior photo',
    'art nouveau small shop cafe facade ornament exterior street photo',
    'paris metro entrance guimard art nouveau ironwork exterior photo',
    'art nouveau building riga latvia ornate facade exterior photo',
  ]},
  { id: 'art-deco', queries: [
    'chrysler building new york art deco exterior skyscraper photo',
    'art deco house residential exterior streamline moderne photo',
    'miami beach ocean drive art deco small hotel exterior photo',
    'art deco cinema theatre facade exterior architecture photo',
    'rockefeller center art deco new york exterior plaza photo',
  ]},
  { id: 'bauhaus', queries: [
    'bauhaus dessau gropius building exterior glass workshop photo',
    'bauhaus masters house residential exterior dessau architecture photo',
    'bauhaus style small house white flat roof exterior photo',
    'bauhaus school building exterior germany architecture photo',
    'bauhaus interior workshop space design school photo',
  ]},
  { id: 'international-style', queries: [
    'seagram building new york mies van der rohe international style exterior photo',
    'case study house farnsworth house glass residential exterior photo',
    'international style small office building glass curtain wall exterior photo',
    'lever house new york international style glass curtain wall photo',
    'lake shore drive apartments chicago mies van der rohe exterior photo',
  ]},
  { id: 'brutalism', queries: [
    'barbican centre london brutalist architecture exterior concrete photo',
    'brutalist social housing estate concrete apartment block exterior photo',
    'trellick tower london brutalist residential tower exterior photo',
    'boston city hall brutalist architecture exterior photo',
    'robin hood gardens brutalist housing london exterior photo',
  ]},
  { id: 'organic-prairie', queries: [
    'fallingwater frank lloyd wright exterior architecture photo',
    'frank lloyd wright prairie house residential exterior horizontal photo',
    'usonian house frank lloyd wright small residential exterior photo',
    'robie house chicago prairie style exterior architecture photo',
    'taliesin west frank lloyd wright desert architecture exterior photo',
  ]},
  { id: 'mid-century-modern', queries: [
    'case study house julius shulman mid century modern exterior photo',
    'eichler home mid century modern residential exterior california photo',
    'mid century modern small commercial strip mall exterior photo',
    'neutra kaufmann desert house palm springs mid century exterior photo',
    'mid century modern ranch house residential exterior landscaping photo',
  ]},
  { id: 'high-tech', queries: [
    'centre pompidou paris renzo piano rogers high tech exterior photo',
    'hopkins house london high tech residential architecture exterior photo',
    'lloyds building london rogers high tech architecture exterior photo',
    'high tech architecture small office building exposed structure exterior photo',
    'norman foster hong kong hsbc building high tech exterior photo',
  ]},
  { id: 'postmodernism', queries: [
    'AT&T sony building philip johnson postmodern new york exterior photo',
    'postmodern house residential architecture colorful exterior photo',
    'portland building michael graves postmodern exterior photo',
    'postmodern small commercial building colorful ornament exterior photo',
    'piazza ditalia charles moore postmodern architecture exterior photo',
  ]},
  { id: 'deconstructivism', queries: [
    'guggenheim bilbao gehry titanium deconstructivist exterior photo',
    'frank gehry residence santa monica deconstructivist house exterior photo',
    'jewish museum berlin libeskind deconstructivist exterior photo',
    'deconstructivist small pavilion building angular exterior photo',
    'vitra fire station zaha hadid deconstructivist architecture exterior photo',
  ]},
  { id: 'parametric', queries: [
    'guangzhou opera house zaha hadid parametric architecture exterior photo',
    'parametric architecture small residential house organic curves exterior photo',
    'CCTV building beijing rem koolhaas parametric exterior photo',
    'parametric architecture small pavilion computational form exterior photo',
    'heydar aliyev centre baku zaha hadid parametric exterior photo',
  ]},
  { id: 'minimalism-arch', queries: [
    'tadao ando church of light osaka minimalist architecture interior photo',
    'john pawson minimalist house residential interior light photo',
    'peter zumthor therme vals minimalist stone bathhouse exterior photo',
    'tadao ando small chapel residential minimalist concrete exterior photo',
    'minimalist house exterior concrete white clean simple residential photo',
  ]},
  { id: 'japanese-traditional', queries: [
    'kinkakuji golden pavilion kyoto japanese traditional architecture exterior photo',
    'japanese machiya traditional townhouse residential exterior kyoto photo',
    'japanese farmhouse minka traditional architecture exterior rural photo',
    'senso-ji asakusa tokyo japanese temple exterior photo',
    'japanese traditional teahouse small garden exterior photo',
  ]},
  { id: 'islamic-moorish', queries: [
    'alhambra granada court of lions islamic architecture interior photo',
    'moroccan riad traditional house courtyard fountain interior photo',
    'moroccan medina traditional small shop souk architecture photo',
    'hassan II mosque casablanca islamic architecture exterior photo',
    'blue mosque istanbul islamic architecture exterior photo',
  ]},
  { id: 'byzantine', queries: [
    'hagia sophia istanbul byzantine architecture exterior dome photo',
    'small byzantine chapel church exterior greece photo',
    'ravenna san vitale byzantine church interior mosaic photo',
    'byzantine church exterior dome pendentives small greece photo',
    'st marks basilica venice byzantine architecture exterior facade photo',
  ]},
  { id: 'gothic-revival', queries: [
    'houses of parliament westminster gothic revival exterior photo',
    'gothic revival victorian house residential exterior pointed arches photo',
    'gothic revival church small exterior england stone photo',
    'gothic revival university college building exterior stonework photo',
    'gothic revival ornamental cottage residential exterior rustic photo',
  ]},
  { id: 'beaux-arts', queries: [
    'grand central terminal new york beaux arts exterior photo',
    'beaux arts mansion townhouse residential exterior new york photo',
    'paris opera garnier beaux arts architecture exterior photo',
    'beaux arts small post office civic building exterior columns photo',
    'beaux arts library public building exterior classical columns photo',
  ]},
  { id: 'french-renaissance', queries: [
    'chateau de chambord french renaissance exterior architecture photo',
    'chateau de chenonceau french renaissance exterior bridge photo',
    'small french renaissance manor house residential exterior photo',
    'chateau azay le rideau french renaissance exterior reflection photo',
    'french renaissance courtyard wing dormers exterior architecture photo',
  ]},
  { id: 'english-arts-crafts', queries: [
    'lutyens country house arts crafts architecture exterior photo',
    'arts and crafts cottage house residential exterior brick garden photo',
    'philip webb red house arts crafts architecture exterior photo',
    'arts crafts movement small cottage vernacular exterior tile photo',
    'arts and crafts garden pergola terrace house exterior photo',
  ]},
  { id: 'spanish-colonial', queries: [
    'mission san juan capistrano california spanish colonial exterior photo',
    'spanish colonial revival house residential exterior stucco tile photo',
    'santa barbara courthouse spanish colonial architecture exterior photo',
    'spanish colonial small shop commercial arcade exterior stucco photo',
    'mission santa barbara california spanish colonial exterior bell tower photo',
  ]},
  { id: 'chicago-school', queries: [
    'louis sullivan chicago school ornament building exterior terracotta photo',
    'chicago school small commercial rowhouse brick exterior photo',
    'reliance building chicago school steel glass exterior photo',
    'chicago school auditorium building sullivan exterior photo',
    'carson pirie scott chicago school large department store exterior photo',
  ]},
  { id: 'german-expressionism', queries: [
    'einstein tower mendelsohn potsdam expressionist architecture exterior photo',
    'german expressionist brick house residential 1920s exterior photo',
    'chilehaus hamburg expressionist brick commercial building exterior photo',
    'german expressionism goetheanum dornach concrete exterior photo',
    'fritz hoeger brick expressionist architecture office building exterior photo',
  ]},
  { id: 'russian-constructivism', queries: [
    'melnikov house moscow constructivist residential architecture exterior photo',
    'narkomfin building moscow constructivist social housing exterior photo',
    'rusakov workers club constructivist architecture moscow exterior photo',
    'russian constructivism building red accent concrete exterior photo',
    'vesnin constructivist small pavilion soviet architecture exterior photo',
  ]},
  { id: 'nordic-modernism', queries: [
    'alvar aalto finlandia hall helsinki nordic modernism exterior photo',
    'alvar aalto villa mairea residential house nordic modernism exterior photo',
    'jorn utzon sydney opera house nordic expressionism exterior photo',
    'nordic modernism small community hall brick exterior photo',
    'gunnar asplund stockholm public library nordic classicism exterior photo',
  ]},
  { id: 'brazilian-modernism', queries: [
    'oscar niemeyer national congress brasilia exterior architecture photo',
    'casa das canoas niemeyer residential house exterior rio photo',
    'oscar niemeyer small chapel exterior concrete curves photo',
    'copan building oscar niemeyer sao paulo residential tower exterior photo',
    'itamaraty palace niemeyer brasilia exterior reflecting pool photo',
  ]},
];

async function scrapeStyle(style) {
  const styleDir = path.join(OUT_DIR, style.id);
  ensureDir(styleDir);

  // Wipe existing images
  fs.readdirSync(styleDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .forEach(f => fs.unlinkSync(path.join(styleDir, f)));

  let candidates = [];
  const seenUrls = new Set();

  for (const query of style.queries) {
    console.log(`  searching: "${query}"`);
    try {
      const results = await searchDDG(query);
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
        .filter(img => !seenUrls.has(img.image))
        .map(img => {
          seenUrls.add(img.image);
          return { ...img, queryIdx: style.queries.indexOf(query), score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) };
        })
        .filter(img => img.score > 0)
        .sort((a, b) => b.score - a.score);
      console.log(`    ${results.length} results → ${scored.length} viable`);
      candidates.push(...scored);
    } catch (e) {
      console.log(`    error: ${e.message}`);
    }
    await sleep(800);
  }

  // Sort by score but try to ensure we get at least one from each query bucket
  const byQuery = {};
  candidates.forEach(c => {
    if (!byQuery[c.queryIdx]) byQuery[c.queryIdx] = [];
    byQuery[c.queryIdx].push(c);
  });

  // Pick best from each query first, then fill remainder by score
  const picked = [];
  const usedImgs = new Set();
  for (let qi = 0; qi < style.queries.length && picked.length < IMAGES_PER_STYLE; qi++) {
    const bucket = (byQuery[qi] || []).filter(c => !usedImgs.has(c.image));
    if (bucket.length > 0) {
      picked.push(bucket[0]);
      usedImgs.add(bucket[0].image);
    }
  }
  // Fill remaining slots from global sorted candidates
  const remaining = candidates.filter(c => !usedImgs.has(c.image)).sort((a, b) => b.score - a.score);
  for (const c of remaining) {
    if (picked.length >= IMAGES_PER_STYLE) break;
    picked.push(c);
    usedImgs.add(c.image);
  }

  console.log(`  downloading ${picked.length} images…`);
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
      console.log(`    [${idx}] q${candidate.queryIdx+1} ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0,70)}`);
    } catch (e) {
      console.log(`    [${idx}] err: ${e.message.slice(0,60)}`);
    }
    await sleep(300);
  }
  console.log(`  → ${saved.length}/${IMAGES_PER_STYLE} saved`);
  return saved;
}

(async () => {
  ensureDir(OUT_DIR);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

  for (const style of STYLES) {
    console.log(`\n══ ${style.id} ══`);
    manifest[style.id] = await scrapeStyle(style);
    await sleep(1500);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n\nDone. Manifest written.');

  let total = 0, missing = [];
  for (const style of STYLES) {
    const n = manifest[style.id]?.length || 0;
    total += n;
    if (n < IMAGES_PER_STYLE) missing.push(`${style.id}(${n})`);
    console.log(`  ${style.id}: ${n}`);
  }
  console.log(`\nTotal: ${total}/${STYLES.length * IMAGES_PER_STYLE}`);
  if (missing.length) console.log(`Incomplete: ${missing.join(', ')}`);
})().catch(err => { console.error(err); process.exit(1); });
