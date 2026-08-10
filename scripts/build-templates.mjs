#!/usr/bin/env node
/**
 * Digitalcinizcom şablon klasörlerini tarar ve vitrinin okuduğu
 * templates.json dosyasını üretir. Böylece yeni bir şablon
 * oluşturulduğunda vitrine otomatik eklenir.
 *
 * Kullanım:  node scripts/build-templates.mjs <kaynak-dizin>
 *   <kaynak-dizin>: Digitalcinizcom deposunun (main) checkout yolu. Vars: _src
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] || process.env.SRC || "_src";
const BASE = "https://edavetiye.github.io/Digitalcinizcom";
const OUT = "templates.json";
const OVERRIDES_FILE = "templates.overrides.json";

// Kategori klasörü -> vitrindeki tür etiketi ve sıra
const KATEGORI = {
  "dugun":          { tur: "Düğün",       sira: 1 },
  "dogum-gunu":     { tur: "Doğum Günü",  sira: 2 },
  "magaza-acilisi": { tur: "Açılış",      sira: 3 },
};

const IMG = /\.(webp|png|jpe?g|gif|avif)$/i;

const guzelle = s =>
  s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
   .replace(/\b\w/g, c => c.toLocaleUpperCase("tr"));

const cozEntity = s => String(s || "")
  .replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/&nbsp;/g, " ")
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

const dizinMi = p => { try { return statSync(p).isDirectory(); } catch { return false; } };

function baslikBul(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? cozEntity(m[1]) : "";
}

function kapakBul(tplDir) {
  const assets = join(tplDir, "assets");
  if (!dizinMi(assets)) return "";
  const dosyalar = readdirSync(assets).filter(f => IMG.test(f));
  if (!dosyalar.length) return "";
  const oncelik = ["kapak", "cover", "onizleme", "kapak-1"];
  for (const p of oncelik) {
    const bulunan = dosyalar.find(f => f.toLowerCase().startsWith(p));
    if (bulunan) return "assets/" + bulunan;
  }
  const posterOlmayan = dosyalar.find(f => !/poster/i.test(f));
  return "assets/" + (posterOlmayan || dosyalar[0]);
}

let overrides = {};
if (existsSync(OVERRIDES_FILE)) {
  try { overrides = JSON.parse(readFileSync(OVERRIDES_FILE, "utf8")); }
  catch (e) { console.warn("overrides okunamadı:", e.message); }
}

if (!dizinMi(SRC)) {
  console.error(`Kaynak dizin bulunamadı: ${SRC}`);
  process.exit(1);
}

const davetiyeler = [];
for (const kat of readdirSync(SRC)) {
  if (kat.startsWith(".")) continue;
  const katDir = join(SRC, kat);
  if (!dizinMi(katDir)) continue;

  for (const slug of readdirSync(katDir)) {
    const tplDir = join(katDir, slug);
    const indexPath = join(tplDir, "index.html");
    if (!dizinMi(tplDir) || !existsSync(indexPath)) continue;

    const key = `${kat}/${slug}`;
    const ov = overrides[key] || {};
    if (ov.gizli === true) continue;   // vitrine gösterilmeyecek şablonlar
    const html = readFileSync(indexPath, "utf8");
    const kapakRel = kapakBul(tplDir);
    const katBilgi = KATEGORI[kat];

    davetiyeler.push({
      ad:    ov.ad  || baslikBul(html) || guzelle(slug),
      tur:   ov.tur || (katBilgi ? katBilgi.tur : guzelle(kat)),
      not:   ov.not || "",
      link:  `${BASE}/${kat}/${slug}/`,
      kapak: ov.kapak || (kapakRel ? `${BASE}/${kat}/${slug}/${kapakRel}` : ""),
      _sira: (katBilgi ? katBilgi.sira : 99),
    });
  }
}

davetiyeler.sort((a, b) =>
  a._sira - b._sira || a.ad.localeCompare(b.ad, "tr"));
davetiyeler.forEach(d => delete d._sira);

writeFileSync(OUT, JSON.stringify({
  guncelleme: new Date().toISOString(),
  davetiyeler,
}, null, 2) + "\n");

console.log(`${OUT} yazıldı — ${davetiyeler.length} şablon.`);
