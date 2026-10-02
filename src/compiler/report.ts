import { RULES, type Diagnostic } from './types.ts';

export function counts(diags: readonly Diagnostic[]): { errors: number; warnings: number } {
  const errors = diags.filter((d) => d.severity === 'error').length;
  return { errors, warnings: diags.length - errors };
}

export function formatPretty(diags: readonly Diagnostic[]): string {
  return diags
    .map((d) => `${d.file}:${d.line}:${d.col}  ${d.severity === 'error' ? 'error' : 'warn '}  ${d.code} ${RULES[d.code] ?? ''}  ${d.message}`)
    .join('\n');
}

/** GitHub Actions workflow commands: shown inline on the PR diff. */
export function formatGithub(diags: readonly Diagnostic[]): string {
  const prop = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');
  const msg = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return diags
    .map(
      (d) =>
        `::${d.severity === 'error' ? 'error' : 'warning'} file=${prop(d.file)},line=${d.line},col=${d.col},title=${prop(`${d.code} ${RULES[d.code] ?? ''}`.trim())}::${msg(d.message)}`,
    )
    .join('\n');
}

export function summaryMarkdown(diags: readonly Diagnostic[], extra: string): string {
  const { errors, warnings } = counts(diags);
  const byCode = new Map<string, number>();
  for (const d of diags) byCode.set(d.code, (byCode.get(d.code) ?? 0) + 1);
  const rows = [...byCode.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, n]) => `| ${code} | ${RULES[code] ?? ''} | ${n} |`);
  return [
    `### Content lint: ${errors} error(s), ${warnings} warning(s)`,
    extra,
    rows.length ? '\n| Code | Rule | Count |\n|---|---|---|\n' + rows.join('\n') : '',
    '',
  ].join('\n');
}
