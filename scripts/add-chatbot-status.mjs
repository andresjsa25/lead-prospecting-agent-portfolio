import fs from 'node:fs';

const raw = fs.readFileSync('inmobiliarias-filtradas.csv', 'utf-8');
const lines = raw.split('\n').filter(Boolean);
const headers = lines[0].split(',');

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        fields.push(cur);
        cur = '';
      } else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

// domain -> status, based on manual WebFetch review of each site.
// Ejemplo con dominios ficticios — la lista real (decenas de sitios revisados
// a mano) vive fuera de este repo porque describe a negocios de terceros.
const statusByDomainFragment = [
  ['ejemplo-uno.com.ar', 'Sin automatizacion (solo link WhatsApp manual)'],
  ['ejemplo-dos.com.ar', 'WhatsApp manual (boton, sin bot)'],
  ['ejemplo-tres.com', 'No verificado (bloqueo 403)'],
];

function statusFor(website) {
  if (!website) return 'Sin sitio web';
  for (const [frag, status] of statusByDomainFragment) {
    if (website.includes(frag)) return status;
  }
  return 'No verificado';
}

const rows = lines.slice(1).map(parseCsvLine);
const withStatus = rows.map((r) => [...r, statusFor(r[2])]);

const newHeaders = [...headers, 'chatbot_estado'];
const csvOut = [
  newHeaders.join(','),
  ...withStatus.map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(',')),
].join('\n');
fs.writeFileSync('inmobiliarias-finales.csv', csvOut, 'utf-8');

const tally = {};
for (const r of withStatus) {
  const s = r[r.length - 1];
  tally[s] = (tally[s] || 0) + 1;
}
console.log('Total:', withStatus.length);
console.log(tally);
