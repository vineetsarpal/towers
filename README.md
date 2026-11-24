# @vinsa/towers

React components that draw reinsurance program towers from a computed towers response.

The package only draws. It expects the response the tower engine returns (risks, each with towers made of bands and blocks); it does not work out the layering from raw contract data.

## Install

```sh
npm install @vinsa/towers
```

React 18 or later is a peer dependency. There are no other runtime dependencies.

## Use

```tsx
import { Towers } from '@vinsa/towers'
import '@vinsa/towers/styles.css'

export function ProgramTowers({ response }) {
  return <Towers data={response} />
}
```

`response` is the body of the towers endpoint, passed through unchanged.

### `<Towers />`

Draws every tower in a response, one section per risk, with a key underneath.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `data` | `TowersResponse` | required | The towers response. |
| `riskId` | `string` | all risks | Draw only this risk. |
| `selectedKey` | `string \| null` | own state | The highlighted layer. Pass it to control selection yourself. |
| `onSelect` | `(key, risk) => void` | | Called when a layer is clicked; `key` is `null` when the selection is cleared. |
| `loss` | `number \| null` | `null` | Draws a loss of this amount up every tower. |
| `scale` | `'amount' \| 'even'` | `'amount'` | Heights to scale, or every band the same height. |
| `height` | `number` | `420` | Plot height of each tower, in pixels. |
| `legend` | `boolean` | `true` | Show the key. |
| `className` | `string` | | Added to the outer element. |

### `<TowerChart />`

One tower, with no surrounding layout, for when you build the page yourself. It takes `tower` plus the same `selectedKey`, `onSelect`, `loss`, `scale` and `height`. Layers are only clickable when `onSelect` is given. Pass one `fills` map (from `assignFills(towers)`) to several charts so a contract keeps its colour across them.

### Helpers

Use the Engine’s `POST /recoveries` for Recovery Estimates for illustration and what-if analysis, never for booking.

`formatAmount`, `formatPercent`, `layerTerms`, `layerKey` and `assignFills` are exported for building schedules and side panels that match the chart.

`isLayerCedant(block)` (0.3.1 and later) identifies a Layer's cedant block in the reinsurer viewpoint. It returns `false` for retention fillers.

## Theme

Set any of these on `:root` or on an element around the chart:

```css
:root {
  --rt-font: inherit;
  --rt-ink: #162033;
  --rt-ink-soft: #56627a;
  --rt-surface: #ffffff;
  --rt-rule: #e8ebf0;
  --rt-retention: #d5d9df;
  --rt-loss: #b3261e;
}
```

Layer colours come from the response: a block's `colorOverride` wins, otherwise each `colorKey` gets a fill from a built-in set.

## Develop

```sh
npm test
npm run build
```

## License

[MIT](LICENSE)
