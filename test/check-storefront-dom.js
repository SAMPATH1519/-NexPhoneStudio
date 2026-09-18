import fs from 'fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

const htmlIds = new Set(Array.from(html.matchAll(/id=['"]([^'"]+)['"]/g)).map(m => m[1]));
const jsIds = Array.from(js.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g)).map(m => m[1]);

const missing = [...new Set(jsIds.filter(id => !htmlIds.has(id)))];

console.log('Total HTML IDs found in index.html:', htmlIds.size);
console.log('Unique IDs queried in app.js:', new Set(jsIds).size);
console.log('Missing element IDs referenced in app.js:', missing);
