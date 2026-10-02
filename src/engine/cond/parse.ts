// Condition language for `when:` fields.
//
//   expr  := or
//   or    := and ("or" and)*
//   and   := unary ("and" unary)*
//   unary := "not" unary | atom
//   atom  := "(" expr ")" | "answered" "(" ref ")"
//          | ref CMP NUMBER          CMP: < <= > >= == !=   NUMBER: normalized, -1..1
//          | ref "is" IDENT          chosen option id
//          | ref "has" IDENT         multi-select includes option id
//   ref   := IDENT | IDENT "." IDENT  local item id, or topic.item
//
// The parser returns refs exactly as written; the compiler resolves and type-checks them.
import type { CmpOp, Cond } from '../../model/content.ts';

export const COND_KEYWORDS: ReadonlySet<string> = new Set(['and', 'or', 'not', 'is', 'has', 'answered']);

export interface RefUse {
  ref: string;
  col: number;
  use: 'cmp' | 'is' | 'has' | 'answered';
  option?: string;
  optionCol?: number;
}

export type ParseResult = { ok: true; cond: Cond; uses: RefUse[] } | { ok: false; message: string; col: number };

type TokKind = 'ident' | 'num' | 'op' | 'lparen' | 'rparen' | 'eof';
interface Token {
  kind: TokKind;
  text: string;
  col: number;
}

class CondSyntaxError extends Error {
  col: number;
  constructor(message: string, col: number) {
    super(message);
    this.col = col;
  }
}

const IDENT_RE = /[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?/y;
const NUM_RE = /-?(?:\d+(?:\.\d*)?|\.\d+)/y;
const CMP_OPS: readonly CmpOp[] = ['<=', '>=', '==', '!=', '<', '>'];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      out.push({ kind: 'lparen', text: ch, col: i++ });
      continue;
    }
    if (ch === ')') {
      out.push({ kind: 'rparen', text: ch, col: i++ });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '&&') throw new CondSyntaxError("Use 'and' instead of '&&'", i);
    if (two === '||') throw new CondSyntaxError("Use 'or' instead of '||'", i);
    const op = CMP_OPS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ kind: 'op', text: op, col: i });
      i += op.length;
      continue;
    }
    if (ch === '!') throw new CondSyntaxError("Use 'not' instead of '!'", i);
    if (ch === '=') throw new CondSyntaxError("Use '==' to compare", i);
    NUM_RE.lastIndex = i;
    const num = NUM_RE.exec(src);
    if (num) {
      out.push({ kind: 'num', text: num[0], col: i });
      i += num[0].length;
      continue;
    }
    IDENT_RE.lastIndex = i;
    const id = IDENT_RE.exec(src);
    if (id) {
      out.push({ kind: 'ident', text: id[0], col: i });
      i += id[0].length;
      continue;
    }
    if (/[A-Z]/.test(ch)) throw new CondSyntaxError('Ids are lowercase snake_case', i);
    throw new CondSyntaxError(`Unexpected character '${ch}'`, i);
  }
  out.push({ kind: 'eof', text: '', col: src.length });
  return out;
}

