// Lints and compiles content/.
//   node scripts/content-lint.ts [--format pretty|github] [--max-warnings N] [--dir content]
// Exits 1 on any error, or when warnings exceed --max-warnings.
import { appendFileSync } from 'node:fs';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { counts, formatGithub, formatPretty, summaryMarkdown } from '../src/compiler/report.ts';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const format = opt('--format') ?? 'pretty';
const maxWarnings = Number(opt('--max-warnings') ?? Infinity);
const dir = opt('--dir') ?? 'content';

const { bundle, diagnostics } = compile(loadContentDir(dir));
const { errors, warnings } = counts(diagnostics);

if (diagnostics.length) {
  console.log(formatPretty(diagnostics));
  if (format === 'github') console.log(formatGithub(diagnostics));
}
const stats = bundle
  ? `${bundle.topics.length} topics, ${bundle.topics.reduce((n, t) => n + t.items.length, 0)} items, content version ${bundle.contentVersion}`
  : 'no bundle (fix errors first)';
console.log(`\n${errors} error(s), ${warnings} warning(s) — ${stats}`);

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(diagnostics, stats));

if (errors > 0) process.exit(1);
if (warnings > maxWarnings) {
  console.log(`Too many warnings: ${warnings} > --max-warnings ${maxWarnings}`);
  process.exit(1);
}
