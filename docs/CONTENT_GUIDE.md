# Content guide

How to write topics for Who Am I. The lint (`npm run content:lint`) enforces most of this. The
rest is judgment, and the review checklist at the end covers it.

## Where things live

```
content/
  config.yaml        engine tuning (deep-item gate, tension threshold, evidence defaults)
  domains.yaml       the 14 domains, in display order
  axes.yaml          spectrums shown in results: poles + evidence rules
  principles.yaml    moral principles tracked across topics
  loaded-terms.txt   words that signal a side (lint warning W108)
  topics/<domain>/<topic>.yaml
```

Each topic file starts with `# yaml-language-server: $schema=../../../schema/topic.schema.json`, so
editors with the YAML extension autocomplete and validate as you type.

Run `npm run content:lint` before committing. Errors fail the build. Warnings are budgeted in CI
and should be fixed or justified.

## Ids

- `snake_case`, starting with a letter. Item ids are local to their topic; elsewhere they're
  written `topic.item`.
- **Never rename or delete an id after public release.** Answers are stored on users' devices
  against ids, and a rename strands them as orphans that no longer count. Before release we'll add a
  lockfile that blocks this. Until then, prefer adding new ids over renaming.
- Condition keywords (`and`, `or`, `not`, `is`, `has`, `answered`) can't be ids.

## Topic fields

| Field | Notes |
|---|---|
| `id`, `domain`, `title`, `summary` | `summary` is one line, shown on the module list |
| `tier` | `core` (part of the main experience) or `extended` (deep dive: listed under "Deep dives", offered after every core topic is done) |
| `order` | display order within the domain |
| `evidence` | `validated`, `adapted`, `custom` or `for-fun` (see below) |
| `source`, `license` | required in practice for `validated` and `adapted` |
| `instructions` | shown once before the first item (validated instruments) |
| `stance` | the item holding the overall position; required if the topic has challenges |
| `importance` | the importance item; required if the topic has deep items |
| `sensitive` | adds "Prefer not to say" everywhere and excludes the topic from sharing by default |

## Item types

| Type | Use for | Notes |
|---|---|---|
| `slider` | positions between two ends (stances, circumstances) | 5–11 discrete steps; bipolar, so no agree-bias |
| `likert` | agree/disagree statements (anchors); validated instruments | `labels: accuracy` for IPIP |
| `rating` | intensity (how much you enjoy X) | 5 points; tag `interest` to appear in interests |
| `importance` | "how much does this matter to you" | 4 points; gates deep items |
| `choice` | one of several options | `shuffle: true` for unordered options |
| `pair` | this-or-that trade-offs (values) | optional slightly/strongly |
| `multi` | pick several (genres, sports) | `intensity: true` rates each pick 1–5 |
| `challenge` | a thought experiment aimed at an answer | see below |
| `reask` | "where do you land now?" | due automatically after a challenge to its target |

Every item has **Skip**. Items also offer **No opinion / not sure** unless `unsure: false`. It
defaults off for validated instruments and importance items. Sensitive items add **Prefer not to
say**. None of these are scored.

## Effects

```yaml
axes: { cultural: 1 }              # on scale items: a weight; the sign says which way agreeing pushes
principles: { bodily_autonomy: 1 }
```

- **Scale items** (slider, likert, rating): numbers are **weights**. The answer's position (−1…1)
  times the sign of the weight is the evidence, and |weight| is how much it counts. Use a negative
  weight for reverse-keyed statements.
- **Options** (choice, pair, challenge): numbers are **positions** (−1…1), counted with the item's
  `weight` (default 1).
- **Choice items with item-level effects** use each option's `value` as the position (every option
  needs a `value`).
- An axis or principle an item doesn't mention means *no information*, not neutral. Write `0` on
  an option for an intentional neutral.
- **In issue topics, only the stance feeds political axes**: weight 1 in core topics, 0.5 in
  extended ones, so a deep dive never outweighs a core issue. Circumstances and challenges are
  chosen to probe one side's hard cases (rape, a threat to life, a mass murderer), so answers to
  them lean one way by design. Scored on a spectrum, they'd pull moderates toward one pole: someone
  whose view is "legal only in rare cases, like rape" would land on the permissive side just by
  answering consistently. They can still carry principle effects. A content test enforces this.
- **Balanced option sets.** Choice options should be spread symmetrically around 0 on each axis
  they feed (e.g. −1, −0.6, 0, 0.6, 1), so someone picking at random lands in the middle (W110).

