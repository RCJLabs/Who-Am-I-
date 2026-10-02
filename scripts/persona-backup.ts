// Turns a simulated persona into an importable backup file (for manual QA and e2e tests).
//   node scripts/persona-backup.ts tests/sim/personas/religious_conservative.yaml out.json
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { makeBackup } from '../src/app/storage/backup.ts';
import { engineTensions, runRespondent } from '../tests/sim/harness.ts';
import { personaResponses, scriptedPolicy } from '../tests/sim/policies.ts';

const [personaPath, outPath] = process.argv.slice(2);
if (!personaPath || !outPath) {
  console.error('usage: node scripts/persona-backup.ts <persona.yaml> <out.json>');
  process.exit(2);
}

const { bundle } = compile(loadContentDir('content'));
if (!bundle) throw new Error('content does not compile; run npm run content:lint');

const persona = parse(readFileSync(personaPath, 'utf8')) as { topics: string[]; answers: Record<string, number | string | string[]> };
const run = runRespondent(bundle, scriptedPolicy(personaResponses(persona.answers)), { topics: persona.topics, tensions: engineTensions, tensionPolicy: () => null });
const backup = makeBackup({
  events: run.events,
  resolutions: run.resolutions,
  settings: { alwaysDeep: false, seed: 'persona' },
  contentVersion: bundle.contentVersion,
  appVersion: 'persona-backup',
  now: new Date(),
});
writeFileSync(outPath, JSON.stringify(backup, null, 2));
console.log(`wrote ${outPath}: ${backup.events.length} answers`);
