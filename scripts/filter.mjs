import fs from 'node:fs';

const raw = fs.readFileSync('inmobiliarias-buenos-aires.csv', 'utf-8');
const lines = raw.split('\n');
const headers = lines[0].split(',');

// crude CSV row parser (fields are always quoted, no embedded commas outside quotes in our data except within quoted fields)
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
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        fields.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  fields.push(cur);
  return fields;
}

// Negocios revisados a mano y descartados por algún motivo puntual (cerrados,
// duplicados con otro nombre, fuera de la zona real pese al filtro de ubicación, etc).
// Ejemplo con datos ficticios — la lista real de exclusiones vive fuera de este repo.
const excludeNames = new Set([
  'ejemplo inmobiliaria demo',
  'otro ejemplo - agente ficticio',
]);

const rows = lines.slice(1).filter(Boolean).map(parseCsvLine);
const kept = rows.filter((r) => !excludeNames.has(r[0].toLowerCase().trim()));

console.log(`Excluidas: ${rows.length - kept.length}, Mantenidas: ${kept.length}`);

const csvOut = [
  headers.join(','),
  ...kept.map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(',')),
].join('\n');
fs.writeFileSync('inmobiliarias-filtradas.csv', csvOut, 'utf-8');

// unique websites for chatbot check
const websites = [...new Set(kept.map((r) => r[2]).filter(Boolean))];
fs.writeFileSync('websites-to-check.json', JSON.stringify(websites, null, 2));
console.log(`Websites únicos a chequear: ${websites.length}`);
