# Profile format

The profile is the app's public output: what results screens render, and what the future game
(or any other consumer) reads. It is built on-device from the answer log by
`src/engine/profile.ts`.

- **Schema:** `docs/profile.schema.json`, generated from `src/model/profile.ts` (`npm run schemas`).
  CI fails if the committed schema is stale.
- **Versioning:** `profileVersion: 1`. Within a version, changes are **additive only**: new optional
  fields, new axes, new topics. Consumers must ignore unknown keys. Renaming or removing fields, or
  changing meanings, requires `profileVersion: 2`.
- **No raw answers.** The profile carries derived results, never the answer log or free-text notes.
  `interests` comes closest: each pick's rating as given (see [Interests](#interests)).

## Sensitive data

`buildProfile(state, { includeSensitive })`:

- `includeSensitive: true` is the private, on-device view.
- `includeSensitive: false` is for anything that leaves the device: share codes, exports to the
  game. Sensitive topics (religion & worldview, identity, and any item marked sensitive) are
  dropped, and **every score is recomputed without them**. A sensitive answer can't leak through a
  derived axis or principle.
- Sensitive items inside other topics (such as the moral question in physical punishment) are
  dropped the same way: from scores, `circumstances`, `interests` and `completeness.answered`.
  Earlier builds still listed such items under `circumstances` and counted them as answered; that
  was a bug, fixed without a version change because it only removes data that was never meant to
  be there.
- `scope.sensitiveIncluded` records which view this is.
- Identity (About you) answers appear only in `identity`, keyed by `topic.item`
  (`"about_gender.gender": "A woman"`; a multi-select gives a list), only when `includeSensitive` is
  true, and never affect scores.

## Fields

| Field | Meaning |
|---|---|
| `format`, `profileVersion` | `"whoami.profile"`, `1` |
| `contentVersion` | hash of the content the answers were scored against |
| `scope.topics` | topics with at least one answer that are included |
| `axes[id]` | `score` (−1…1 between the poles, or `null` = not enough data), `confidence` (0…1, evidence-based), `weight`, `spread`, `topics`, `family` |
| `principles[id]` | same, plus `byTopic` (endorsement per topic) and `consistency` (anchors only; `null` with < 2 topics) |
| `topics[id]` | `stance` (current), `initialStance` (first answer), `stanceLabel`, `importance` (0…1), `complete`, `circumstances`, `challenges` |
| `topics[id].challenges` | counts of challenges asked, `held`, `distinguished` and `moved`, plus `moves` (`source`, `delta`, `steps`) |
| `interests` | `topic.item.option` (picks on multi-selects tagged `interest`) or `topic.item` (ratings tagged `interest`) → 0…1 |
| `tensions[]` | `principle`, the two `topics`, `gap`, and `status`: `open`, `distinguished`, `revised` or `acknowledged` |
| `evidence[topic]` | `validated`, `adapted`, `custom` or `for-fun` |
| `completeness` | `answered` items; `orphaned` stored answers that no longer match the content |

## Interests

`interests` holds every pick on an interest multi-select with its rating as given, and each
topic's one interest rating, how much the topic matters (lint E017). No sensitive item is ever an
interest (E012), so the private and public views list the same ones. The taste spectrums
(`novelty`, `mainstream`, `intensity`) are ordinary `axes`.

That is close to the raw answers, and ordinary likes taken together predict private traits:
Facebook Likes alone told gay from straight men in 88% of cases (Kosinski, Stillwell & Graepel,
*PNAS*, 2013). So before share codes or a game export carry interests, show the person which ones
would go and let them leave them out, and consider sending only each topic's top picks.

## Interpreting scores

- **Scores are raw positions on our scales, not percentiles.** There's no population data, so "0.4
  toward Progress" says where your answers sit, not how you compare to others.
- **Confidence measures evidence, not completion.** It doesn't drop when new content is added.
- A `null` score means not enough evidence (`minWeight` / `minTopics` in `content/axes.yaml`).
- Big Five axes come from the Mini-IPIP (a validated short form). Political and taste axes come
  from custom items. Labels from `evidence` should travel with any display.
- A shift (`moves`) is **self-reported reconsideration** after a challenge, not proof of persuasion.

## Example (abridged)

```json
{
  "format": "whoami.profile",
  "profileVersion": 1,
  "contentVersion": "5262a1bc6c0e",
  "scope": { "sensitiveIncluded": false, "topics": ["mini_ipip", "abortion"] },
  "axes": {
    "cultural": { "score": 0.41, "confidence": 0.62, "weight": 5, "spread": 0.35, "topics": 2, "family": "political" },
    "economic": { "score": null, "confidence": 0, "weight": 0, "spread": 0, "topics": 0, "family": "political" }
  },
  "topics": {
    "abortion": {
      "stance": 0.3333, "initialStance": -0.6667, "stanceLabel": "Legal early in pregnancy, restricted later",
      "importance": 0.6667, "complete": true, "circumstances": { "rape": 1 },
      "challenges": { "asked": 3, "held": 1, "distinguished": 1, "moved": 1,
        "moves": [{ "source": "abortion.ch_violinist", "delta": 1, "steps": 3 }] }
    }
  },
  "tensions": [{ "key": "bodily_autonomy|abortion|vaccine_mandates", "principle": "bodily_autonomy",
    "topics": ["abortion", "vaccine_mandates"], "gap": 1.33, "status": "distinguished", "reason": "harm_to_others" }]
}
```
