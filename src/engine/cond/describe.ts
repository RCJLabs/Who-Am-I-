// Plain-language rendering of conditions: 'stance is on the "Illegal in all cases" side and rape is
// on the "Legal" side'.
// Used by the content preview, and later by "why am I seeing this?".
import type { Cond, Item } from '../../model/content.ts';

const nearZero = (x: number): boolean => Math.abs(x) < 0.005;

function poles(item: Item | undefined): [string, string] | null {
  if (!item) return null;
  if (item.type === 'slider' || item.type === 'rating') return item.poles;
  if (item.type === 'likert') return ['disagree', 'agree'];
  if (item.type === 'importance') return ['not at all', 'a lot'];
  return null;
}

function optionLabel(item: Item | undefined, id: string): string {
  if (item && 'options' in item) return item.options.find((o) => o.id === id)?.label ?? id;
  return id;
}

export function describeCond(c: Cond, items: ReadonlyMap<string, Item>): string {
  const name = (ref: string): string => (items.get(ref)?.key ?? ref).replace(/_/g, ' ');
  const sub = (a: Cond, parent: 'and' | 'or'): string => {
    const text = describeCond(a, items);
    return (a.op === 'and' || a.op === 'or') && a.op !== parent ? `(${text})` : text;
  };
  switch (c.op) {
    case 'and':
    case 'or':
      return c.args.map((a) => sub(a, c.op as 'and' | 'or')).join(` ${c.op} `);
    case 'not':
      return `not (${describeCond(c.arg, items)})`;
    case 'answered':
      return `${name(c.ref)} was answered`;
    case 'is':
      return `${name(c.ref)} is "${optionLabel(items.get(c.ref), c.option)}"`;
    case 'has':
      return `${name(c.ref)} includes "${optionLabel(items.get(c.ref), c.option)}"`;
    case 'cmp': {
      const p = poles(items.get(c.ref));
      if (p && nearZero(c.value)) {
        switch (c.cmp) {
          case '<':
            return `${name(c.ref)} is on the "${p[0]}" side`;
          case '>':
            return `${name(c.ref)} is on the "${p[1]}" side`;
          case '==':
            return `${name(c.ref)} is in the middle`;
          case '!=':
            return `${name(c.ref)} isn't in the middle`;
          case '<=':
            return `${name(c.ref)} is in the middle or on the "${p[0]}" side`;
          case '>=':
            return `${name(c.ref)} is in the middle or on the "${p[1]}" side`;
        }
      }
      return `${name(c.ref)} ${c.cmp} ${c.value}`;
    }
  }
}
