// All user-facing wording lives here, so tone can be reviewed in one place.
// Tone: plain, warm, Socratic. Never tell the user they're wrong.
import type { Evidence } from '../model/content.ts';

const s = (n: number) => (n === 1 ? '' : 's');
/** Quoted, for pole names, principles and topic titles inside sentences. */
const q = (text: string) => `“${text}”`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** "a", "a and b", "a, b and c". */
export function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
/** For parts that may contain "and" themselves: "a, and b", "a, b, and c". */
function series(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

export const copy = {
  appName: 'Who Am I',
  tagline: 'Find out where you stand, and why.',
  privacy: 'Everything stays on this device. No account, no tracking.',

  nav: { home: 'Home', topics: 'Topics', results: 'Results', settings: 'Settings' },

  home: {
    howTitle: 'How it works',
    how: [
      'Answer questions on the topics you choose. Skip anything.',
      "Face the strongest case against whatever you said. Hold your ground or reconsider.",
      'See where you stand, and where your answers pull in different directions.',
    ],
    startPersonality: 'Start with your personality',
    startPersonalityNote: 'About 2 minutes',
    browse: 'Browse topics',
    continueTitle: 'Pick up where you left off',
    continueTopic: (title: string, left: number) => `${title} · ${left} left`,
    nextTitle: 'Up next',
    progress: (done: number, total: number) => `${done} of ${total} topics finished`,
    seeResults: 'See your results',
    allDone: "You've finished every topic so far. More are on the way.",
  },

  topics: {
    title: 'Topics',
    intro: 'Pick any topic, in any order. Every question can be skipped.',
    start: 'Start',
    left: (n: number) => `${n} left`,
    done: 'Done',
    sensitive: 'Private: never in your summary, cards or suggestions',
    aboutYou: {
      tag: 'optional and private',
      open: 'Show these questions',
      close: 'Hide these questions',
      note: "Questions about your family, roots, faith, gender and sexual orientation. They're never scored or in your summary, cards or suggestions, and backups leave them out unless you include them. Skip anything, and remove it all at any time, in Settings or on the About you page. Anyone who can open the app on this device can see your answers.",
    },
    deepDives: 'Deep dives',
    comingSoon: 'Coming soon',
    comingSoonNote: 'These areas are planned and will be added over time.',
  },

  flow: {
    exit: 'Close',
    back: 'Back',
    next: 'Next',
    skip: 'Skip',
    unsure: 'No opinion / not sure',
    declined: 'Prefer not to say',
    start: 'Start',
    noneOfThese: 'None of these',
    rateEach: 'How much do you like each?',
    slightly: 'Slightly',
    strongly: 'Strongly',
    noteToggle: 'Add a note (optional)',
    notePlaceholder: 'Why? Saved on this device and in your backups.',
    challengeLabel: 'A challenge',
    reaskAfterChallenge: 'Having thought about that, where do you land now?',
    before: 'Before:',
    keep: 'Keep my answer',
    editing: 'Change your answer',
    cancelEdit: 'Cancel',
    sourceLabel: 'Source',
    progress: (answered: number, total: number) => `${answered} of about ${total}`,
    doneTitle: (topic: string) => `You've finished ${topic}`,
    landed: 'Where you landed',
    startedAt: (label: string) => `You started at “${label}”.`,
    moved: (steps: number, source: string) =>
      `“${source}” moved you ${Math.abs(steps)} step${Math.abs(steps) === 1 ? '' : 's'}.`,
    heldAll: (n: number) => (n === 1 ? 'You held your view through the challenge.' : `You held your view through all ${n} challenges.`),
    nextTopic: (title: string) => `Next: ${title}`,
    seeResults: 'See your results',
    reviewAnswers: 'Review your answers',
    backToTopics: 'All topics',
    notFound: "That topic doesn't exist (yet).",
  },

  tension: {
    title: 'Two of your answers pull in different directions',
    intro: (principle: string) => `Both are about ${principle.toLowerCase()}.`,
    youAnswered: (topic: string) => `On ${topic}, you answered`,
    aDifference: 'One difference you might point to:',
    competing: (context: string, against: string) => `in ${context}, the competing interest is ${against}`,
    question: 'What explains the difference for you?',
    reasons: {
      harm_to_others: 'Harm to other people is different from risk to yourself',
      consent: 'Consent makes the difference',
      stakes: 'The stakes are different',
      other_principle: 'Another value outweighs it in one case',
      other: 'Something else',
    },
    otherPlaceholder: 'In your own words (optional)',
    save: 'Save',
    revise: "I'd change one of these answers",
    reviseWhich: 'Which answer would you change?',
    acknowledge: "Fair point. I'll leave both as they are",
    notNow: 'Not now',
    thanks: 'Noted. This stays between you and your device.',
  },

  results: {
    title: 'Your results',
    empty: 'Answer a few topics and your results will appear here.',
    emptyCta: 'Choose a topic',
    personalityNote: 'Validated short form (Mini-IPIP). Your raw position on each scale, not a comparison with other people.',
    principlesNote: 'How strongly your answers endorse each principle, most endorsed first. Tap one to see it topic by topic.',
    tensionsEmpty: 'No tensions found between your answers so far.',
    interests: 'What you enjoy',
    notEnough: 'Not enough answers yet.',
    noTopicsYet: 'No topics measure this yet. They are on the way.',
    feedBy: 'Answer:',
    mixed: 'Mixed: your answers pull both ways',
    confidence: (c: number) => `Confidence ${Math.round(c * 100)}%`,
    consistency: (c: number) => `Consistency ${Math.round(c * 100)}%`,
    challengesSummary: (asked: number, held: number, distinguished: number, moved: number) =>
      [`${asked} challenge${asked === 1 ? '' : 's'}`, held && `held ${held}`, distinguished && `named a difference ${distinguished}`, moved && `reconsidered ${moved}`]
        .filter(Boolean)
        .join(' · '),
    movedLine: (source: string, steps: number, toward: string) =>
      `“${source}” moved you ${Math.abs(steps)} step${Math.abs(steps) === 1 ? '' : 's'} toward “${toward}”.`,
    status: {
      distinguished: 'You named a difference',
      revised: 'You revised an answer',
      acknowledged: 'You acknowledged it',
    },
    selfReport: 'These results reflect what you told the app. They are a mirror, not a diagnosis.',
    basedOn: (n: number, total: number) => `Based on ${n} of ${total} topics so far.`,
    politicalMap: 'Your political map',
    mapNeeds: 'Answer topics in Economics and Rights & Liberties, or in Society and Governance & the World, to see your political map.',
    challengesTitle: 'How you handled challenges',
    challengesTotal: (n: number) => `${n} challenge${n === 1 ? '' : 's'} so far`,
    challengeParts: { held: 'Held your view', distinguished: 'Named a difference', moved: 'Reconsidered' },
    lowConfidence: 'Based on few answers so far',
    lighter: 'Lighter: based on few answers',
    pulledBy: 'What pulled you',
    toward: (pole: string) => `Toward ${pole}:`,
    comingSoon: 'No topics yet',
    notYet: 'Not enough answers',
    rejects: 'Rejects',
    endorses: 'Endorses',
    byTopic: 'Topic by topic',
    showAll: (n: number) => `Show all ${n} principles`,
    showFewer: 'Show fewer',
    topicCount: (n: number) => `${n} topic${n === 1 ? '' : 's'}`,
    reconsideredCount: (n: number) => `reconsidered ${n}`,
    principleTensions: (n: number) => `${n} open tension${n === 1 ? '' : 's'}`,
  },

  // The written analysis on the results page. Every sentence is built here from parts the rules
  // pick (src/app/analysis/compose.ts). Describe and ask; never prescribe, never compare the user
  // with other people.
  analysis: {
    sections: {
      politics: 'Politics',
      values: 'Values',
      thinking: 'How you think',
      worldview: 'Worldview',
      personality: 'Personality',
      principles: 'Principles',
      tensions: 'Tensions',
      positions: 'Positions',
      taste: 'Taste',
      you: 'About you',
      next: 'Next steps',
    },
    // The overview: the summary, the pattern of your spectrums, your firmest leans, then a link to
    // each area's own page. Built from answers that could be shared, like the summary.
    overview: {
      pattern: 'Your pattern',
      patternHelp: 'Each line is one spectrum, grouped by area. The longer the line, the further your answers lean, whichever way.',
      patternTap: 'Tap a line to see which spectrum it is.',
      patternLabel: 'Your pattern: one line per spectrum',
      patternLow: 'A hollow line rests on few answers so far.',
      spectrums: (n: number) => `spectrum${s(n)}`,
      firmest: 'Your firmest leans',
      areas: 'Open an area',
      back: 'Results',
      line: {
        middle: 'Near the middle so far',
        notYet: 'Not enough answers yet',
        sensitive: 'Sensitive: kept out of your summary',
        private: 'Private: shown only when you ask',
        principles: (labels: readonly string[]) => `Most endorsed: ${list(labels)}`,
        principleCount: (n: number) => `${n} principle${s(n)} so far`,
        tensions: (open: number, resolved: number) => [open ? `${open} open` : '', resolved ? `${resolved} thought through` : ''].filter(Boolean).join(' · '),
        noTensions: 'None found so far',
        positions: (n: number, moved: number) => `${n} topic${s(n)}${moved ? ` · ${moved} reconsidered` : ''}`,
        enjoys: (labels: readonly string[]) => `You enjoy ${list(labels)}`,
      },
    },
    summaryTitle: 'Summary',
    headline: {
      leanings: (poles: readonly string[]) => `You lean toward ${list(poles.map(q))}`,
      principles: (labels: readonly string[]) => `You lean most on ${list(labels.map(q))}`,
      personality: (traits: readonly string[]) => `You describe yourself as ${list(traits)}`,
      empty: 'Your results so far',
    },
    summaryEmpty: 'Answer a few more topics, and this summary will describe what your answers add up to.',
    tiles: {
      topics: 'Topics answered',
      topicsOf: (total: number) => `of ${total}`,
      challenges: 'Challenges faced',
      reconsidered: (n: number) => `${n} reconsidered`,
      tensions: 'Open tensions',
      tensionsSee: 'See where',
    },
    toward: {
      slight: (poles: readonly string[]) => `slightly toward ${list(poles.map(q))}`,
      plain: (poles: readonly string[]) => `toward ${list(poles.map(q))}`,
      strong: (poles: readonly string[]) => `strongly toward ${list(poles.map(q))}`,
    },
    /** e.g. intro "Politically," → "Politically, you lean toward “Markets”, and sit in the middle on “Civil”." */
    lean: (intro: string, leaning: readonly string[], middle: readonly string[]) =>
      leaning.length
        ? `${intro} you lean ${series(leaning)}${middle.length ? `, and sit in the middle on ${list(middle.map(q))}` : ''}.`
        : `${intro} you sit in the middle on ${list(middle.map(q))}.`,
    intro: {
      politics: 'Politically,',
      values: 'In your values,',
      thinking: 'In how you describe your thinking,',
      worldview: 'On worldview,',
      taste: 'In your taste,',
    },
    pullsBothWays: (spectrum: string, a: readonly string[], poleA: string, b: readonly string[], poleB: string) =>
      `On ${q(spectrum)} your answers pull both ways: ${list(a.map(q))} toward ${q(poleA)}, and ${list(b.map(q))} toward ${q(poleB)}.`,
    personality: (traits: readonly string[]) => `You describe yourself as ${list(traits)}.`,
    trait: {
      slight: (pole: string) => `slightly ${pole.toLowerCase()}`,
      plain: (pole: string) => `fairly ${pole.toLowerCase()}`,
      strong: (pole: string) => `very ${pole.toLowerCase()}`,
      neither: (a: string, b: string) => `neither ${a.toLowerCase()} nor ${b.toLowerCase()}`,
    },
    principlesTop: (labels: readonly string[]) => `You endorse ${list(labels.map(q))} most.`,
    principlesLow: (label: string) => `The principle you reject most is ${q(label)}.`,
    consistency: (most: string, least: string) => `You apply ${q(most)} most evenly across topics, and ${q(least)} least evenly.`,
    challenges: (asked: number, held: number, distinguished: number, moved: number) =>
      `You faced ${asked} challenge${s(asked)}: you ${list(
        [
          held ? `held your view through ${held}` : '',
          distinguished ? `named a difference in ${distinguished}` : '',
          moved ? `reconsidered ${moved}` : '',
        ].filter(Boolean),
      )}.`,
    tensionsSummary: (open: number, principle: string) =>
      `${open} pair${s(open)} of your answers pull${open === 1 ? 's' : ''} in different directions; the most pressing is about ${q(principle)}.`,
    tensionsRead: (pairs: number, principles: number, resolved: number) =>
      `${pairs} pair${s(pairs)} of answers pull${pairs === 1 ? 's' : ''} in different directions, across ${principles} principle${s(principles)}.${
        resolved ? ` You've thought through ${resolved}.` : ''
      }`,
    firmest: (titles: readonly string[]) => `Your firmest position${s(titles.length)} ${titles.length === 1 ? 'is' : 'are'} on ${list(titles.map(q))}.`,
    reconsidered: (n: number) => (n ? `You reconsidered ${n} position${s(n)} after a challenge.` : 'You held every position through its challenges.'),
    enjoys: (labels: readonly string[]) => `You enjoy ${list(labels)} most.`,
    basedOn: (topics: number) => `Based on ${topics} topic${s(topics)}.`,
    basedOnSelf: (topics: number) => `Your self-description is based on ${topics} topic${s(topics)}.`,
    fewAnswers: 'Some results rest on few answers so far.',
    // Political traditions are reference points: where the answers sit closest, never a label.
    traditions: {
      title: 'Closest political traditions',
      note: "Reference points, placed from each tradition's own writers. Not a label, and not a recommendation.",
      summary: {
        match: (name: string) => `Of the political traditions compared here, your answers sit closest to ${q(name)}.`,
        between: (a: string, b: string) => `Of the political traditions compared here, your answers sit between ${q(a)} and ${q(b)}.`,
      },
      lead: {
        match: (name: string, next: readonly string[]) =>
          `Your political answers sit closest to ${q(name)}${next.length ? `, then ${list(next.map(q))}` : ''}.`,
        between: (a: string, b: string) => `Your political answers sit between ${q(a)} and ${q(b)}, about as close to each.`,
        loose: (names: readonly string[]) =>
          `None of the traditions compared here is a close fit; the nearest ${names.length === 1 ? 'is' : 'are'} ${list(names.map(q))}.`,
        mixed: (names: readonly string[]) =>
          `On average your political answers sit nearest ${list(names.map(q))}, but question by question they pull different ways, so no tradition is named.`,
        insufficient: (spectrums: readonly string[]) =>
          spectrums.length
            ? `Answer topics on ${list(spectrums.map(q))} to see which political traditions your answers sit closest to.`
            : 'Answer a few more political topics to see which traditions your answers sit closest to.',
      },
      basis: (spectrums: readonly string[], principles: readonly string[]) =>
        `Compared on ${list(spectrums.map(q))}${principles.length ? `, and on the principles ${list(principles.map(q))}` : ''}.`,
      closeness: { 'very-close': 'Very close fit', close: 'Close fit', some: 'Some overlap', little: 'A looser fit' },
      further: (pole: string) => `You lean further toward ${q(pole)}`,
      more: (principle: string) => `You put more weight on ${q(principle)}`,
      less: (principle: string) => `You put less weight on ${q(principle)}`,
      splitFrom: (name: string) => `How it differs from ${q(name)}`,
      divided: (adherents: string, items: readonly string[]) => `${capitalize(adherents)} are divided on ${list(items.map(q))}.`,
      // The answers beside one tradition, spectrum by spectrum.
      compare: {
        youAnd: (name: string) => `You and ${name}`,
        at: (who: string, position: string) => `${who}: ${position}`,
        split: 'its adherents split',
      },
      readings: {
        title: 'Readings',
        intro: (name: string) => `The case for ${q(name)} from inside it, and critiques from outside.`,
        inside: (name: string) => `The case for ${q(name)}, from inside it`,
        outside: (name: string, voice: string) => `A critique of ${q(name)}, from ${q(voice)}`,
        kind: { book: 'Book', essay: 'Essay', article: 'Article', speech: 'Speech', lecture: 'Lecture' },
      },
      map: {
        open: 'See it on a map',
        sub: 'Two spectrums at a time, with the traditions',
        views: 'Which two spectrums',
        tap: 'Tap a tradition to see which it is.',
        reference: 'a reference point, not a label',
        alsoHere: (names: readonly string[]) => `Also here: ${list(names)}`,
        showAll: (n: number) => `Show all ${n} traditions`,
        showClosest: 'Show only the closest',
        sure: 'How sure the app is',
      },
      mapDesc: (n: number) => `${n} political tradition${s(n)} marked for reference.`,
      legend: { you: 'You', traditions: 'Tradition', divided: 'Divided on one of these spectrums' },
      table: { show: 'Where each tradition sits', who: 'Tradition', you: 'You', divided: 'Divided', none: 'Not enough answers' },
      loading: 'Loading the political traditions…',
      failed: "The political traditions couldn't load.",
      reload: 'Reload',
    },
    next: {
      title: 'Next steps',
      more: (n: number) => `Show ${n} more`,
      read: {
        title: 'Read both sides',
        intro: 'The strongest cases on your firmest positions, from the sources the app cites.',
        against: (topic: string) => `Against your view on ${topic}`,
        for: (topic: string) => `For your view on ${topic}`,
        met: { held: 'You held your view', distinguished: 'You named a difference', moved: 'You reconsidered' },
        otherSide: 'Put to people on the other side',
      },
      links: {
        title: 'Links from research',
        note: 'From your personality answers only.',
        intro:
          "Large studies, using longer personality questionnaires than this one, found that people whose answers lean the way yours do report more or less interest in some activities, on average. Many people don't fit these averages. About interest, not ability. Not advice, not career guidance, and not a judgment of what you do now.",
        kind: { working: 'Ways of working', free_time: 'Free time', subjects: 'Subjects to explore' },
        strength: { little: 'a little', somewhat: 'somewhat' },
        more: {
          interest: (pole: string, strength: string, what: string) => `In large studies, people whose answers lean toward ${q(pole)} report ${strength} more interest in ${what}, on average.`,
          participation: (pole: string, strength: string, what: string) => `In large studies, people whose answers lean toward ${q(pole)} take part in ${what} ${strength} more often, on average.`,
        },
        less: {
          interest: (pole: string, strength: string, what: string) => `In large studies, people whose answers lean toward ${q(pole)} report ${strength} less interest in ${what}, on average.`,
          participation: (pole: string, strength: string, what: string) => `In large studies, people whose answers lean toward ${q(pole)} take part in ${what} ${strength} less often, on average.`,
        },
        caveat: "Many don't, so this may not fit you.",
        because: (pole: string) => `Your answers lean toward ${q(pole)}`,
      },
      explore: {
        title: 'Explore next',
        intro: 'The topics that would add most to your results.',
        finish: 'Finish this topic',
        map: (spectrum: string) => `Adds the ${spectrum.toLowerCase()} spectrum to your political map`,
        show: (spectrum: string) => `Adds your ${q(spectrum)} result`,
        personality: 'Adds your personality profile',
        firmUp: (spectrum: string) => `Firms up your ${q(spectrum)} result`,
        consistency: (principle: string) => `Tests ${q(principle)} in a new setting`,
        start: 'Not started yet',
        cta: 'Start',
        ctaContinue: 'Continue',
      },
      reflect: {
        title: 'Worth a second look',
        intro: 'Where your answers pull apart most. Often there is a good reason; it helps to know it.',
        lead: {
          'endorse-reject': (principle: string, hi: string, lo: string) =>
            `You endorsed ${q(principle)} when it comes to ${hi}, but rejected it when it comes to ${lo}.`,
          'endorse-neutral': (principle: string, hi: string, lo: string) =>
            `You endorsed ${q(principle)} when it comes to ${hi}, but not when it comes to ${lo}.`,
          'neutral-reject': (principle: string, hi: string, lo: string) =>
            `You were neutral on ${q(principle)} when it comes to ${hi}, but rejected it when it comes to ${lo}.`,
        },
        ask: (against: string) => `Is it ${against} that makes the difference?`,
        askOpen: 'What makes the difference for you?',
        cta: 'Think it through',
      },
    },
  },

  // Share cards: images made on this device from answers that could be shared (src/app/share/).
  // The words on a card speak in the first person, since other people will read them.
  share: {
    title: 'Share a card',
    open: 'Share',
    intro: 'Pick a card, then share it or save it as an image. Each one is made on this device from answers that could be shared, never from sensitive topics.',
    cards: 'Cards to share',
    position: (i: number, n: number, name: string) => `${name}, card ${i} of ${n}`,
    prev: 'Previous card',
    next: 'Next card',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    share: 'Share…',
    save: 'Save image',
    saved: 'Image saved.',
    making: 'Making the image…',
    failed: "This card couldn't be drawn. Reload the app to try again.",
    shareFailed: "Couldn't share the image. Try saving it instead.",
    nothing: 'Answer a few more topics to make a card.',
    nothingCta: 'Choose a topic',
    differs: 'This card leaves out your answers on sensitive topics, so it can differ from your Principles page.',
    leaves: 'Nothing leaves this device unless you share or save the image.',
    card: {
      names: { pattern: 'My pattern', politics: 'Politics', values: 'Values', thinking: 'How I think', personality: 'Personality', principles: 'Principles' },
      areas: { politics: 'Politics', personality: 'Personality', thinking: 'How I think', values: 'Values' },
      firmest: 'Firmest leans',
      middle: 'Near the middle so far',
      low: 'Hollow marks rest on few answers so far.',
      lighter: 'Lighter bars rest on few answers so far.',
      closest: 'Closest political tradition',
      between: 'Between two political traditions',
      footer: (topics: number) => `My results so far · ${topics} topic${s(topics)}`,
      across: (n: number, areas: readonly string[]) => `${n} spectrum${s(n)}: ${list(areas)}`,
      alt: (name: string, parts: readonly string[]) => `Who Am I, ${name}. ${parts.join('. ')}.`,
    },
  },

  // The About you page under Results: answers about you, behind a tap.
  aboutYou: {
    intro: "How you've described yourself, kept on this device. It's never in your summary, cards or suggestions. Each topic shows only when you ask.",
    show: 'Show my answers',
    hide: 'Hide',
    change: 'Change',
    none: 'No answers here yet.',
    notPrinted: "Answers about you aren't printed.",
  },

  topicResults: {
    yourAnswers: 'Your answers',
    change: 'Change',
    skipped: 'Skipped',
    unsure: 'Not sure',
    declined: 'Prefer not to say',
    notAnswered: 'Not answered',
    continue: 'Continue this topic',
  },

  settings: {
    title: 'Settings',
    backupTitle: 'Backup',
    backupExplain:
      "Your answers are stored only in this browser on this device. Clearing the browser's data deletes them, so keep a backup. In the Android app, uninstalling may not delete them: Chrome keeps them until you delete them in its settings.",
    lastBackup: (when: string | null) => (when ? `Last backup: ${when}` : 'No backup yet'),
    includeIdentity: 'Include answers about you',
    includeIdentityNote: 'Off unless you tick it, each time. Anyone who opens the file can read them.',
    download: 'Save backup file',
    share: 'Share backup…',
    restore: 'Restore from backup…',
    restoreTitle: 'Restore from backup',
    restoreSummary: (n: number, date: string) => `This backup has ${n} answer${n === 1 ? '' : 's'}, saved ${date}.`,
    restoreIdentity: (n: number) => `Also restore the ${n} answer${s(n)} about you in this file`,
    restoreIdentityNote: 'Left out unless you tick this. "Replace my answers" removes the answers about you already here, ticked or not.',
    merge: 'Merge with my answers',
    replace: 'Replace my answers',
    cancel: 'Cancel',
    restored: 'Backup restored.',
    backupErrors: {
      'not-json': "That file isn't a backup.",
      'not-backup': "That file isn't a Who Am I backup.",
      'newer-version': 'That backup is from a newer version of the app. Update the app, then try again.',
      invalid: 'That backup is damaged and could not be read.',
    },
    questionsTitle: 'Questions',
    alwaysDeep: 'Always ask deep-dive questions',
    alwaysDeepNote: "Normally they're skipped for topics you say matter little to you.",
    resultsTitle: 'Results',
    showLinks: 'Show links from research',
    showLinksNote: 'What large studies found about personality and interests, under Next steps. Worked out on this device from your personality answers, and never saved or shared.',
    storageTitle: 'Storage',
    persisted: 'Protected: the browser has agreed not to clear your answers to free up space.',
    notPersisted: 'Not protected: the browser may clear your answers if the device runs low on space.',
    persist: 'Protect my answers',
    identityTitle: 'Answers about you',
    identityExplain: "Delete every answer you've given about yourself from this app. Backup files you saved before still contain any you included.",
    identityRemove: 'Remove answers about you',
    identityRemoveConfirm: "Remove all your answers about you? Your other answers stay. This can't be undone.",
    identityRemoved: 'Answers about you removed.',
    identityRemoveFailed: "They're gone from this screen, but the browser didn't confirm they were deleted. Try again, or delete all your data.",
    deleteTitle: 'Delete everything',
    deleteExplain: "Erase your answers and settings from this app. Backup files and images you saved or sent aren't affected, and your browser's history isn't cleared. This can't be undone.",
    deleteButton: 'Delete all my data',
    deleteConfirm: 'Delete all your answers? This cannot be undone.',
    deleted: 'All data deleted.',
    aboutLink: 'About, methods & privacy',
    contentLink: 'Content preview (every question)',
    version: (app: string, content: string) => `App ${app} · content ${content}`,
  },

  backupNudge: {
    text: 'Your answers only live on this device. Save a backup?',
    save: 'Save backup',
    later: 'Later',
  },

  storageWarning: "Your browser isn't letting this app save. Answers will be lost when you close the page.",
  contentWarning: "Some questions didn't load, so some of your answers may be missing from your results. Reload the app to try again.",

  loading: { text: 'Loading…', failed: "This part of the app didn't load. Check your connection and try again.", retry: 'Reload' },

  update: { available: 'A new version is ready.', reload: 'Update', dismiss: 'Later', offline: 'Ready to work offline.' },

  roles: {
    stance: 'Your view',
    circumstance: 'Circumstance',
    anchor: 'Principle',
    challenge: 'A challenge',
    importance: 'Importance',
  },

  evidence: {
    validated: { label: 'Validated', explain: 'A published, validated questionnaire, used word for word.' },
    adapted: { label: 'Research-based', explain: 'Adapted from published research.' },
    custom: { label: 'Original', explain: 'Questions written for this app. Not a validated instrument.' },
    'for-fun': { label: 'For fun', explain: 'Just for fun. No measurement claims.' },
  } satisfies Record<Evidence, { label: string; explain: string }>,
};
