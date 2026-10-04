// Answer sheets (content/analysis/sheets/<tradition>.yaml): the app's own political questions,
// and the statements behind the compared principles, answered as a thoughtful adherent of a
// tradition would. The engine scores a sheet like anyone's answers, so a tradition's positions sit
// on the same scales as the user's and are never written by hand. Questions its adherents split on
// are listed as divided: they count at the middle of their scale, where the tradition as a whole
// sits when its adherents divide into camps, and are left out of the question-by-question fit. A
// spectrum or principle is divided when such questions carry half its weight or more.
// E015 keeps every sheet complete and on shareable questions only.
import type { AnswerEvent } from '../model/answers.ts';
import type { SheetFile } from '../model/analysis.ts';
import type { Bundle, Item, ItemId, Topic } from '../model/content.ts';
import { isScale, scalePoints } from '../model/content.ts';
import { stepValue } from '../engine/normalize.ts';
import { observe } from '../engine/observe.ts';
import { scoreGroup } from '../engine/score.ts';
import { buildAnswerState } from '../engine/state.ts';
import type { Env, Loc, Reporter } from './context.ts';
import type { ParsedFile } from './yaml.ts';

/** Share of a spectrum's or principle's weight that split questions need to make it divided. */
export const DIVIDED_SHARE = 1 / 2;

export interface SheetTargets {
  positions: Record<string, number>;
  principles: Record<string, number>;
  divided: string[];
  /** The answers to the political questions, as values -1..1. */
  answers: Record<ItemId, number>;
}

interface Question {
  item: Item;
  topic: Topic;
}

/** Rounded to 0.05: a sheet is a judgement, not a measurement. */
const round = (v: number) => Math.round(v * 20) / 20 || 0;
const round4 = (v: number) => Math.round(v * 1e4) / 1e4 || 0;

/** The political spectrums traditions are placed on: every one in use (not planned). */
export function politicalAxes(env: Env): string[] {
  return [...env.axes.values()].filter((a) => a.family === 'political' && !a.planned).map((a) => a.id);
}

/** Shareable scale questions that feed a political spectrum: every sheet answers each one, or lists it as divided. */
export function politicalQuestions(b: Bundle, axes: readonly string[]): ItemId[] {
  const political = new Set(axes.map((a) => `axis:${a}`));
  return b.topics
    .filter((t) => !t.sensitive)
    .flatMap((t) => t.items.filter((it) => isScale(it) && it.type !== 'importance' && !it.sensitive && it.effects.some((e) => political.has(e.target))).map((it) => it.id));
}

function events(answers: Record<ItemId, number>): AnswerEvent[] {
  return Object.entries(answers).map(([item, step], i) => ({ id: `s${String(i + 1).padStart(6, '0')}`, item, r: { kind: 'scale', step }, at: i + 1, cv: 'sheet' }));
}

/**
 * Checks a sheet (E004, E015) and scores it. Null when it has errors: its targets would be
 * guesses.
 */
export function scoreSheet(b: Bundle, env: Env, sheet: { pf: ParsedFile; file: SheetFile }, compare: readonly string[], rep: Reporter): SheetTargets | null {
  const { pf, file } = sheet;
  const errors = rep.errors;
  const at = (...path: (string | number)[]): Loc => ({ pf, path });
  const axes = politicalAxes(env);
  const political = new Set(politicalQuestions(b, axes));
  const questions = new Map<ItemId, Question>(b.topics.flatMap((topic) => topic.items.map((item): [ItemId, Question] => [item.id, { item, topic }])));
  const targets = new Set([...axes.map((a) => `axis:${a}`), ...compare.map((p) => `principle:${p}`)]);

  /** A question a sheet may answer: a shareable scale question that places traditions on something. */
  const usable = (id: string, loc: Loc): Question | null => {
    const q = questions.get(id);
    if (!q) {
      rep.report('E004', `Unknown question '${id}'`, loc);
      return null;
    }
    if (!isScale(q.item) || q.item.type === 'importance') rep.report('E015', `'${id}' isn't a scale question`, loc);
    else if (q.topic.sensitive || q.item.sensitive) rep.report('E015', `'${id}' is sensitive: traditions are placed only on answers that could be shared`, loc);
    else if (!q.item.effects.some((e) => targets.has(e.target))) rep.report('E015', `'${id}' places nothing: it feeds no political spectrum or compared principle`, loc);
    else return q;
    return null;
  };

  const split = new Set<ItemId>();
  (file.divided ?? []).forEach((id, k) => {
    if (id in file.answers) rep.report('E015', `'${id}' is both answered and divided`, at('divided', k));
    else if (split.has(id)) rep.report('E003', `'${id}' is listed twice as divided`, at('divided', k));
    else if (usable(id, at('divided', k))) split.add(id);
  });
  for (const [id, step] of Object.entries(file.answers)) {
    const q = usable(id, at('answers', id));
    if (q && isScale(q.item) && step > scalePoints(q.item)) rep.report('E015', `'${id}' has ${scalePoints(q.item)} steps, not ${step}`, at('answers', id));
  }
  const missing = [...political].filter((id) => !(id in file.answers) && !split.has(id));
  if (missing.length) {
    rep.report('E015', `'${file.tradition}' answers none of ${missing.map((id) => `'${id}'`).join(', ')}: answer each as an adherent would, or list it as divided`, at('answers'));
  }
  if (rep.errors > errors) return null;

  const answered = buildAnswerState(b, events(file.answers));
  for (const id of Object.keys(file.answers)) {
    if (!answered.values.has(id)) rep.report('E015', `'${id}' wouldn't be shown with these answers`, at('answers', id));
  }
  // Split questions answered at the middle step, where the tradition as a whole sits on them.
  const middle: Record<ItemId, number> = {};
  for (const id of split) {
    const it = questions.get(id)!.item;
    if (isScale(it)) middle[id] = Math.ceil(scalePoints(it) / 2);
  }
  const obs = observe(buildAnswerState(b, events({ ...file.answers, ...middle })), { includeSensitive: false });
  // The same weighted mean as anyone's score, without the evidence threshold: a target is a
  // judgement about the tradition, not limited by how many questions its adherents agree on.
  const mean = (target: string): number | null => {
    const list = obs.filter((o) => o.target === target);
    return list.length ? scoreGroup(list, { minWeight: 0, fullWeight: 1, minTopics: 0 }).score : null;
  };
  const weight = new Map<string, { total: number; split: number }>();
  for (const o of obs) {
    const w = weight.get(o.target) ?? { total: 0, split: 0 };
    w.total += o.w;
    if (split.has(o.item)) w.split += o.w;
    weight.set(o.target, w);
  }
  const isDivided = (target: string) => {
    const w = weight.get(target);
    return !!w && w.total > 0 && w.split / w.total >= DIVIDED_SHARE;
  };

  const out: SheetTargets = { positions: {}, principles: {}, divided: [], answers: {} };
  const place = (target: string, id: string, into: Record<string, number>) => {
    const v = mean(target);
    if (v === null) {
      rep.report('E015', `No answer places '${file.tradition}' on '${id}'`, at('answers'));
      return;
    }
    into[id] = round(v);
    if (isDivided(target)) out.divided.push(id);
  };
  for (const a of axes) place(`axis:${a}`, a, out.positions);
  for (const p of compare) place(`principle:${p}`, p, out.principles);
  for (const [id, step] of Object.entries(file.answers)) {
    const it = questions.get(id)!.item;
    if (political.has(id) && isScale(it)) out.answers[id] = round4(stepValue(step, scalePoints(it)));
  }
  return rep.errors > errors ? null : out;
}
