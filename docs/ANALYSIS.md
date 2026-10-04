# Results analysis

The Results screen opens with a written summary, gives each section a short read-out, and ends
with next steps. All of it is worked out on the device by the fixed rules below. There is no AI
model and no network call; the app's security policy (`connect-src 'self'`) would block one anyway.

| Layer | Where | What |
|---|---|---|
| Facts | `src/engine/analysis/` | Pure rules over the answers and content. Ids and numbers, no wording. |
| Wording | `src/app/analysis/compose.ts` | Picks which facts go into which sentence. |
| Templates | `copy.analysis` in `src/app/copy.ts` | Every sentence the analysis can write. |
| Thresholds | `src/engine/analysis/constants.ts` | The numbers in this document. Change both together. |

## Privacy: two profiles

The analysis reads two profiles (see [PROFILE_FORMAT.md](PROFILE_FORMAT.md#sensitive-data)):

- the **private** profile (`includeSensitive: true`), which is everything the user answered;
- the **public** profile (`includeSensitive: false`), which is recomputed without sensitive
  topics (religion & worldview, identity) and without sensitive items in other topics.

| Part | Uses |
|---|---|
| Summary: headline and leanings | public profile only |
| Summary: counts (topics answered, challenges faced, open tensions) | every answer, so they match the sections below. Counts never say which topics or which way. |
| Summary: the principle named in the tensions sentence | public tensions only |
| Section read-outs | the private profile: they describe the chart beside them, which already shows those answers |
| Next steps | public profile only; never a sensitive topic or item |

Worldview answers can never move the summary or a recommendation. The simulation test checks this
for every persona and 200 random respondents; the e2e test checks it in the browser.

## Bands and confidence

Shared with the labels on the charts (`positionLabel`, `endorsementLabel` in `src/app/view.ts`), so
words and charts can't disagree.

| Distance from the middle (−1..1) | Label | Sentence |
|---|---|---|
| under 0.15 | Center | "sit in the middle on …" |
| 0.15 to 0.4 | Leans X | "slightly toward X" |
| 0.4 to 0.7 | X | "toward X" |
| 0.7 and over | Strongly X | "strongly toward X" |

Confidence below 0.5 (`LOW_CONFIDENCE`) is drawn faded and adds "Some results rest on few answers
so far." to the read-out. 0.8 and over (`HIGH_CONFIDENCE`) counts as high.

## Summary

**Headline**, the first rule that applies:

1. The two strongest leanings among the political and values spectrums: "You lean toward
   “Tradition” and “Markets”".
2. The two most endorsed principles (score 0.4 or more): "You lean most on “Liberty”".
3. The two strongest personality traits: "You describe yourself as very outgoing".
4. "Your results so far".

**Paragraph**, at most four sentences, in this order, each only when there is something to say:

1. Political leanings, grouped by band: "Politically, you lean strongly toward “Progress”, toward
   “Global” and “Equality”, and slightly toward “Liberty”."
2. The most endorsed principles.
3. The challenge record: "You faced 12 challenges: you held your view through 7 and named a
   difference in 5."
4. Open tensions, and the principle of the most pressing one that involves no sensitive answer.

With none of these, a prompt to answer a few more topics.

**Tiles:** topics answered (of all topics), challenges faced (and how many you reconsidered),
and open tensions (with a button that jumps to the Tensions section).

## Section read-outs

| Section | Read-out |
|---|---|
| Politics | The leanings sentence. For the first political spectrum scored as mixed, which topics pulled which way: "On “Economic” your answers pull both ways: …". Up to two topics a side (`LIMIT.drivers`). |
| Values, Worldview, Taste | The leanings sentence for that family. Taste adds your three strongest picks. |
| How you think | Your self-description, then your challenge record, as **two separate sentences that are never contrasted**. How you describe your thinking and how you met challenges measure different things (see the note in `content/axes.yaml`); the simulation test fails on "but", "though", "although", "yet", "however" or "despite" here. The note under it says the self-description is based on N topics, since the challenge record spans every topic. |
| Personality | Each trait in words: "very outgoing, fairly organized, neither … nor …". |
| Principles | The three most endorsed; the most rejected, if 0.4 or more against; the most and least evenly applied, when at least two principles have a consistency score. |
| Tensions | How many pairs, across how many principles, and how many you've thought through. |
| Positions | Your firmest positions (below), and how many you reconsidered after a challenge. |

Each spectrum's details also list **what pulled you** toward each pole: the topics whose answers
moved that result, strongest first (`drivers()` in `axes.ts`, which weighs each topic's mean
position by its evidence).

## Next steps

### Read both sides (`cases.ts`)

1. **Firmest positions.** Non-sensitive topics whose stance has a current scale answer at least
   0.5 from the middle (`FIRM_POSITION`), ranked by distance × importance. Topics without an
   importance answer count as 0.5. Ties keep content order. Top 3 (`LIMIT.positions`).
2. For each, from the challenges already in the content, which are cited and fact-checked:
   - **Against:** one challenge aimed at your side. It must be one the flow shows you, and either
     answered or not held back as a deep question at the importance you gave. Shows how you met
     it: held, named a difference, or reconsidered.
   - **For:** one challenge put to people on the other side. Challenges are aimed by their `when`
     condition on the stance, so the rule evaluates `when` with your stance mirrored
     (v → −v, step → points + 1 − step).
   - Only challenges citing a real source. "Original scenario" ones are skipped.

### Explore next (`explore.ts`)

1. **Finish** the topic you answered last, if it's unfinished and not sensitive.
2. Then the unstarted topics that add most, picked one at a time. After each pick the rule assumes
   that topic answered, so the next pick spreads to other results. A topic's gain is:

   - **Firming up:** for each spectrum it feeds,
     `FAMILY_WEIGHT × min(1 − confidence, STANCE_WEIGHT[tier] / fullWeight)`.
   - **Showing:** +0.3 × family weight (`UNSCORED_BONUS`) for each spectrum it feeds that can't
     show yet, doubled for the two spectrums of the political map.
   - **Consistency:** +0.2 (`CONSISTENCY_BONUS`) for each strongly held principle (score 0.4 or
     more either way) that only one answered topic tests so far, if this topic anchors it.
   - **Core:** +0.05 (`CORE_BONUS`) for a core topic, as a tie-breaker.

   | Family | Weight |
   |---|---|
   | Political, personality | 1 |
   | Values | 0.8 |
   | How you think | 0.6 |
   | Taste | 0.2 |
   | Worldview | 0 |

3. Three in all (`LIMIT.explore`). Each says why: "Adds the economic spectrum to your political
   map", "Firms up your “Social” result", "Tests “Liberty” in a new setting".

**Never suggested:** sensitive topics, and anything in the worldview or identity domains. The app
never nudges anyone toward questions about religion or identity.

### Worth a second look (`reflect.ts`)

- Open tensions whose topics and items are all non-sensitive, most pressing first, one per
  principle, three at most (`LIMIT.reflect`).
- Each is a question, never a verdict. Which of three openings it uses depends on the two sides
  (`ENDORSE` = 0.4):

  | Variant | When | Opening |
  |---|---|---|
  | endorse-reject | one side ≥ 0.4, the other ≤ −0.4 | "You endorsed X when it comes to A, but rejected it when it comes to B." |
  | endorse-neutral | one side ≥ 0.4 | "… but not when it comes to B." |
  | neutral-reject | otherwise | "You were neutral on X when it comes to A, but rejected it …" |

- The question uses the anchor's `against` text, the competing interest the content names for the
  setting where you endorsed the principle least: "Is it the health of other people that makes the
  difference?" Without one: "What makes the difference for you?"
- Each links to the tension's own page to think it through.

## Wording rules

- Describe and ask. Never prescribe ("you should"), never label the person ("you are a …"), never
  compare them with other people ("most people", "normal"), never give a percentage.
- No loaded terms (`content/loaded-terms.txt`). Content titles, poles and labels are already
  checked by lint rule W108, which now also covers `axes.yaml`, `principles.yaml` and
  `domains.yaml`.
- `src/app/copy.test.ts` calls every copy function with sample arguments and checks the result for
  loaded terms, and checks `copy.analysis` for the tone rules above.
- `tests/sim/analysis.test.ts` composes the analysis for every persona and 200 random respondents,
  half of whom answered only a few topics. It checks every string for loaded terms (except quoted
  citations, which W108 doesn't check either), the tone rules, `undefined`/`NaN`, the How you
  think rule, sensitive topics in the summary or next steps, and the limits above.
