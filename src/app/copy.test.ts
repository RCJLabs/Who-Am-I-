// Checks every piece of app wording the way the content lint checks topics: no loaded terms
// (content/loaded-terms.txt), and in the analysis no prescriptions or comparisons with others.
// Every template is called with sample arguments, so a new one can't skip the check.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findTerms, parseTerms, termMatchers } from '../compiler/loaded-terms.ts';
import { copy, list } from './copy.ts';

type Fn = (...args: never[]) => string;

const SAMPLES: Record<string, unknown[][]> = {
  'home.continueTopic': [['Abortion', 3]],
  'home.progress': [[2, 78]],
  'topics.left': [[1], [4]],
  'flow.progress': [[3, 12]],
  'flow.doneTitle': [['Guns']],
  'flow.startedAt': [['Legal in most cases']],
  'flow.moved': [[2, 'The violinist'], [-1, 'The violinist']],
  'flow.heldAll': [[1], [3]],
  'flow.nextTopic': [['Free speech']],
  'tension.intro': [['Bodily autonomy']],
  'tension.youAnswered': [['Abortion']],
  'tension.competing': [['pregnancy', 'the life of the fetus']],
  'results.confidence': [[0.62]],
  'results.consistency': [[0.5]],
  'results.challengesSummary': [[4, 2, 1, 1], [1, 1, 0, 0]],
  'results.movedLine': [['The violinist', 2, 'Allowed'], ['Thinking it over', -1, 'agree']],
  'results.basedOn': [[5, 78]],
  'results.challengesTotal': [[1], [9]],
  'results.showAll': [[8]],
  'results.morePicks': [[3]],
  'results.topicCount': [[1], [5]],
  'results.reconsideredCount': [[2]],
  'results.principleTensions': [[1], [2]],
  'results.toward': [['Liberty']],
  'analysis.headline.leanings': [[['Markets']], [['Progress', 'Equality']]],
  'analysis.headline.principles': [[['Liberty', 'Due process']]],
  'analysis.headline.personality': [[['very outgoing', 'fairly organized']]],
  'analysis.overview.spectrums': [[1], [14]],
  'analysis.overview.line.principles': [[['Care']], [['Care', 'Liberty']]],
  'analysis.overview.line.principleCount': [[1], [12]],
  'analysis.overview.line.tensions': [[2, 0], [0, 3], [1, 1]],
  'analysis.overview.line.positions': [[1, 0], [12, 3]],
  'analysis.overview.line.enjoys': [[['Jazz']], [['Hip-hop / rap', 'Korean food']]],
  'analysis.tiles.topicsOf': [[78]],
  'analysis.tiles.reconsidered': [[0], [3]],
  'analysis.toward.slight': [[['Liberty']], [['Authority', 'National']]],
  'analysis.toward.plain': [[['Tradition']]],
  'analysis.toward.strong': [[['Global', 'Progress']]],
  'analysis.lean': [
    ['Politically,', ['strongly toward “Markets”', 'toward “Tradition”'], ['Civil']],
    ['In your values,', ['toward “Change”'], []],
    ['In your taste,', [], ['Familiar or new', 'Popular or lesser-known']],
  ],
  'analysis.pullsBothWays': [['Civil', ['Drug policy', 'Privacy and surveillance'], 'Liberty', ['Guns'], 'Authority']],
  'analysis.personality': [[['very outgoing', 'neither practical nor imaginative']]],
  'analysis.trait.slight': [['Reserved']],
  'analysis.trait.plain': [['Organized']],
  'analysis.trait.strong': [['Even-keeled']],
  'analysis.trait.neither': [['Practical', 'Imaginative']],
  'analysis.principlesTop': [[['Care']], [['Liberty', 'Due process', 'Equality']]],
  'analysis.principlesLow': [['Respect for authority']],
  'analysis.consistency': [['Bodily autonomy', 'Liberty']],
  'analysis.challenges': [[5, 3, 1, 1], [1, 0, 0, 1]],
  'analysis.tensionsSummary': [[1, 'Liberty'], [4, 'Protecting the vulnerable']],
  'analysis.tensionsRead': [[1, 1, 0], [12, 5, 3]],
  'analysis.firmest': [[['Guns']], [['Guns', 'Abortion', 'Taxes and redistribution']]],
  'analysis.reconsidered': [[0], [1], [3]],
  'analysis.enjoys': [[['Jazz']], [['Hip-hop / rap', 'Tennis, badminton and table tennis', 'Bouldering']]],
  'analysis.basedOn': [[1], [7]],
  'analysis.basedOnSelf': [[1], [2]],
  'analysis.traditions.summary.match': [['Social democracy']],
  'analysis.traditions.summary.between': [['Social democracy', 'Green politics']],
  'analysis.traditions.lead.match': [['Libertarianism', []], ['Libertarianism', ['Classical liberalism', 'Centrism']]],
  'analysis.traditions.lead.between': [['Social democracy', 'Green politics']],
  'analysis.traditions.lead.loose': [[['Centrism']], [['Centrism', 'Social liberalism']]],
  'analysis.traditions.lead.mixed': [[['Centrism', 'Communitarianism']]],
  'analysis.traditions.lead.insufficient': [[[]], [['Diplomatic']], [['Civil', 'Cultural']]],
  'analysis.traditions.basis': [[['Economic', 'Civil'], []], [['Economic', 'Civil', 'Cultural', 'Diplomatic'], ['Equality', 'Liberty']]],
  'analysis.traditions.further': [['Liberty']],
  'analysis.traditions.more': [['Equality']],
  'analysis.traditions.less': [['Loyalty']],
  'analysis.traditions.splitFrom': [['Democratic socialism']],
  'analysis.traditions.divided': [['social democrats', ['Civil']], ['libertarians', ['Diplomatic', 'Liberty']]],
  'analysis.traditions.compare.youAnd': [['Social liberalism']],
  'analysis.traditions.compare.at': [['You', 'Leans Equality'], ['Social liberalism', 'its adherents split']],
  'analysis.traditions.readings.intro': [['Social democracy']],
  'analysis.traditions.readings.inside': [['Social democracy']],
  'analysis.traditions.readings.outside': [['Social democracy', 'Classical liberalism']],
  'analysis.traditions.map.showAll': [[11]],
  'analysis.traditions.map.alsoHere': [[['Green politics']], [['Green politics', 'Democratic socialism']]],
  'analysis.traditions.mapDesc': [[1], [11]],
  'analysis.next.more': [[2], [4]],
  'analysis.next.links.more.interest': [['Imaginative', 'somewhat', 'artistic activities, such as drawing, design, writing or music']],
  'analysis.next.links.more.participation': [['Imaginative', 'a little', 'reading for pleasure']],
  'analysis.next.links.less.interest': [['Practical', 'somewhat', 'artistic activities, such as drawing, design, writing or music']],
  'analysis.next.links.less.participation': [['Practical', 'a little', 'reading for pleasure']],
  'analysis.next.links.because': [['Reserved']],
  'analysis.next.read.against': [['Abortion']],
  'analysis.next.read.for': [['Abortion']],
  'analysis.next.explore.map': [['Civil']],
  'analysis.next.explore.show': [['Stability or change']],
  'analysis.next.explore.firmUp': [['Diplomatic']],
  'analysis.next.explore.consistency': [['Due process']],
  'analysis.next.reflect.lead.endorse-reject': [['Bodily autonomy', 'pregnancy', 'vaccination']],
  'analysis.next.reflect.lead.endorse-neutral': [['Liberty', 'speech', 'private messages']],
  'analysis.next.reflect.lead.neutral-reject': [['Loyalty', 'a strike at their workplace', 'a war their country is fighting']],
  'analysis.next.reflect.ask': [["other people's health"]],
  'share.position': [[1, 6, 'My pattern']],
  'share.card.footer': [[1], [18]],
  'share.card.across': [[1, ['Politics']], [14, ['Politics', 'Personality', 'How I think', 'Values']]],
  'share.card.alt': [['My pattern', ['14 spectrums: Politics and Values', 'Firmest leans: Strongly Progress (Cultural)', 'My results so far · 18 topics']]],
  'settings.lastBackup': [[null], ['3 Oct 2026']],
  'settings.restoreSummary': [[1, '3 Oct 2026'], [40, '3 Oct 2026']],
  'settings.restoreIdentity': [[1], [12]],
  'settings.version': [['1.0.0', 'abc123def456']],
};

