// Scores the political traditions' answer sheets (tests/sim/traditions/*.yaml) with the engine,
// giving each tradition's targets on the app's own scales.
//   node scripts/tradition-targets.ts                         print every tradition's targets
//   node scripts/tradition-targets.ts --questionnaire out.md  write the questions a sheet answers
// The compared principles come from content/analysis/traditions.yaml, or --compare a,b,c.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import type { Item } from '../src/model/content.ts';
import { isScale } from '../src/model/content.ts';
import { loadSheets, scoreSheet } from '../tests/sim/tradition-sheets.ts';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const { bundle } = compile(loadContentDir('content'));
if (!bundle) throw new Error('content does not compile; run npm run content:lint');
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
    const st = t.items.find((i) => i.id === t.stance);
    const effects = st && 'effects' in st ? st.effects : [];
    if (!st || !isScale(st) || !effects.some((e) => e.target.startsWith('axis:') && political.has(e.target.slice(5)))) continue;
    lines.push(`- \`${st.id}\` (${t.title}): ${st.text}`, `  ${ladder(st)}`);
  }
  lines.push('', `## Principle statements (compared principles: ${compare.join(', ')})`, '');
  for (const t of bundle.topics) {
    if (t.sensitive) continue;
    for (const it of t.items) {
      if (!isScale(it) || it.sensitive) continue;
      const feeds = ('effects' in it ? it.effects : []).filter((e) => e.target.startsWith('principle:') && compare.includes(e.target.slice(10)));
      if (!feeds.length || (t.id !== 'moral_foundations' && !it.anchor)) continue;
      lines.push(`- \`${it.id}\` (${t.title}): ${it.text}`, `  ${ladder(it)}`);
    }
  }
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`wrote ${out}`);
} else {
  for (const sheet of loadSheets()) {
    const t = scoreSheet(bundle, sheet, compare);
    const fmt = (r: Record<string, number>) => `{ ${Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')} }`;
    console.log(`- id: ${sheet.tradition}`);
    console.log(`    positions: ${fmt(t.positions)}`);
    if (t.divided.length) console.log(`    divided: [${t.divided.join(', ')}]`);
    console.log(`    principles: ${fmt(t.principles)}`);
  }
}
