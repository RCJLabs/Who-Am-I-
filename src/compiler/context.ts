// Shared compiler context: diagnostics reporter and the structures rules operate on.
import type { AxisDef, ConfigFile, DomainDef, PrincipleDef, TopicFile } from '../model/authored.ts';
import type { Item, Topic } from '../model/content.ts';
import type { Diagnostic } from './types.ts';
import { posOf, type ParsedFile, type Path } from './yaml.ts';

export interface Loc {
  pf: ParsedFile;
  path: Path;
  colOffset?: number;
}

export class Reporter {
  diagnostics: Diagnostic[] = [];
  report(code: string, message: string, loc: Loc): void {
    const { line, col } = posOf(loc.pf, loc.path, loc.colOffset);
    this.diagnostics.push({
      code,
      severity: code.startsWith('E') ? 'error' : 'warning',
      message,
      file: loc.pf.file.path,
      line,
      col,
    });
  }
  get errors(): number {
    return this.diagnostics.filter((d) => d.severity === 'error').length;
  }
}

/** A validated topic file with what rules need to locate things. */
export interface TopicCtx {
  pf: ParsedFile;
  tf: TopicFile;
  /** Local item id → index of its first occurrence. */
  index: Map<string, number>;
}

export interface Env {
  axes: Map<string, AxisDef>;
  principles: Map<string, PrincipleDef>;
  domains: Map<string, DomainDef>;
  config: ConfigFile;
  axesFile: ParsedFile;
  principlesFile: ParsedFile;
  domainsFile: ParsedFile;
  loadedTerms: string[];
}

export interface CompiledTopic {
  topic: Topic;
  tc: TopicCtx;
}

export interface RuleCtx {
  topics: CompiledTopic[];
  env: Env;
  rep: Reporter;
  byId: Map<string, { item: Item; ct: CompiledTopic }>;
}

/** Item types whose answer a challenge can target or a revise can re-ask. */
export const REVISABLE: ReadonlySet<string> = new Set(['likert', 'slider', 'rating', 'choice', 'pair']);

export function itemLoc(ct: CompiledTopic, key: string, ...sub: (string | number)[]): Loc {
  return { pf: ct.tc.pf, path: ['items', ct.tc.index.get(key) ?? 0, ...sub] };
}

export function topicLoc(ct: CompiledTopic, ...path: (string | number)[]): Loc {
  return { pf: ct.tc.pf, path };
}
