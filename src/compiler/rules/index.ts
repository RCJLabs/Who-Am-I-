import type { Item } from '../../model/content.ts';
import type { CompiledTopic, Env, Reporter, RuleCtx } from '../context.ts';
import { qualityRules } from './quality.ts';
import { reachRules } from './reach.ts';
import { structureRules } from './structure.ts';

export function runRules(base: { topics: CompiledTopic[]; env: Env; rep: Reporter }): void {
  const byId = new Map<string, { item: Item; ct: CompiledTopic }>();
  for (const ct of base.topics) for (const item of ct.topic.items) byId.set(item.id, { item, ct });
  const ctx: RuleCtx = { ...base, byId };
  structureRules(ctx);
  reachRules(ctx);
  qualityRules(ctx);
}
