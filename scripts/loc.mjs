// Thống kê số dòng các file được git track, bỏ json/asset/lock, chỉ giữ file > MIN dòng.
// Usage: node scripts/loc.mjs [min=100]
// Output: scripts/loc-report.md
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN = Number(process.argv[2] ?? 100);
const EXCLUDE = /\.(json|png|jpe?g|gif|webp|ico|svg|woff2?|ttf|lock|map)$|package-lock|pnpm-lock/i;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outFile = join(here, 'loc-report.md');

const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !EXCLUDE.test(f));

const rows = [];
for (const f of files) {
  const abs = join(root, f);
  try {
    if (!statSync(abs).isFile()) continue;
  } catch {
    continue; // file đã xoá nhưng chưa commit
  }
  const text = readFileSync(abs, 'utf8');
  const lines = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (lines > MIN) rows.push({ lines, file: f });
}
rows.sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

const total = rows.reduce((s, r) => s + r.lines, 0);
const md = [
  `# LOC report (> ${MIN} lines)`,
  '',
  `Generated: ${new Date().toISOString()} — ${rows.length} files, ${total} lines`,
  '',
  '| Lines | File |',
  '|---:|---|',
  ...rows.map((r) => `| ${r.lines} | ${r.file} |`),
  '',
].join('\n');

writeFileSync(outFile, md);
console.log(`${rows.length} files > ${MIN} lines → ${outFile}`);
