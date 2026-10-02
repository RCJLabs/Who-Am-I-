// A deliberately tiny Markdown subset (headings, paragraphs, lists, bold, italic, code) parsed
// into data and rendered by Svelte, so no HTML string is ever injected into the page.
export type Inline = { t: 'text' | 'strong' | 'em' | 'code'; v: string };
export type Block =
  | { t: 'h'; level: 2 | 3 | 4; inl: Inline[] }
  | { t: 'p'; inl: Inline[] }
  | { t: 'ul'; items: Inline[][] };

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ t: 'strong', v: tok.slice(2, -2) });
    else if (tok.startsWith('`')) out.push({ t: 'code', v: tok.slice(1, -1) });
    else out.push({ t: 'em', v: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', inl: parseInline(para.join(' ')) });
    para = [];
    if (list) blocks.push({ t: 'ul', items: list.map(parseInline) });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(4, Math.max(2, heading[1]!.length + 1)) as 2 | 3 | 4;
      blocks.push({ t: 'h', level, inl: parseInline(heading[2]!) });
    } else if (/^[-*]\s+/.test(line)) {
      if (para.length) {
        blocks.push({ t: 'p', inl: parseInline(para.join(' ')) });
        para = [];
      }
      (list ??= []).push(line.replace(/^[-*]\s+/, ''));
    } else if (!line) {
      flush();
    } else if (list && raw.startsWith('  ')) {
      list[list.length - 1] += ` ${line}`;
    } else {
      if (list) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}
