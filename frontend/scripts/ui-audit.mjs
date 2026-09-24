import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(frontendRoot, 'src');
const strict = process.argv.includes('--strict');
const changedOnly = process.argv.includes('--changed');
const verbose = process.argv.includes('--verbose');
const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const findings = [];

function changedFiles() {
  try {
    const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: resolve(frontendRoot, '..'),
      encoding: 'utf8',
    });
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: resolve(frontendRoot, '..'),
      encoding: 'utf8',
    });
    return new Set((changed + untracked)
      .split('\n')
      .filter((path) => path.startsWith('frontend/src/'))
      .map((path) => path.slice('frontend/'.length)));
  } catch {
    return null;
  }
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = resolve(directory, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

const pendingFiles = changedOnly ? changedFiles() : null;
const files = walk(sourceRoot).filter((file) => {
  const local = relative(frontendRoot, file);
  return sourceExtensions.has(file.slice(file.lastIndexOf('.'))) && (!pendingFiles || pendingFiles.has(local));
});

const rules = [
  {
    name: 'raw color literal',
    pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/g,
    message: 'Use an approved named token instead of a raw color literal.',
  },
  {
    name: 'gradient utility',
    pattern: /\b(?:bg-gradient-(?:to|radial|conic)-\w+|from-[\w[\]-]+|via-[\w[\]-]+|to-[\w[\]-]+)\b/g,
    message: 'Gradients are not part of the approved default UI system.',
  },
  {
    name: 'unapproved palette utility',
    pattern: /\b(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    message: 'Use an approved semantic or design token utility instead of a stock palette color.',
  },
];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      findings.push({ file: relative(frontendRoot, file), line, rule: rule.name, message: rule.message });
    }
  }
}

if (files.length === 0 && changedOnly) {
  console.log('UI audit: no changed frontend source files to inspect.');
} else if (findings.length === 0) {
  console.log(`UI audit: ${files.length} source file(s) checked; no token-policy findings.`);
} else {
  console.log(`UI audit: ${findings.length} finding(s) across ${files.length} source file(s).`);
  const displayedFindings = verbose ? findings : findings.slice(0, 40);
  for (const finding of displayedFindings) {
    console.log(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }
  if (!verbose && findings.length > displayedFindings.length) {
    console.log(`- … ${findings.length - displayedFindings.length} more; rerun with --verbose for the complete inventory.`);
  }
}

if (strict && findings.length > 0) {
  process.exitCode = 1;
}
