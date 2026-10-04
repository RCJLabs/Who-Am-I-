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
  named-politics.txt party and politician names the analysis pack must not use (W112)
  topics/<domain>/<topic>.yaml
  analysis/          reference material for the results analysis (optional; shipped separately)
    traditions.yaml  political traditions: names, summaries, neighbours and readings
    sheets/<id>.yaml each tradition's answer sheet, which places it on the political spectrums
    readings.yaml    readings from inside and outside each tradition
    loaded-terms.txt words loaded only in descriptions of traditions (W108, pack only)
```

Each topic file starts with `# yaml-language-server: $schema=../../../schema/topic.schema.json`, so
editors with the YAML extension autocomplete and validate as you type.

Run `npm run content:lint` before committing. Errors fail the build. Warnings fail the content
tests and CI (`--max-warnings 0`), so fix them too.

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
| `instructions` | shown once before the first item: a validated instrument's instructions, or the story that sets up a thought experiment (give the stance a one-line `help` reminder for people returning later) |
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
| `multi` | pick several (genres, sports) | `intensity: true` rates each pick 1–5; tag `interest` to appear in interests |
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
- **In topics with a stance, only the stance feeds spectrums**: weight 1 in core topics, 0.5 in
  extended ones, so a deep dive never outweighs a core issue. A core stance whose ladder fits some
  traditions and not others gets 0.5 too (marriage and divorce, whose fault-based steps come from
  Western Christian law). A stance that also feeds a second
  spectrum gives it half the main weight (1 and 0.5 in a core topic, 0.5 and 0.25 in a deep dive). Circumstances and challenges are
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

**Spectrums and principles.** Spectrums (`axes.yaml`) are positions between two poles: political
(civil, cultural, economic, diplomatic), values (stability or change, getting ahead or looking out
for others, rules or outcomes, near or far), how you think (steady or flexible, intuition or
analysis), worldview, personality and taste. Principles
(`principles.yaml`) are moral considerations a person endorses or rejects. The first seven are the
moral foundations, which the moral foundations topic measures directly with statements keyed both
ways; issue topics add to them through challenge options. Questionnaire topics without a stance
(trade-offs, foundations) may feed spectrums from every item, as long as each spectrum's items are
balanced (W101, W110).

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
7. **Aim each case at the answer it bears on.** A case has to be able to move the answer it
   targets, or "reconsider" has nowhere to go. Evidence about one part of a topic often bears on a
   circumstance rather than the stance: medical evidence about puberty blockers says nothing about
   legal recognition of transgender adults. Target that circumstance instead, as abortion's rape
   exception does (`targets: rape`, `when: stance < 0 and rape > 0`).

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
  | Doing vs. allowing | Actively {causing a death or harm} is worse than letting {it happen}, even {when the cost of not acting is high}. |
  | Truth | When it comes to {context}, the truth matters more than comfort, even {when it hurts}. |
  | Liberty | When it comes to {context}, the government should leave people free to {the freedom}, even though some will misuse that freedom to {the harm}. |
  | Due process | No one should lose {a right} because a court fears what they might do, rather than for something they've been proven to have done, even if that means some dangerous people {keep it} for a while. |
  | Obeying the law | {Who} should obey {the law} even when {the conflict}, and work for change only through legal means. |
  | Just deserts | When it comes to {context}, no one should get money they haven't earned through their own efforts, even if that means {the cost}. |
  | National self-government | When it comes to {context}, each country should be left to decide for itself, without other countries or international bodies stepping in, even when {the worst case}. |
  | Deciding locally | When it comes to {context}, decisions should be left to local communities, even when {the cost}. |
  | Deference to experts | When it comes to {context}, governments should follow what {which experts} recommend, even when most voters disagree. |
  | Same rules for everyone | When it comes to {context}, everyone should be treated by the same rules, whatever their {race or sex}, even when {the cost}. |
  | Deserved punishment | When it comes to {context}, people who do serious wrong should be punished as they deserve, even {when the cost}. |
  | Personal responsibility | When it comes to {context}, no one should be made to pay for a wrong they didn't commit themselves, even {when the cost}. |
  | Duties to future generations | When it comes to {context}, we shouldn't pass the costs of {what we do today} on to future generations, even if that means {the cost now}. |
  | Animal welfare | When it comes to {context}, the law should protect animals from suffering, even if that means {the cost to people}. |
  | Respect for the natural order | When it comes to {context}, {the thing} shouldn't be engineered, even for good ends like {the benefit}. |
  | Belief that fits the evidence | When it comes to {context}, people should believe only what the evidence supports, even if {believing more would help}. |
  | Loyalty | When it comes to {context}, people should stand by {their family, coworkers or country} and {what that means here}, even {when they think it's in the wrong}. |
  | Debts of gratitude | When it comes to {context}, {who} owe something back to {who gave}, even though they never agreed to that debt. |
  | Parents' say | When it comes to {context}, parents, not the state, should decide, even when some parents will decide wrongly. |
  | Collective welfare | When it comes to {context}, {who} should {accept a burden} for the good of the community, even if {the cost}. |

- **Rewards and punishment are separate principles.** Someone can hold that rewards should be
  earned without holding that punishment should match wrongdoing, so just deserts
  (`retribution`) covers rewards only and deserved punishment (`deserved_punishment`) covers
  punishment. Key an option to the one it's about; one principle for both would let the tension
  detector compare the two as if they were the same claim.
- **Deference anchors name the experts and say what they advise.** "Experts" means different
  people on vaccines and on rents, so an issue topic's anchor names them (public-health experts,
  economists) and its help text states their usual advice. Only the general anchor in experts or
  voters says just "experts". Someone who disagrees should be disagreeing with deferring, not
  guessing what the experts think.
