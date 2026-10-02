# Who Am I

A local-first web app (PWA, later a TWA on Google Play) that builds a deep profile of who you
are: personality, values, moral principles, positions on issues, worldview, relationships,
lifestyle and interests. It asks questions, probes circumstances, and poses thought-experiment
challenges aimed at whichever side you took. A game built on the profile comes later.

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
```

## Layout

| Path | What |
|---|---|
| `content/` | the question bank (YAML): domains, axes, principles, topics |
| `src/model/` | schemas and types: authored content, bundle, answers, profile |
| `src/engine/` | pure, DOM-free logic: conditions, flow, scoring, tensions, profile |
| `src/compiler/` | content compiler and lint (Node), plus the Vite plugin |
| `src/app/` | the Svelte app |
| `tests/` | fixtures, compiler tests, simulated-respondent suite |
| `docs/` | content guide, taxonomy, profile format, privacy policy draft |

## Docs

- [Content guide](docs/CONTENT_GUIDE.md): how to write topics, challenges and anchors
- [Taxonomy](docs/TAXONOMY.md): everything the app will cover, and the anchor matrix
- [Profile format](docs/PROFILE_FORMAT.md): the public output contract
- [Privacy policy (draft)](docs/PRIVACY.md)
