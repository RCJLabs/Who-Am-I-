import { join } from 'node:path';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatPretty } from '../src/compiler/report.ts';
import type { AnswerEvent, Response, Via } from '../src/model/answers.ts';
import type { Bundle } from '../src/model/content.ts';

const FIX = 'tests/fixtures/content';
let fixture: Bundle | null = null;
let real: Bundle | null = null;

/** The compiled good fixtures (alpha, beta, gamma, traits, tunes). */
export function fixtureBundle(): Bundle {
  if (!fixture) fixture = mustCompile(loadContentDir(join(FIX, 'base'), [join(FIX, 'good')]));
  return fixture;
}

/** The compiled real content/ directory. */
export function realBundle(): Bundle {
  if (!real) real = mustCompile(loadContentDir('content'));
  return real;
}

function mustCompile(src: Parameters<typeof compile>[0]): Bundle {
  const { bundle, diagnostics } = compile(src);
  if (!bundle) throw new Error(`content failed to compile:\n${formatPretty(diagnostics)}`);
  return bundle;
}

export const scale = (step: number): Response => ({ kind: 'scale', step });
export const pick = (option: string, strength?: 1 | 2): Response =>
  strength === undefined ? { kind: 'option', option } : { kind: 'option', option, strength };
export const multi = (picks: Record<string, number | true>): Response => ({ kind: 'multi', picks });
export const skip: Response = { kind: 'skip' };
export const unsure: Response = { kind: 'unsure' };
export const declined: Response = { kind: 'declined' };

/** Builds an ordered event log with deterministic ids. */
export class Log {
  events: AnswerEvent[] = [];
  private n = 0;
  add(item: string, r: Response, via?: Via): AnswerEvent {
    this.n++;
    const ev: AnswerEvent = { id: `e${String(this.n).padStart(6, '0')}`, item, r, at: this.n, cv: 'test' };
    if (via) ev.via = via;
    this.events.push(ev);
    return ev;
  }
}
