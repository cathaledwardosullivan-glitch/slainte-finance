#!/usr/bin/env node
/**
 * Check for hardcoded hex color values in source files.
 * Run: node scripts/check-hardcoded-colors.cjs
 *
 * Flags any #hex color literals in src/ files (excluding colors.js).
 * Use COLORS from src/utils/colors.js instead.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const IGNORE_FILE = path.join('src', 'utils', 'colors.js');
const HEX_PATTERN = /(?<=['"`])#[0-9a-fA-F]{3,8}(?=['"`])/g;
const EXTENSIONS = new Set(['.js', '.jsx']);

let totalFindings = 0;
const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      checkFile(full);
    }
  }
}

function checkFile(filePath) {
  const rel = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
  if (rel === IGNORE_FILE.replace(/\\/g, '/')) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].match(HEX_PATTERN);
    if (matches) {
      for (const match of matches) {
        findings.push({ file: rel, line: i + 1, color: match });
        totalFindings++;
      }
    }
  }
}

walk(SRC_DIR);

if (totalFindings === 0) {
  console.log('No hardcoded hex colors found. All clear!');
  process.exit(0);
} else {
  console.log(`Found ${totalFindings} hardcoded hex color(s):\n`);
  const byFile = {};
  for (const f of findings) {
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
  }
  for (const [file, items] of Object.entries(byFile)) {
    console.log(`  ${file}`);
    for (const item of items) {
      console.log(`    L${item.line}: ${item.color}`);
    }
  }
  console.log(`\nUse COLORS from src/utils/colors.js instead.`);
  process.exit(1);
}
