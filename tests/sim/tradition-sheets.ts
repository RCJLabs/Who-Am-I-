// Answer sheets for the political traditions (tests/sim/traditions/<id>.yaml): the app's own
// political questions, and the statements behind the compared principles, answered as a
// thoughtful adherent would, citing the tradition's own writers. Scoring a sheet with the same
// engine as everyone's answers puts the tradition's targets on the same scales. Questions the
// tradition's adherents split on are marked divided and left out of the score; a spectrum or
// principle is divided when such questions carry a third of its weight or more.
// scripts/tradition-targets.ts prints the targets, and a content test keeps
// content/analysis/traditions.yaml in step with the sheets, so no target can be tuned by hand.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Bundle, Item } from '../../src/model/content.ts';
import { isScale, scalePoints } from '../../src/model/content.ts';
import { observe } from '../../src/engine/observe.ts';
import { scoreGroup } from '../../src/engine/score.ts';
import { buildAnswerState } from '../../src/engine/state.ts';
import { Log, scale } from '../helpers.ts';

export const SHEETS_DIR = 'tests/sim/traditions';
/** Share of a spectrum's or principle's weight that split questions need to make it divided. */
export const DIVIDED_SHARE = 1 / 3;

export interface Sheet {
  tradition: string;
  /** Scale steps, by item id. */
  answers: Record<string, number>;
  /** Items adherents split on: listed instead of answered. */
  divided?: string[];
}

export interface Targets {
  positions: Record<string, number>;
  principles: Record<string, number>;
  divided: string[];
}

export function loadSheets(dir = SHEETS_DIR): Sheet[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => parse(readFileSync(join(dir, f), 'utf8')) as Sheet);
}

/** Rounded to 0.05: the sheets are judgements, not measurements. */
const round = (v: number) => Math.round(v * 20) / 20 || 0;

export function scoreSheet(b: Bundle, sheet: Sheet, compare: readonly string[]): Targets {
  const items = new Map(b.topics.flatMap((t) => t.items.map((it): [string, Item] => [it.id, it])));
  const split = new Set(sheet.divided ?? []);
  for (const id of [...Object.keys(sheet.answers), ...split]) {
    const it = items.get(id);
    if (!it || !isScale(it)) throw new Error(`${sheet.tradition}: '${id}' isn't a scale question`);
  }
  for (const id of split) if (id in sheet.answers) throw new Error(`${sheet.tradition}: '${id}' is both answered and divided`);

  const answered = new Log();
  for (const [id, step] of Object.entries(sheet.answers)) answered.add(id, scale(step));
  const s = buildAnswerState(b, answered.events);
  for (const id of Object.keys(sheet.answers)) if (!s.values.has(id)) throw new Error(`${sheet.tradition}: '${id}' wouldn't be shown`);
  // The same weighted mean as anyone's score, without the evidence threshold: a target is a
  // judgement about the tradition, not limited by how many questions its adherents agree on.
  const obs = observe(s, { includeSensitive: false });
  const mean = (target: string): number | null => {
    const list = obs.filter((o) => o.target === target);
    return list.length ? scoreGroup(list, { minWeight: 0, fullWeight: 1, minTopics: 0 }).score : null;
  };

  // The weight each target would get with the split questions answered too (at the middle: weight
  // doesn't depend on the answer).
  const all = new Log();
  for (const e of answered.events) all.add(e.item, e.r);
  for (const id of split) {
    const it = items.get(id)!;
    if (isScale(it)) all.add(id, scale(Math.ceil(scalePoints(it) / 2)));
  }
  const weight = new Map<string, { total: number; split: number }>();
  for (const o of observe(buildAnswerState(b, all.events), { includeSensitive: false })) {
    const w = weight.get(o.target) ?? { total: 0, split: 0 };
    w.total += o.w;
    if (split.has(o.item)) w.split += o.w;
    weight.set(o.target, w);
  }
  const isDivided = (target: string) => {
    const w = weight.get(target);
    return !!w && w.total > 0 && w.split / w.total >= DIVIDED_SHARE;
  };

  const political = Object.values(b.axes).filter((a) => a.family === 'political');
  const positions: Record<string, number> = {};
  const divided: string[] = [];
  // Where every question is split, the target is the middle (and divided).
  const target = (t: string, id: string): number => {
    const v = mean(t);
    if (v !== null) return round(v);
    if (isDivided(t)) return 0;
    throw new Error(`${sheet.tradition}: no answers place it on '${id}'`);
  };
  for (const a of political) {
    positions[a.id] = target(`axis:${a.id}`, a.id);
    if (isDivided(`axis:${a.id}`)) divided.push(a.id);
  }
  const principles: Record<string, number> = {};
  for (const p of compare) {
    principles[p] = target(`principle:${p}`, p);
    if (isDivided(`principle:${p}`)) divided.push(p);
  }
  return { positions, principles, divided };
}
