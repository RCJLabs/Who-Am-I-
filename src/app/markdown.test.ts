import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown.ts';

describe('markdown subset', () => {
  it('parses inline emphasis and code', () => {
    expect(parseInline('a **b** *c* `d` e')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'strong', v: 'b' },
      { t: 'text', v: ' ' },
      { t: 'em', v: 'c' },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'd' },
      { t: 'text', v: ' e' },
    ]);
  });

  it('parses headings, paragraphs, lists with continuation lines, and drops comments', () => {
    const blocks = parseMarkdown('# Title\n\nOne\ntwo\n\n- a\n  more\n- b\n<!-- hidden -->\nEnd');
    expect(blocks).toEqual([
      { t: 'h', level: 2, inl: [{ t: 'text', v: 'Title' }] },
      { t: 'p', inl: [{ t: 'text', v: 'One two' }] },
      { t: 'ul', items: [[{ t: 'text', v: 'a more' }], [{ t: 'text', v: 'b' }]] },
      { t: 'p', inl: [{ t: 'text', v: 'End' }] },
    ]);
  });

  it('renders the privacy policy without losing text', () => {
    const md = readFileSync('docs/PRIVACY.md', 'utf8');
    const text = JSON.stringify(parseMarkdown(md));
    expect(text).toContain('does not collect your data');
    expect(text).not.toContain('TODO');
  });
});
