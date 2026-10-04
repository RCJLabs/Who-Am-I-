// Reads a content directory from disk. Node-only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { AnalysisSources, ContentSources, SourceFile } from './types.ts';

/** The analysis pack's files, under content/analysis/. */
const PACK_FILES = ['traditions', 'readings', 'suggestions'] as const;

function read(path: string): SourceFile {
  return { path: relative(process.cwd(), path).split(sep).join('/'), text: readFileSync(path, 'utf8') };
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.ya?ml$/.test(e.name) ? [join(dir, e.name)] : []))
    .sort();
}

export function loadContentDir(dir: string, topicDirs: string[] = [join(dir, 'topics')]): ContentSources {
  const terms = join(dir, 'loaded-terms.txt');
  const sources: ContentSources = {
    config: read(join(dir, 'config.yaml')),
    domains: read(join(dir, 'domains.yaml')),
    axes: read(join(dir, 'axes.yaml')),
    principles: read(join(dir, 'principles.yaml')),
    topics: topicDirs.flatMap(walk).map(read),
  };
  if (existsSync(terms)) sources.loadedTerms = read(terms);
  const named = join(dir, 'named-politics.txt');
  if (existsSync(named)) sources.namedPolitics = read(named);
  if (existsSync(join(dir, 'analysis'))) {
    const pack: AnalysisSources = {};
    for (const f of PACK_FILES) {
      const path = join(dir, 'analysis', `${f}.yaml`);
      if (existsSync(path)) pack[f] = read(path);
    }
    const sheets = walk(join(dir, 'analysis', 'sheets'));
    if (sheets.length) pack.sheets = sheets.map(read);
    const packTerms = join(dir, 'analysis', 'loaded-terms.txt');
    if (existsSync(packTerms)) pack.loadedTerms = read(packTerms);
    const blocked = join(dir, 'analysis', 'blocked-advice.txt');
    if (existsSync(blocked)) pack.blockedAdvice = read(blocked);
    sources.analysis = pack;
  }
  return sources;
}

/** Every file that affects compilation (for dev-server watching). */
export function contentFilePaths(dir: string): string[] {
  const fixed = [
    'config.yaml',
    'domains.yaml',
    'axes.yaml',
    'principles.yaml',
    'loaded-terms.txt',
    'named-politics.txt',
    ...PACK_FILES.map((f) => join('analysis', `${f}.yaml`)),
    join('analysis', 'loaded-terms.txt'),
    join('analysis', 'blocked-advice.txt'),
  ]
    .map((f) => join(dir, f))
    .filter(existsSync);
  return [...fixed, ...walk(join(dir, 'topics')), ...walk(join(dir, 'analysis', 'sheets'))];
}
