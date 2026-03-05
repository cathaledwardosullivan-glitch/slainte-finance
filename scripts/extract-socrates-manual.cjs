const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const pdfPath = path.join('C:', 'Users', 'user', 'Downloads', 'SocratesGPUserManual_compressed (1).pdf');
const outputPath = path.join('C:', 'Users', 'user', 'Downloads', 'socrates_manual_text.txt');

const buf = fs.readFileSync(pdfPath);
pdfParse(buf).then(data => {
  fs.writeFileSync(outputPath, data.text);
  console.log('Pages:', data.numpages);
  console.log('Characters:', data.text.length);
  console.log('Saved to:', outputPath);
}).catch(e => console.error(e));
