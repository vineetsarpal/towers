import { useMemo } from 'react'
import type { Tower } from './types.js'
import { assignFills, blockLines, formatAmount, layerCaptions, layerKey, towerShapes, towerTop } from './tower.js'

const LINE = 15
/** Where the highest finite limit sits when unlimited layers need room to run past it. */
const OPEN_TOP_AT = 0.9

export type ScaleMode = 'amount' | 'even'

export type TowerChartProps = {
  tower: Tower
  /** Fill per colour key. Pass one map to several charts so they share colours. */
  fills?: Map<string, string>
  /** The highlighted layer, as given to onSelect. */
  selectedKey?: string | null
  /** Makes layers clickable. Called with null when the selection is cleared. */
  onSelect?: (key: string | null) => void
  /** Draws a loss of this amount up the tower. */
  loss?: number | null
  /** 'amount' draws heights to scale; 'even' gives every band the same height. */
  scale?: ScaleMode
  /** Plot height in pixels. */
  height?: number
}

export const statusClass = (status: string | null | undefined) =>
  status ? `rt-status-${status.replace(/\s+/g, '-')}` : ''

export default function TowerChart({
  tower,
  fills,
  selectedKey = null,
  onSelect,
  loss = null,
  scale = 'amount',
  height: HEIGHT = 420,
}: TowerChartProps) {
  const shapes = useMemo(() => towerShapes(tower), [tower])
  const captions = useMemo(() => layerCaptions(shapes), [shapes])
  const ownFills = useMemo(() => fills ?? assignFills([tower]), [fills, tower])
  const top = towerTop(tower)
  const hasOpenTop = tower.unlimitedBands.length > 0
  const finiteTop = top === 0 ? 0 : hasOpenTop ? OPEN_TOP_AT : 1

  const limits = useMemo(
    () => [...new Set([0, ...tower.bands.flatMap((b) => [b.hyFrom, b.hyTo ?? 0])])].sort((a, b) => a - b),
    [tower],
  )

  /** Amount → height up the plot, 0 to 1. */
  const y = (amount: number | null): number => {
    if (amount === null) return 1
    if (top === 0) return 0
    if (scale === 'amount') return (Math.min(amount, top) / top) * finiteTop
    // Even bands: every band gets the same height, whatever its size.
    const i = limits.findIndex((l) => l >= amount)
    if (i <= 0) return i === 0 ? 0 : finiteTop
    const lower = limits[i - 1]
    const within = (amount - lower) / (limits[i] - lower)
    return ((i - 1 + within) / (limits.length - 1)) * finiteTop
  }

  // Axis labels at the attachment points, skipping any that would collide.
  const ticks: { amount: number; at: number }[] = []
  for (const amount of limits) {
    const at = y(amount)
    const last = ticks[ticks.length - 1]
    if (!last || (at - last.at) * HEIGHT >= 16) ticks.push({ amount, at })
  }

  const lossAt = loss !== null && top > 0 ? y(Math.min(loss, top)) : null

  return (
    <div className="rt-chart">
      <div className="rt-axis" style={{ height: HEIGHT }} aria-hidden>
        {ticks.map((t) => (
          <span key={t.amount} className="rt-tick" style={{ bottom: `${t.at * 100}%` }}>
            {formatAmount(t.amount)}
          </span>
        ))}
        {hasOpenTop && <span className="rt-tick rt-tick-open">no limit</span>}
      </div>

      <div className="rt-plot" style={{ height: HEIGHT }} onClick={onSelect && (() => onSelect(null))}>
        {shapes.map((shape) => {
          const { block } = shape
          const bottom = y(shape.from)
          const height = y(shape.to) - bottom
          const key = layerKey(block)
          // A panel line leaves room above it for its layer's caption.
          const room = height * HEIGHT - 4 - (block.reinsurerName ? 2 * LINE : 0)
          const lines = blockLines(block).slice(0, Math.max(1, Math.floor(room / LINE)))
          const style = {
            left: `${shape.x0 * 100}%`,
            width: `${(shape.x1 - shape.x0) * 100}%`,
            bottom: `${bottom * 100}%`,
            height: `${height * 100}%`,
          }
          const text = height * HEIGHT >= 13 ? lines.map((line, i) => <span key={i}>{line}</span>) : null
          const openTop = shape.to === null ? ' is-open-top' : ''

          if (block.isRetention) {
            return (
              <div key={shape.id} className={`rt-shape is-retention${openTop}`} style={style} title={blockLines(block)[0]}>
                {text}
              </div>
            )
          }
          const state = selectedKey === null ? '' : selectedKey === key ? ' is-selected' : ' is-dimmed'
          const layer = {
            className: `rt-shape ${statusClass(block.reinsurerStatus)}${state}${openTop}`,
            style: { ...style, backgroundColor: ownFills.get(block.colorKey) },
            title: [block.layerName, ...blockLines(block)].filter((v, i, all) => all.indexOf(v) === i).join('\n'),
          }
          if (!onSelect) {
            return (
              <div key={shape.id} {...layer}>
                {text}
              </div>
            )
          }
          return (
            <button
              key={shape.id}
              type="button"
              {...layer}
              aria-pressed={selectedKey === key}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selectedKey === key ? null : key)
              }}
            >
              {text}
            </button>
          )
        })}

        {captions.map((c) => (
          <span
            key={c.key}
            className="rt-caption"
            style={{ left: `${c.x0 * 100}%`, maxWidth: `${(c.x1 - c.x0) * 100}%`, bottom: `${y(c.to) * 100}%` }}
          >
            {c.text}
          </span>
        ))}

        {lossAt !== null && loss !== null && (
          <div className="rt-loss" style={{ height: `${lossAt * 100}%` }}>
            <span className="rt-loss-flag">
              Loss {formatAmount(loss)}
              {loss > top ? `, ${formatAmount(loss - top)} above the tower` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
