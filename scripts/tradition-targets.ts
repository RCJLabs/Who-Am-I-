// The political traditions' positions, as the engine scores their answer sheets
// (content/analysis/sheets/), and the questions a new sheet answers.
//   node scripts/tradition-targets.ts                         print every tradition's targets
//   node scripts/tradition-targets.ts --questionnaire out.md  write the questions a sheet answers
// The compared principles come from content/analysis/traditions.yaml, or --compare a,b,c.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatPretty } from '../src/compiler/report.ts';
import type { Item } from '../src/model/content.ts';
import { isScale } from '../src/model/content.ts';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const { bundle, analysis, diagnostics } = compile(loadContentDir('content'));
if (!bundle) {
  console.error(formatPretty(diagnostics));
  throw new Error('content does not compile');
}
const packFile = 'content/analysis/traditions.yaml';
const compare =
  opt('--compare')?.split(',') ??
  (existsSync(packFile) ? (parse(readFileSync(packFile, 'utf8')) as { compare: string[] }).compare : []);

const out = opt('--questionnaire');
if (out) {
  const political = new Set(Object.values(bundle.axes).filter((a) => a.family === 'political').map((a) => a.id));
  const lines: string[] = ['# Questions an answer sheet answers', ''];
  const ladder = (it: Item) => (isScale(it) && 'labels' in it && Array.isArray(it.labels) ? it.labels.map((l, i) => `${i + 1}. ${l}`).join(' · ') : '');
  lines.push('## Political questions (every one)', '');
  for (const t of bundle.topics) {
    if (t.sensitive) continue;
    for (const it of t.items) {
      if (!isScale(it) || it.type === 'importance' || it.sensitive || !it.effects.some((e) => e.target.startsWith('axis:') && political.has(e.target.slice(5)))) continue;
      lines.push(`- \`${it.id}\` (${t.title}): ${it.text}`, `  ${ladder(it)}`);
    }
  }
  lines.push('', `## Principle statements (compared principles: ${compare.join(', ')})`, '');
  for (const t of bundle.topics) {
    if (t.sensitive) continue;
    for (const it of t.items) {
      if (!isScale(it) || it.type === 'importance' || it.sensitive) continue;
      const feeds = it.effects.filter((e) => e.target.startsWith('principle:') && compare.includes(e.target.slice(10)));
      if (!feeds.length || (t.id !== 'moral_foundations' && !it.anchor)) continue;
      lines.push(`- \`${it.id}\` (${t.title}): ${it.text}`, `  ${ladder(it)}`);
    }
  }
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`wrote ${out}`);
} else {
  if (!analysis) {
    console.error(formatPretty(diagnostics));
    throw new Error('the analysis pack does not compile');
  }
  const fmt = (r: Record<string, number>) => Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
  for (const t of analysis.traditions) {
    console.log(`${t.id}`);
    console.log(`  positions:  ${fmt(t.positions)}`);
    console.log(`  principles: ${fmt(t.principles)}`);
    if (t.divided.length) console.log(`  divided:    ${t.divided.join(', ')}`);
  }
}
