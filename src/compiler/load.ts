// Reads a content directory from disk. Node-only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ContentSources, SourceFile } from './types.ts';

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
  return sources;
}

/** Every file that affects compilation (for dev-server watching). */
export function contentFilePaths(dir: string): string[] {
  const fixed = ['config.yaml', 'domains.yaml', 'axes.yaml', 'principles.yaml', 'loaded-terms.txt']
    .map((f) => join(dir, f))
    .filter(existsSync);
  return [...fixed, ...walk(join(dir, 'topics'))];
}
