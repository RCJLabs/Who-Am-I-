// YAML parsing that keeps source positions so every diagnostic can point at a file and line.
import { isScalar, LineCounter, parseDocument, type Document } from 'yaml';
import type { Diagnostic, SourceFile } from './types.ts';

export type Path = readonly (string | number)[];

export interface ParsedFile {
  file: SourceFile;
  doc: Document.Parsed;
  lc: LineCounter;
  data: unknown;
}

export function parseYaml(file: SourceFile, diags: Diagnostic[]): ParsedFile | null {
  const lc = new LineCounter();
  const doc = parseDocument(file.text, { lineCounter: lc, uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length) {
    for (const e of doc.errors) {
      const { line, col } = lc.linePos(e.pos[0]);
      const message = e.code === 'DUPLICATE_KEY' ? 'Duplicate key' : e.message.split('\n')[0]!;
      diags.push({ code: 'E001', severity: 'error', message, file: file.path, line, col });
    }
    return null;
  }
  return { file, doc, lc, data: doc.toJS() };
}

interface Ranged {
  range?: [number, number, number] | null;
}

function nodeAt(pf: ParsedFile, path: Path): Ranged | null {
  const node = (path.length === 0 ? pf.doc.contents : pf.doc.getIn(path, true)) as unknown;
  if (node && typeof node === 'object' && 'range' in node && (node as Ranged).range) return node as Ranged;
  return null;
}

/** Position of the node at `path`, falling back to the nearest existing parent. */
export function posOf(pf: ParsedFile, path: Path, colOffset = 0): { line: number; col: number } {
  for (let n = path.length; n >= 0; n--) {
    const node = nodeAt(pf, path.slice(0, n));
    if (node?.range) {
      let start = node.range[0];
      if (n === path.length && colOffset) {
        const quoted = isScalar(node) && (node.type === 'QUOTE_DOUBLE' || node.type === 'QUOTE_SINGLE');
        start += colOffset + (quoted ? 1 : 0);
      }
      return pf.lc.linePos(start);
    }
  }
  return { line: 1, col: 1 };
}