**Keying.** On agree/disagree items, people tend to agree regardless of content. For any axis fed
by agree/disagree items, phrase roughly half so that agreeing pushes one way and half the other way
(W101). Sliders between two statements don't have this problem, which is why stances and
circumstances use them.

## Conditions (`when:`)

```yaml
when: stance < 0
when: stance < 0 and rape > 0
when: stance > 0 and gest is any
when: genres has jazz
when: answered(stance) and not (stance == 0)
```

Values are **normalized**: every scale runs from −1 to 1.

| Step | 5-point | 7-point |
|---|---|---|
| 1 | −1 | −1 |
| 2 | −0.5 | −0.67 |
| 3 | 0 | −0.33 |
| 4 | 0.5 | 0 |
| 5 | 1 | 0.33 |
| 6 | | 0.67 |
| 7 | | 1 |

Comparisons tolerate rounding, so `0.33` matches one third.

- **Three-valued logic.** A condition on an unanswered (or skipped) item is *unknown*, and an item
  shows only when its condition is definitely true. So `not (stance < 0)` does *not* show items to
  someone who skipped the stance.
- **Only earlier items.** Conditions, `revise` and `reask` targets must point to items earlier in
  the topic (E005). Cross-topic refs (`abortion.stance > 0`) work but warn (W102).
- **Hidden answers go dormant.** If a later answer hides an item, its answer stops counting until it
  becomes visible again. Challenges are the exception: they keep counting.
- The lint proves every condition can be true for some answers (E007).

## Challenges

A challenge is a thought experiment aimed at **the answer the user actually gave**.

```yaml
- id: ch_violinist
  type: challenge
  name: The violinist        # short name shown in results ("The violinist moved you 2 steps")
  targets: stance            # the answer under challenge
  when: stance < 0           # who sees it
  source: Judith Jarvis Thomson, "A Defense of Abortion" (1971)
  scenario: >- …
  text: Should the law require you to stay connected?
  options:
    - { id: stay, label: …, reaction: hold, principles: { … } }
    - { id: responsibility, label: …, reaction: distinguish, principles: { … } }
    - { id: rethink, label: …, reaction: yield, revise: stance, principles: { … } }
```

**The rules:**

1. **Both sides, every stance (E008).** Every stance needs at least one non-deep challenge
   reachable from each side, even for users who skip deep items. Add one for the middle too (W104).
   Aim for the same number and strength of challenges on each side.
2. **The user can always stand their ground (E009).** At least one `hold` or `distinguish` option,
   and at least one `yield` option with `revise`.
3. **Reactions:**
   - `hold`: keeps the view and bites the bullet.
   - `distinguish`: keeps the view by naming a relevant difference. Write the strongest real
     distinction, the one a thoughtful person on that side would give.
   - `yield`: reconsiders; `revise` re-asks the targeted answer right away.
4. **Steelman.** Use the strongest version of the argument, preferably from the literature, and
   cite it (`source`, W105). "Original scenario" is fine for new cases. State facts precisely and
   cite them.
5. **Tone: Socratic.** Describe the case and ask; never tell the user they're wrong. Yield options
   are dignified ("It gives me pause…", "On reflection…"), never "I was wrong".
6. **Give options effects.** Choosing an option records something (W106). Use `value: 0` for an
   intentional neutral like "I'd leave it blank".

