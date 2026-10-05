# Who Am I

A local-first web app (PWA, later a TWA on Google Play) that builds a deep profile of who you
are: personality, values, moral principles, positions on issues, worldview, relationships,
lifestyle and interests. It asks questions, probes circumstances, and poses thought-experiment
challenges aimed at whichever side you took. A game built on the profile comes later.

Results open on an overview: a written summary, the pattern of your spectrums drawn as one ring,
your firmest leans, a link to each area's own page (each with a short read-out beside its charts),
and next steps (the strongest cases on both sides of your firmest positions, topics to explore,
and tensions worth a second look). Eleven political traditions serve as reference points: which of
them your political answers sit closest to, with readings from inside each and critiques from
outside. Never a label, a party or a recommendation. Under next steps, links from research say
what large studies found people who describe their personality as you did report more or less
interest in, on average (collapsed until opened, and Settings can turn them off). Share cards turn
your pattern, or one area, into an image to share or save, drawn on the device from answers that
could be shared. It's all worked out on the device by fixed rules, with no AI service.

Interests & Taste is the for-fun end: music, movies and TV, food, sports, books, games, the
outdoors, climbing, art and animals. It shows what you enjoy, grouped by topic, and where you sit
between familiar and new, popular and lesser-known, and calm and intense. It never grades taste or
asks what anything costs.

An optional About you section lets people describe their family, roots, religious background,
gender and sexual orientation. Those answers are never scored or used anywhere else: they stay
folded away on the topic list, show only behind a tap on their own results page, replace each
other when changed, and are left out of backups unless ticked (docs/PRIVACY.md).

All answers stay on your device: no server, no account, no analytics.

## Development

Requires Node 22.18+ (runs the TypeScript scripts natively).

```sh
npm install
npm run dev            # dev server; edits under content/ reload live
npm run content:lint   # lint and compile the question content
npm test               # unit tests, lint fixtures, simulated respondents
npm run check          # svelte-check + TypeScript (app, engine, node)
npm run build          # production build into dist/
npm run test:e2e       # browser tests against the build (run `npm run build` first)
npm run schemas        # regenerate JSON Schemas after changing src/model
```

Extras:

```sh
node scripts/persona-backup.ts tests/sim/personas/libertarian.yaml out.json   # a test persona as an importable backup
node scripts/gen-icons.ts                                                     # re-render app icons after a design change
node scripts/tradition-targets.ts                                             # where each tradition's answer sheet places it
```

## Layout

| Path | What |
|---|---|
| `content/` | the question bank (YAML): domains, axes, principles, topics |
| `content/analysis/` | political traditions, their answer sheets, readings, and links from research (shipped as a separate, lazily loaded chunk) |
| `src/model/` | schemas and types: authored content, bundle, answers, profile |
| `src/engine/` | pure, DOM-free logic: conditions, flow, scoring, tensions, profile, results analysis |
| `src/compiler/` | content compiler and lint (Node), plus the Vite plugin |
| `src/app/` | the Svelte app |
| `tests/` | fixtures, compiler tests, simulated-respondent suite |
| `docs/` | content guide, taxonomy, profile format, results analysis, privacy policy draft |

## Docs

- [Content guide](docs/CONTENT_GUIDE.md): how to write topics, challenges and anchors
- [Taxonomy](docs/TAXONOMY.md): everything the app will cover, and the anchor matrix
- [Profile format](docs/PROFILE_FORMAT.md): the public output contract
- [Results analysis](docs/ANALYSIS.md): the rules behind the summary, next steps, political traditions, links from research and share cards
- [Privacy policy (draft)](docs/PRIVACY.md)
