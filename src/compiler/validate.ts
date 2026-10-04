// Helpers shared by the content compiler and the analysis-pack compiler.
import type { z } from 'zod';
import type { Reporter } from './context.ts';
import type { Diagnostic } from './types.ts';
import type { ParsedFile, Path } from './yaml.ts';

/** Checks a parsed file against its schema, reporting each problem as E002 at its path. */
export function validate<T>(pf: ParsedFile, schema: z.ZodType<T>, rep: Reporter): T | null {
  const res = schema.safeParse(pf.data);
  if (res.success) return res.data;
  for (const issue of res.error.issues) {
    let path = issue.path.filter((p): p is string | number => typeof p !== 'symbol');
    let message = issue.message;
    if (issue.code === 'unrecognized_keys') {
      path = [...path, issue.keys[0]!];
      message = `Unknown key${issue.keys.length > 1 ? 's' : ''}: ${issue.keys.join(', ')}`;
    }
    const where = path.length ? `${path.join('.')}: ` : '';
    rep.report('E002', `${where}${message}`, { pf, path });
  }
  return null;
}

/** Reports every repeated id in a list as E003. */
export function checkUnique<T extends { id: string }>(list: readonly T[], what: string, pf: ParsedFile, base: Path, rep: Reporter): void {
  const seen = new Set<string>();
  list.forEach((x, i) => {
    if (seen.has(x.id)) rep.report('E003', `Duplicate ${what} id '${x.id}'`, { pf, path: [...base, i, 'id'] });
    seen.add(x.id);
  });
}

export function sortDiags(d: Diagnostic[]): Diagnostic[] {
  return [...d].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.code.localeCompare(b.code));
}

/** JSON with object keys sorted, so equal content always hashes the same. */
export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : val,
  );
}