export function parseCond(src: string): ParseResult {
  let toks: Token[];
  try {
    toks = tokenize(src);
  } catch (e) {
    if (e instanceof CondSyntaxError) return { ok: false, message: e.message, col: e.col };
    throw e;
  }
  let i = 0;
  const uses: RefUse[] = [];
  const peek = (): Token => toks[i]!;
  const next = (): Token => toks[i++]!;
  const isKw = (t: Token, kw: string): boolean => t.kind === 'ident' && t.text === kw;

  function expect(kind: TokKind, what: string): Token {
    const t = peek();
    if (t.kind !== kind) throw new CondSyntaxError(`Expected ${what}${describe(t)}`, t.col);
    return next();
  }

  function expectRef(): Token {
    const t = peek();
    if (t.kind !== 'ident' || COND_KEYWORDS.has(t.text)) throw new CondSyntaxError(`Expected an item id${describe(t)}`, t.col);
    return next();
  }

  function parseOr(): Cond {
    const args = [parseAnd()];
    while (isKw(peek(), 'or')) {
      next();
      args.push(parseAnd());
    }
    return args.length === 1 ? args[0]! : { op: 'or', args };
  }

  function parseAnd(): Cond {
    const args = [parseUnary()];
    while (isKw(peek(), 'and')) {
      next();
      args.push(parseUnary());
    }
    return args.length === 1 ? args[0]! : { op: 'and', args };
  }

  function parseUnary(): Cond {
    if (isKw(peek(), 'not')) {
      next();
      return { op: 'not', arg: parseUnary() };
    }
    return parseAtom();
  }

  function parseAtom(): Cond {
    const t = peek();
    if (t.kind === 'lparen') {
      next();
      const inner = parseOr();
      expect('rparen', "')'");
      return inner;
    }
    if (isKw(t, 'answered')) {
      next();
      expect('lparen', "'(' after answered");
      const ref = expectRef();
      expect('rparen', "')'");
      uses.push({ ref: ref.text, col: ref.col, use: 'answered' });
      return { op: 'answered', ref: ref.text };
    }
    if (t.kind === 'ident' && !COND_KEYWORDS.has(t.text)) {
      const ref = next();
      const after = peek();
      if (after.kind === 'op') {
        next();
        const num = peek();
        if (num.kind !== 'num') throw new CondSyntaxError(`Expected a number after '${after.text}'${describe(num)}`, num.col);
        next();
        const value = Number(num.text);
        if (!(value >= -1 && value <= 1)) {
          throw new CondSyntaxError('Numbers are normalized values between -1 and 1 (7-point scale: 1→-1, 4→0, 7→1)', num.col);
        }
        uses.push({ ref: ref.text, col: ref.col, use: 'cmp' });
        return { op: 'cmp', ref: ref.text, cmp: after.text as CmpOp, value };
      }
      if (isKw(after, 'is') || isKw(after, 'has')) {
        next();
        const opt = peek();
        if (opt.kind !== 'ident' || COND_KEYWORDS.has(opt.text) || opt.text.includes('.')) {
          throw new CondSyntaxError(`Expected an option id after '${after.text}'${describe(opt)}`, opt.col);
        }
        next();
        const use = after.text as 'is' | 'has';
        uses.push({ ref: ref.text, col: ref.col, use, option: opt.text, optionCol: opt.col });
        return { op: use, ref: ref.text, option: opt.text };
      }
      throw new CondSyntaxError(`Expected a comparison, 'is' or 'has' after '${ref.text}'${describe(after)}`, after.col);
    }
    throw new CondSyntaxError(`Expected a condition${describe(t)}`, t.col);
  }

  try {
    const cond = parseOr();
    const rest = peek();
    if (rest.kind !== 'eof') {
      const hint = rest.kind === 'ident' && !COND_KEYWORDS.has(rest.text) ? " (missing 'and' / 'or'?)" : '';
      throw new CondSyntaxError(`Unexpected '${rest.text}'${hint}`, rest.col);
    }
    return { ok: true, cond, uses };
  } catch (e) {
    if (e instanceof CondSyntaxError) return { ok: false, message: e.message, col: e.col };
    throw e;
  }
}

function describe(t: Token): string {
  return t.kind === 'eof' ? ', found end of condition' : `, found '${t.text}'`;
}

/** Rewrites every ref through `map` (used by the compiler to qualify local ids). */
export function mapRefs(c: Cond, map: (ref: string) => string): Cond {
  switch (c.op) {
    case 'and':
    case 'or':
      return { op: c.op, args: c.args.map((a) => mapRefs(a, map)) };
    case 'not':
      return { op: 'not', arg: mapRefs(c.arg, map) };
    case 'cmp':
      return { ...c, ref: map(c.ref) };
    case 'is':
    case 'has':
      return { ...c, ref: map(c.ref) };
    case 'answered':
      return { op: 'answered', ref: map(c.ref) };
  }
}

/** All refs in a condition, in order of appearance (with duplicates removed). */
export function condRefs(c: Cond | undefined): string[] {
  const out = new Set<string>();
  const walk = (n: Cond): void => {
    switch (n.op) {
      case 'and':
      case 'or':
        n.args.forEach(walk);
        return;
      case 'not':
        walk(n.arg);
        return;
      default:
        out.add(n.ref);
    }
  };
  if (c) walk(c);
  return [...out];
}

/** Option ids tested with `has` against `ref` (to build multi-select domains). */
export function hasTags(c: Cond | undefined, ref: string): string[] {
  const out = new Set<string>();
  const walk = (n: Cond): void => {
    if (n.op === 'and' || n.op === 'or') n.args.forEach(walk);
    else if (n.op === 'not') walk(n.arg);
    else if (n.op === 'has' && n.ref === ref) out.add(n.option);
  };
  if (c) walk(c);
  return [...out];
}