/** Every string in copy, with template functions called on their samples. */
function render(): { path: string; text: string; fn: boolean }[] {
  const out: { path: string; text: string; fn: boolean }[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') out.push({ path, text: v, fn: false });
    else if (typeof v === 'function') for (const args of SAMPLES[path] ?? []) out.push({ path, text: (v as Fn)(...(args as never[])), fn: true });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(copy, '');
  return out;
}

function functionPaths(): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'function') out.push(path);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(copy, '');
  return out;
}

describe('app wording', () => {
  it('has sample arguments for every template, so the checks below cover it', () => {
    expect(functionPaths().filter((p) => !SAMPLES[p])).toEqual([]);
    expect(Object.keys(SAMPLES).filter((p) => !functionPaths().includes(p))).toEqual([]);
  });

  it('uses no loaded terms', () => {
    const terms = termMatchers(parseTerms(readFileSync('content/loaded-terms.txt', 'utf8')));
    // Wording about the political traditions answers to the pack's own terms too.
    const pack = [...terms, ...termMatchers(parseTerms(readFileSync('content/analysis/loaded-terms.txt', 'utf8')))];
    const aboutTraditions = (path: string) => path.startsWith('analysis.traditions.');
    const hits = render().flatMap(({ path, text }) =>
      findTerms(text, aboutTraditions(path) ? pack : terms).map((t) => `${path}: "${t}" in ${JSON.stringify(text)}`),
    );
    expect(hits).toEqual([]);
  });

  it('describes and asks in the analysis: no prescriptions, no comparisons with other people', () => {
    const tone = [/\byou should\b/i, /\byou must\b/i, /\byou are an? \b/i, /\bmost people\b/i, /\bnormal\b/i, /\bwrong\b/i, /%/];
    const hits = render()
      .filter((r) => r.path.startsWith('analysis.'))
      .flatMap(({ path, text }) => tone.filter((re) => re.test(text)).map((re) => `${path}: ${re} in ${JSON.stringify(text)}`));
    expect(hits).toEqual([]);
  });

  it('joins lists the way the sentences expect', () => {
    expect([list([]), list(['a']), list(['a', 'b']), list(['a', 'b', 'c'])]).toEqual(['', 'a', 'a and b', 'a, b and c']);
    expect(copy.analysis.lean('Politically,', ['toward “Markets”'], ['Civil'])).toBe('Politically, you lean toward “Markets”, and sit in the middle on “Civil”.');
    expect(copy.analysis.lean('Politically,', ['strongly toward “Progress”', 'toward “Global” and “Equality”', 'slightly toward “Liberty”'], [])).toBe(
      'Politically, you lean strongly toward “Progress”, toward “Global” and “Equality”, and slightly toward “Liberty”.',
    );
    expect(copy.analysis.challenges(1, 0, 0, 1)).toBe('You faced 1 challenge: you reconsidered 1.');
  });
});