- **Match the stakes across contexts.** The benefit given up should weigh about the same in each
  topic, or agreeing costs less in one than the other. The natural order's crops anchor gives up
  "crops that survive drought and disease" to match "preventing disease" for embryos, not "bigger
  harvests". For the same reason, animal welfare's frame asks whether the law should protect
  animals at a cost: almost everyone agrees animals' suffering counts for something.
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
| speech that stirs up hatred against a group | "hate speech" in stances and labels (fine in the names of laws) |
| removing posts, banning accounts | "censorship" for what private platforms do |
| gun owners, restrictions on guns | gun nuts, gun grabbers |
| the feature (semi-automatic rifles) | assault weapons, weapons of war |
| gun deaths, saying whether suicides are included | "gun violence" totals that silently include suicides |
| monitoring, bulk collection | spying, Big Brother, surveillance state |
| religious objectors | bigots, license to discriminate |
| protesters, people who oppose abortion | thugs, eco-terrorists, anti-abortion activists |
| the method itself (sleep deprivation, stress positions) | enhanced interrogation |
| people accused, defendants | criminals (before a conviction) |
| inheritance tax, estate tax | death tax |
| employers, business owners | job creators |
| people receiving support or benefits | welfare queens, scroungers, freeloaders, handouts |
| healthcare paid for by taxes | socialized medicine |
| tax cuts | tax relief |
| replacement workers | scabs |
| union leaders | union bosses |
| drug companies, the largest technology companies | big pharma, big tech |
| low-paid or unsafe factories, naming the conditions; forced labor where it is forced | sweatshops, slave labor |
| laws banning required union fees | "right-to-work" (fine in the names of laws) |
| supporters of military action, people who oppose a war | warmongers, chicken hawks, appeasers |
| courts striking down laws | activist judges, judicial activism |
| officials, regulators, civil servants | unelected bureaucrats, the deep state, so-called experts |
| international bodies, shared international rules | globalists, new world order |
| putting your own country first, in plain words | "America First" and other campaign slogans |
| people living in the country without legal permission | illegal aliens, illegals; "illegal immigrants" and "undocumented immigrants" (each side's term) |
| sponsoring relatives; few limits on immigration | chain migration; open borders |
| moving money from police to other services; excessive force | defund the police; police brutality |
| the number of people in prison; people with convictions | mass incarceration; ex-cons, career criminals |
| same-sex marriage; gay and lesbian people; sexual orientation | marriage equality, traditional marriage; homosexuals as a noun, sexual preference |
| sex at birth; transgender women who went through male puberty | biological males, assigned male at birth (each side's term) |
| puberty blockers and hormones, medical transition | gender-affirming care, sex change, mutilation |
| considering race; reserved places; naming the groups | racial preferences, reverse discrimination; catch-all labels |
| the policy itself (leave reserved for each parent, board quotas) | "equal outcomes" as a label for the other side's view |
| treating everyone equally now; descendants of enslaved people | "doing nothing"; white guilt, victim mentality |
| the position in its holders' words ("focus on adapting"); people who doubt warming is mostly man-made or dangerous; people who see climate change as an emergency | climate deniers, alarmists, climate hoax, climate cult, "doing nothing" |
| climate change; low-carbon, naming the source | climate crisis, climate emergency, global heating; clean coal, dirty energy |
| the policy itself (a ban on new gasoline cars, a carbon tax) | war on cars, war on farmers, axe the tax, keep it in the ground, drill baby drill |
| intensive farming, naming the practice (cages, crates); livestock farming | factory farming, big meat, big ag |
| meat grown from animal cells | lab-grown meat, cultivated meat, fake meat, clean meat |
| slaughter without stunning for religious reasons; naming the communities | ritual slaughter, humane slaughter |
| GM food; gene-edited crops; GM crops found in other fields | Frankenfood, terminator seeds, genetic pollution |
| spent fuel; a permanent store | nuclear dump, nuke plants |
| people who think advanced AI could cause a catastrophe; people who want AI built as fast as possible; technology executives | doomers, decels, accelerationists, e/acc; tech bros, AI slop |
| believers; nonbelievers, or the labels people choose (atheist, agnostic, humanist) | the godless, unbelievers, nones, heathens, infidels; fundamentalists, Bible-thumpers |
| a tradition "teaches"; people "report experiencing"; "convinced" (not "sure") at the ends of a belief ladder | "claims"; superstition, delusion, fairy tale, blind faith, brainwashed |
| the Hebrew Bible or Torah; the Quran; deities and sacred images; rebirth (for Buddhists) | the Old Testament (for Jewish texts); idols, idol worship; Mohammedan |
| people who doubt free will; naturalism; "moral claims are never true" | materialism as a label for nonbelievers; nihilists |
| "It gives me pause" when reconsidering; what a belief gives people, in their words | "Maybe I've been fooling myself"; faith as "comforting" or "convenient" |
| the official account; its critics; an alternative explanation; people who doubt it | conspiracy theorists, truthers, tinfoil hats; sheeple, NPCs; "the narrative" |
| specialists, most specialists, dissenting specialists | fringe, cranks, quacks; "settled science", "trust the science", "do your own research" |
| major news outlets, smaller independent outlets | the mainstream media, MSM, legacy media, fake news |
| "shown wrong by" whom; a claim that didn't hold up; "cover-up" only where an inquiry found one | debunked, misinformation, disinformation; cover-up as a bare accusation |
| what people believe and practise; people who consult a medium or an astrologer | "real" or "not real"; paranormal, occult, New Age, superstition |
| "view" in questions about changing your mind | "belief" there: items about revising beliefs track religiosity |
| children whose parents live apart; one-parent and two-parent families; born to unmarried parents; living together unmarried | broken homes, intact families, fatherless; illegitimate, out of wedlock, living in sin, shacking up |
| divorce without blame ("no-fault" only as the legal term); ending a marriage at one spouse's word | divorce on demand, quickie divorce, divorce culture |
| an affair, as distinct from partners who agree to other relationships | "cheating" for agreed non-monogamy; homewrecker |
| people without children | childless, child-free, barren |
| physical punishment, with "smack" defined (an open hand, on the bottom or hand) | "violence" for a smack, "abuse" for all physical punishment; spare the rod, loving discipline, anti-smacking |
| care homes, carers; caring for a parent as work | caring for a parent as a burden; dumped in a home, warehousing the elderly |
| report, give evidence | snitch |
| low or falling birth rates; policies to raise the birth rate | demographic winter, population collapse, overpopulation |
| people who work long hours, naming the hours; people who want to work less | workaholics, hustle culture, rat race, wage slaves; lazy, work-shy, idlers, quiet quitting |
| people who save most of what they have; people who spend most of it | misers, cheapskates, tightwads; spendthrifts, YOLO, "living beyond their means" |
| high-interest lenders, naming the rate | loan sharks, predatory lenders, debt traps |
| common chronic illnesses; the habits by name (smoking, drinking, diet, exercise) | lifestyle diseases, self-inflicted; junk food, clean eating |
| people with a higher body weight, naming the measure; weight-loss drugs by name | the obese, obesity epidemic, couch potatoes, letting themselves go; fat jabs, the easy way out |
| tobacco and food companies; taxes on tobacco, alcohol or sugary drinks | big tobacco, big soda; sin taxes; health fascism, food police |
| disabled people, people with disabilities, wheelchair users | the disabled, wheelchair-bound, handicapped, special needs |
| people who drink; people with a drinking problem | drunks, alcoholics as a noun, substance abuse; killjoys, wowsers, puritanical |
| people who bet; people harmed by gambling; people with a gambling disorder | problem gamblers, degenerate gamblers, gambling addicts; "a tax on stupidity"; "responsible gambling" (the industry's term), predatory gambling |
| under-16s; heavy use, naming how long and how often | screen addiction, iPad kids, brain rot, digital heroin; moral panic, technopanic, kids these days |
| people in rural areas or in cities, naming the place | rednecks, hicks, flyover country, white trash; city slickers, coastal elites, latte liberals, real America |

`content/loaded-terms.txt` lists terms the lint flags (W108). Because warnings fail the tests and
CI, a flagged term can't appear in anything users read, even inside a quotation: paraphrase it.
The `source` citation isn't checked, so a quoted title can keep its original wording there.

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

Domains `worldview` and `identity` are sensitive, and so are two topics in `epistemics` and one in `relationships`. Their items get "Prefer not to say" and are
excluded from shared output by default. Identity items **describe and never score**: no effects
(E012). Never infer identity from other answers.

In worldview, the sides are believers and nonbelievers, not left and right:

- **Same words on both sides.** A belief ladder runs from "Convinced there is none" to "Convinced
  there is one", with the same verbs at each step. "Convinced", not "sure": many believers separate
  faith from certainty. The middle is "Undecided", which includes thinking it can't be known.
- **Descriptive items are never scored:** what kind of God, practices, the label someone uses. Ask
  about private prayer, meditation and services separately, so neither secular meditators nor
  people who mostly worship at home are misdescribed.
- **No challenge implies that without God anything is permitted,** or that nonbelievers can't be
  good. A metaethics help text says people anywhere on the scale can live moral lives.
- **Balance the spectrum against acquiescence.** The two stances that feed it run in opposite
  directions, so someone who taps the same end everywhere isn't pushed to one pole.
- **The writer has a stake in machine minds.** That topic waits for a human co-author without
  AI-industry ties, and no case may involve the writer's maker or its models.

A single topic can be sensitive in a domain that isn't (`sensitive: true` on the topic). In How you
know, official accounts and spirits and signs are, since some answers carry stigma or are
religious practice.

In How you know, the sides are people who trust an institution's word and people who doubt it, and
which side doubts which institution moves with who holds power:

- **Neither trust nor doubt is the smart default.** Ladder ends give each side its reason ("together
  they know far more than I could find out"; "official accounts protect those in power"), never
  "assume" or "blindly".
- **Name institutions each side trusts, or none.** A stem built on one agency measures who runs it.
- **Balance cases by which side they flatter**, and include neutral ones. Every proven failure says
  how it came out and how long it took; trusters' hold options give their real reason ("the checks
  worked, slowly"); no yield says "I was naive". No elections, parties or living politicians.
- **Beliefs about spirits, foresight, astrology and the evil eye are described, never challenged.**
  For many people they are religious practice, and no case tests worshippers' practice elsewhere
  either. Ask what people believe, not what is real, and how they understand their own experiences.
- **No case about trusting AI.** The writer has a stake; AI assistants appear only as a news source.

A single item can be sensitive in a topic that isn't (`sensitive: true` on the item). In physical
punishment, the moral question can reveal what a parent does and the qualities list can reveal
faith, so both get "Prefer not to say". In work and the good life, what your own work is to you
can reveal being out of work, so it does too.

In Relationships & family, the sides are traditional and progressive views of family, and also
individualist and family-obligation cultures, which don't line up with left and right. Duties to
aging parents is sensitive: estrangement and abuse.

- **No family form is presented as deficient.** Evidence about children's outcomes says "on
  average", says what the children are compared with, and names what the study can't rule out, in
  the same passage. It never says "you".
- **Duties to parents are stated as a rule.** The stem says "as a rule" and the help text "parents
  in general", so no step tells someone they owe care to a parent who mistreated them; that comes
  up in a case of its own. Caring for a parent is work, never a burden, and a care home is never
  abandonment.
- **Policy, not people's own lives.** Nothing asks about the user's marriage, discipline or plans
  for children, and birth rates asks only what governments should do; nothing implies anyone ought
  to have children. Who the user is belongs to Identity.
- **Each side in its holders' words.** A ban on smacking is equal protection met mostly with
  support, not prosecuting parents; divorce at either spouse's word is courts not judging reasons,
  not whim; owing parents nothing special still owes what the relationship calls for. Hold options
  give parents' own reasons ("a rare, calm smack within limits").

In Lifestyle & money, the sides are work, thrift and responsibility (small business owners, trades
and farmers, working-class and immigrant strivers, religious abstainers, libertarians) and
wellbeing and circumstance (public health, people who want shorter hours, people with chronic
illness or disability, harm reduction, parents and teenagers). Answers track income, health and
caring duties as much as values, so no topic but gambling feeds a spectrum.

- **People in general, never the user's own life.** Stems say "for most people" and "as a rule,
  once the bills are paid", and help texts set aside anyone who can't work, is caring for someone,
  has retired or has nothing left after essentials. Nothing asks about the user's own health,
  weight, savings, debt, drinking or betting.
- **Health is a belief about evidence, never blame.** The stance asks how much of the difference
  between people comes down to choices, for common illnesses, and its help text says many
  illnesses have nothing to do with anyone's choices. Body weight is never called a choice.
  Personal responsibility has no anchor here: its frame would make illness something people answer
  for.
- **Each end in its holders' words.** The hard-working end gives purpose and a family's security,
  not just hours; the saving end, never being at the mercy of a boss, a lender or bad luck;
  gambling's ban end, money taken without anything earned and losses that fall on families; its
  legal end, adults deciding how to spend their own money. Work ladders avoid office words
  ("career", "balance"), so they fit trades, farms and small businesses.
- **Numbers, not one person's ruin.** Gambling cases give rates and shares, never one person's
  losses. Screens stay about social media and phones, and no case involves AI assistants or AI
  companies: the writer has a stake.

## Review checklist

- [ ] Lint clean: no errors and no warnings.
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
| E004 | unresolved reference (item, axis, principle, domain; in the analysis pack, tradition, reading or pole) |
| E005 | reference to a later item |
| E006 | condition syntax or type error |
| E007 | item can never be shown (or a reask can never run) |
| E008 | a stance side has no reachable challenge |
| E009 | challenge contract (hold/distinguish + yield-with-revise; valid targets) |
| E010 | stance / importance / deep placement |
| E011 | choice with item-level effects needs option values |
| E012 | sensitivity rules (no opt-out; identity items don't score) |
| E013 | anchor not keyed toward its principle |
| E014 | tradition balance: with the positions the answer sheets give, two traditions toward each pole of every political spectrum; left and right within one; neighbours listed both ways; inside readings voiced from inside, critiques from outside, the first from the other side |
| E015 | answer sheet: one per tradition; every shareable political question answered or listed as divided; only scale questions that place a tradition, never sensitive ones; steps on the scale; nothing both answered and divided; every spectrum and compared principle placed |
| W101 | agree/disagree keying imbalance on an axis |
| W102 | cross-topic reference |
| W103 | reachability couldn't be proven (sampled) |
| W104 | no challenge for the middle position |
| W105 | challenge without a source |
| W106 | option without effects |
| W107 | unused axis/principle, or principle anchored in one topic |
| W108 | loaded term (in the analysis pack, also `content/analysis/loaded-terms.txt`) |
| W109 | anchor loads a second principle |
| W110 | choice/pair options average away from 0 on an axis (an undecided respondent gets pushed one way) |
| W111 | readings: fewer than two inside or outside a tradition, unused, or uneven between the sides or poles |
| W112 | a party or politician named in the analysis pack (titles and authors, as citations, are exempt) |
