import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const targets = ['src'];
const disallowed = [
  { pattern: /console\.log\(/, label: 'console.log debug output' },
  { pattern: /href=["']#["']/, label: 'empty href handler' },
  { pattern: /onClick=\{\(\) => \{\}\}/, label: 'empty click handler' },
  { pattern: /\bTODO\b|\bFIXME\b/, label: 'unfinished TODO/FIXME marker' },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(entry)) walk(path, files);
      continue;
    }
    if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

const findings = [];
for (const target of targets) {
  for (const file of walk(join(root, target))) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      disallowed.forEach((rule) => {
        if (rule.pattern.test(line)) {
          findings.push(`${relative(root, file)}:${index + 1} ${rule.label}`);
        }
      });
    });
  }
}

if (findings.length) {
  console.error('App source check failed:\n' + findings.join('\n'));
  process.exit(1);
}

console.log('App source check passed.');
