import fs from 'fs';

const html = fs.readFileSync('public/admin.html', 'utf8');
const js = fs.readFileSync('public/js/admin.js', 'utf8');

const htmlIds = new Set(Array.from(html.matchAll(/id=['"]([^'"]+)['"]/g)).map(m => m[1]));
const jsIds = Array.from(js.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g)).map(m => m[1]);

const missing = jsIds.filter(id => !htmlIds.has(id));

console.log('Total HTML IDs found:', htmlIds.size);
console.log('Missing element IDs referenced in admin.js:', missing);
