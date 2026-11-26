# AGENTS.md

`@vinsa/towers`: React components that draw reinsurance program towers, where a layer's height is its amount and its width is its share of the risk. The package only draws. The layering is worked out by the Towers API, and this package renders the API's towers response.

This repository is public. The API that computes towers is closed source and not in this repository: never add engine logic, example programs taken from real data, or internal API details here.

## Commands

Use Node.js 24.

- `npm test` (Vitest), `npx vitest run -t "test name"`
- `npm run typecheck`
- `npm run build`: vite lib build, then `.d.ts`, then copies `src/styles.css` into `dist/`.

## Code

- `src/types.ts` defines the towers response (`TowersResponse`, `Tower`, `HorizontalBand`, `VerticalBlock`). It mirrors the API's response contract by hand. A change to it must match an API release, so add fields as optional and never remove or rename one in a minor version.
- `towerShapes` in `src/tower.ts` rejoins the pieces the API cut at band boundaries into one rectangle per layer.
- `<Towers />` takes a whole response and keeps its own selection state. `<TowerChart />` draws one tower and is fully controlled.
- React is the only peer dependency, and the package has no runtime dependencies.
- Plain CSS in `src/styles.css`, with `rt-` prefixed classes themed through `--rt-*` variables. No Tailwind or CSS-in-JS.
- Relative imports carry `.js` extensions.
- The build adds a `'use client'` banner so the package works under server-component frameworks.
- The README's props tables document the public API: update them in the same change as the props.

## Style

TypeScript, two-space indentation, single quotes, no semicolons.

## Commits and pull requests

Commit subjects are short and imperative. A PR states the behaviour change, the commands run to validate it, and screenshots for visual changes. Issues and PRs are public: test fixtures and screenshots use made-up names and amounts.

## Releases

1. `npm version <x.y.z> --no-git-tag-version` and commit.
2. Push a tag named `towers-v<version>`. `publish-towers.yml` checks the tag matches the version, then runs `npm stage publish` through npm trusted publishing, with provenance. No npm token is stored in the repo.
3. A maintainer approves the staged release on npmjs.com with two-factor authentication before it is public.

The trusted publisher on npm is bound to `vineetsarpal/towers` and the workflow filename `publish-towers.yml`; renaming either breaks publishing until the npm setting is updated.