After the challenges, end the topic with a `reask` of the stance ("Having thought about these
cases, where do you land now?"). Results report shifts as **self-reported reconsideration**, not
persuasion.

## Anchors and tensions

Tensions are the "you apply this principle differently here than there" cards. They compare only
**anchor** items, never whole-topic averages.

```yaml
- id: anchor_ba
  type: likert
  points: 7
  text: When it comes to pregnancy, a woman's right to decide what happens to her own body should come first.
  principles: { bodily_autonomy: 1 }
  anchor: { principle: bodily_autonomy, context: pregnancy, against: the life of the fetus }
```

- **One principle per anchor**, with a **positive** weight on it, so agreeing always means endorsing
  it (E013). Don't load other principles heavily (W109).
- **Matched wording across topics.** Reuse the principle's sentence frame, so the only difference
  is the context:

  | Principle | Frame |
  |---|---|
  | Bodily autonomy | When it comes to {context}, {person}'s right to decide what happens to their own body should come first. |
  | Sanctity of life | Deliberately ending a human life is wrong, even {the hardest case in this context}. |
  | Protecting the vulnerable | {Restriction} to protect vulnerable people {from the harm}, even if that means {who loses which freedom}. |
  | Things money shouldn't buy | Paying someone for {thing} should not be allowed, even if both adults freely agree. |
  | Caution with the irreversible | When it comes to {context}, the risk of a mistake that can never be undone should make us hold back, even if that means {the benefit given up}. |

- **`against`** names the competing interest in this context. The tension card offers it to the
  user as their best defense ("one difference: there the competing interest is *the health of
  other people*").
- **Each principle needs anchors in at least 2 topics (W107)**, chosen so the principle is invoked
  by each side of politics in different topics. The anchor matrix in `TAXONOMY.md` tracks this.
  Without that, tensions could only ever be raised against one side.

## Neutral wording

| Prefer | Avoid |
|---|---|
| fetus, embryo | unborn child, baby (before birth), clump of cells |
| woman, pregnant woman | mother (before birth) |
| abortion legal / illegal | pro-life / pro-choice (labels, not positions) |
| vaccine requirement | anti-vaxxer, sheeple |
| assisted dying | death panel, culture of death |
| people who use drugs, addiction | addict, junkie, war on drugs |
| laws that protect people from themselves | nanny state |
| selling sex, paying for sex, people who sell sex | prostitute; "sex work" and "prostitution" outside the names of laws and studies |
| surrogate, intended parents | rent-a-womb, baby selling |
| editing embryos, choosing embryos | designer babies, playing God |
| the death penalty | state-sanctioned murder, judicial murder |

`content/loaded-terms.txt` lists terms the lint flags (W108). If a term must appear inside a
quotation, keep it and justify the warning in review.

## Importance and deep items

- Ask the stance first and importance second.
- Mark extra circumstances and secondary challenges `deep: true`. They're skipped when the user
  says the topic matters "not at all" or "a little" (`deepMinImportance` in `config.yaml`).
- Deep items must come after the importance item (E010).

## Evidence labels

| Label | Meaning | Rules |
|---|---|---|
| `validated` | published, validated instrument | items **verbatim**, original order and keying; cite source and license |
| `adapted` | based on a published instrument or research | cite it; say what changed |
| `custom` | our own items | most issue topics |
| `for-fun` | entertainment, no measurement claims | interests |

Check licenses before using an instrument. IPIP items are public domain. Many others (MFQ, PVQ,
ECR-R, MBTI) have terms that need checking for a commercial app.

## Sensitive topics

Domains `worldview` and `identity` are sensitive. Their items get "Prefer not to say" and are
excluded from shared output by default. Identity items **describe and never score**: no effects
(E012). Never infer identity from other answers.

## Review checklist

- [ ] Lint clean (or warnings justified in the PR).
- [ ] Stance labels are ordered and mutually exclusive; the middle is a real position.
- [ ] Each side gets challenges of similar number and strength; each is the strongest version.
- [ ] A thoughtful person on each side would sign off on how their position is described.
      Hot-button topics need two reviewers with different views.
- [ ] Factual claims are accurate and sourced.
- [ ] Anchors use the shared frame; the matrix in `TAXONOMY.md` is updated.
- [ ] No loaded terms; "yield" options are dignified.

## Lint rules

| Code | Rule |
|---|---|
| E001 | YAML syntax or duplicate key |
| E002 | schema violation (unknown key, wrong type, reserved id) |
| E003 | duplicate id |
| E004 | unresolved reference (item, axis, principle, domain) |
| E005 | reference to a later item |
| E006 | condition syntax or type error |
| E007 | item can never be shown (or a reask can never run) |
| E008 | a stance side has no reachable challenge |
| E009 | challenge contract (hold/distinguish + yield-with-revise; valid targets) |
| E010 | stance / importance / deep placement |
| E011 | choice with item-level effects needs option values |
| E012 | sensitivity rules (no opt-out; identity items don't score) |
| E013 | anchor not keyed toward its principle |
| W101 | agree/disagree keying imbalance on an axis |
| W102 | cross-topic reference |
| W103 | reachability couldn't be proven (sampled) |
| W104 | no challenge for the middle position |
| W105 | challenge without a source |
| W106 | option without effects |
| W107 | unused axis/principle, or principle anchored in one topic |
| W108 | loaded term |
| W109 | anchor loads a second principle |
| W110 | choice/pair options average away from 0 on an axis (an undecided respondent gets pushed one way) |
