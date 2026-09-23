import fs from 'node:fs';

const zones = ['palermo', 'belgrano', 'recoleta', 'sanisidro'];
const byPlaceId = new Map();

for (const zone of zones) {
  const items = JSON.parse(fs.readFileSync(`items-${zone}.json`, 'utf-8'));
  for (const item of items) {
    if (byPlaceId.has(item.placeId)) continue; // exact same listing seen in overlapping zone search
    byPlaceId.set(item.placeId, {
      nombre: item.title || '',
      telefono: item.phone || '',
      website: item.website || '',
      direccion: item.address || '',
      barrio: item.neighborhood || '',
      zona_busqueda: zone,
      rating: item.totalScore ?? '',
      reviews: item.reviewsCount ?? '',
      google_maps_url: item.url || '',
    });
  }
}

const rows = [...byPlaceId.values()];

// Flag names that appear more than once with different addresses -> likely multi-branch chain
const nameCount = {};
for (const r of rows) {
  const key = r.nombre.toLowerCase().trim();
  nameCount[key] = (nameCount[key] || 0) + 1;
}
for (const r of rows) {
  const key = r.nombre.toLowerCase().trim();
  r.posible_cadena = nameCount[key] > 1 ? 'si' : '';
}

const headers = Object.keys(rows[0]);
const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [
  headers.join(','),
  ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
].join('\n');

fs.writeFileSync('inmobiliarias-buenos-aires.csv', csv, 'utf-8');
console.log(`Total filas: ${rows.length}`);
