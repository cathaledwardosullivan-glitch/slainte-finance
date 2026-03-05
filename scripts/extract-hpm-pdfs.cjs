/**
 * Extract text from HPM PDF manuals using pdf-parse
 * Saves extracted text to C:\Users\user\Downloads\ with descriptive filenames
 */
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pdfs = [
  {
    input: 'C:\\Users\\user\\Downloads\\HPM_User_Manual_V3.6.6.pdf',
    output: 'C:\\Users\\user\\Downloads\\HPM_User_Manual_V3.6.6_EXTRACTED.txt',
    label: 'HPM User Manual V3.6.6'
  },
  {
    input: 'C:\\Users\\user\\Downloads\\HPM_CDM2_Manual.pdf',
    output: 'C:\\Users\\user\\Downloads\\HPM_CDM2_Manual_EXTRACTED.txt',
    label: 'HPM CDM 2 Manual'
  },
  {
    input: 'C:\\Users\\user\\Downloads\\HPM_All_Quick_Guides.pdf',
    output: 'C:\\Users\\user\\Downloads\\HPM_All_Quick_Guides_EXTRACTED.txt',
    label: 'HPM All Quick Guides'
  }
];

async function extractPDF(pdfInfo) {
  console.log(`\n--- Extracting: ${pdfInfo.label} ---`);
  console.log(`Input: ${pdfInfo.input}`);

  const dataBuffer = fs.readFileSync(pdfInfo.input);
  const data = await pdfParse(dataBuffer);

  console.log(`Pages: ${data.numpages}`);
  console.log(`Text length: ${data.text.length} characters`);

  // Write extracted text
  const header = `=== ${pdfInfo.label} ===\nPages: ${data.numpages}\nExtracted: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
  fs.writeFileSync(pdfInfo.output, header + data.text, 'utf8');

  console.log(`Saved to: ${pdfInfo.output}`);
  return { label: pdfInfo.label, pages: data.numpages, textLength: data.text.length };
}

async function main() {
  console.log('HPM PDF Text Extraction');
  console.log('========================\n');

  const results = [];
  for (const pdf of pdfs) {
    try {
      const result = await extractPDF(pdf);
      results.push(result);
    } catch (err) {
      console.error(`ERROR extracting ${pdf.label}: ${err.message}`);
      results.push({ label: pdf.label, error: err.message });
    }
  }

  console.log('\n\n=== SUMMARY ===');
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.label}: ERROR - ${r.error}`);
    } else {
      console.log(`  ${r.label}: ${r.pages} pages, ${r.textLength} chars`);
    }
  }
}

main().catch(console.error);
