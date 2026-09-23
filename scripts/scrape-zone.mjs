// Uso: node scrape-zone.mjs <zona> <locationQuery>
// Ej:  node scrape-zone.mjs caballito "Caballito, CABA, Argentina"
import fs from 'node:fs';

const [, , zona, locationQuery] = process.argv;
if (!zona || !locationQuery) {
  console.error('Uso: node scrape-zone.mjs <zona> "<locationQuery>"');
  process.exit(1);
}

const envRaw = fs.readFileSync(new URL('../.env', import.meta.url), 'utf-8');
const token = envRaw.match(/APIFY_TOKEN=(\S+)/)?.[1];
if (!token) {
  console.error('No se encontro APIFY_TOKEN en ../.env');
  process.exit(1);
}

const input = {
  searchStringsArray: ['inmobiliaria'],
  locationQuery,
  maxCrawledPlacesPerSearch: 13,
  language: 'es',
  skipClosedPlaces: true,
};

const res = await fetch(
  `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${token}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }
);

if (!res.ok) {
  console.error('Error HTTP', res.status, await res.text());
  process.exit(1);
}

const items = await res.json();
fs.writeFileSync(`items-${zona}.json`, JSON.stringify(items, null, 2), 'utf-8');
console.log(`OK: ${items.length} resultados guardados en items-${zona}.json`);
