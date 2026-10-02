// Generates JSON Schemas from the zod source of truth.
//   node scripts/gen-schemas.ts          write files
//   node scripts/gen-schemas.ts --check  fail if committed files are stale (CI)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { TopicFileSchema } from '../src/model/authored.ts';
import { ProfileSchema } from '../src/model/profile.ts';

const outputs = [
  { path: 'schema/topic.schema.json', schema: TopicFileSchema, title: 'Who Am I topic file' },
  { path: 'docs/profile.schema.json', schema: ProfileSchema, title: 'Who Am I profile (profileVersion 1)' },
];

const check = process.argv.includes('--check');
let stale = 0;

for (const out of outputs) {
  const generated = { title: out.title, ...z.toJSONSchema(out.schema, { target: 'draft-7' }) };
  const text = JSON.stringify(generated, null, 2) + '\n';
  if (check) {
    let current = '';
    try {
      current = readFileSync(out.path, 'utf8');
    } catch {
      // missing counts as stale
    }
    if (current !== text) {
      console.error(`${out.path} is stale. Run: npm run schemas`);
      stale++;
    }
  } else {
    mkdirSync(dirname(out.path), { recursive: true });
    writeFileSync(out.path, text);
    console.log(`wrote ${out.path}`);
  }
}

if (stale) process.exit(1);
