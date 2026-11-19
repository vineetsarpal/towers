import { useMemo, useState } from 'react'
import TowerChart, { statusClass } from './TowerChart.js'
import type { ScaleMode } from './TowerChart.js'
import { assignFills, isQuoteBlock, OTHER_REINSURERS } from './tower.js'
import type { RiskTowers, TowersResponse } from './types.js'

export type TowersProps = {
  /** The towers response as the backend returned it. */
  data: TowersResponse
  /** Show only this risk. By default every risk in the response is drawn. */
  riskId?: string
  /** Controls the highlighted layer. Leave out to let the component keep its own selection. */
  selectedKey?: string | null
  /** Called when a layer is clicked, or with null when the selection is cleared. */
  onSelect?: (key: string | null, risk: RiskTowers) => void
  /** Draws a loss of this amount up every tower. */
  loss?: number | null
  scale?: ScaleMode
  /** Plot height of each tower in pixels. */
  height?: number
  /** Set false to hide the key under each risk. */
  legend?: boolean
  className?: string
}

const STATUSES = ['signed', 'firm order', 'quoted', 'indication']

function RiskSection({
  risk,
  titled,
  selectedKey,
  onSelect,
  loss,
  scale,
  height,
  legend,
}: {
  risk: RiskTowers
  titled: boolean
  selectedKey: string | null
  onSelect: (key: string | null) => void
} & Pick<TowersProps, 'loss' | 'scale' | 'height' | 'legend'>) {
  const fills = useMemo(() => assignFills(risk.towers), [risk])
  const { statuses, quotes, hasOtherReinsurers } = useMemo(() => {
    const seen = new Set<string>()
    const quotes = new Set<string>()
    let hasOtherReinsurers = false
    for (const tower of risk.towers) {
      for (const band of [...tower.unlimitedBands, ...tower.bands]) {
        for (const block of band.verticalBlocks) {
          if (block.blockKind === 'otherReinsurers') hasOtherReinsurers = true
          if (block.lineStatus) {
            seen.add(block.lineStatus)
            if (isQuoteBlock(block)) quotes.add(block.lineStatus)
          }
        }
      }
    }
    return { statuses: STATUSES.filter((s) => seen.has(s)), quotes, hasOtherReinsurers }
  }, [risk])

  return (
    <section className="rt-risk">
      {titled && <h3 className="rt-risk-title">{risk.insuredName ?? risk.policyRef ?? risk.riskId}</h3>}
      {risk.towers.length === 0 ? (
        <p className="rt-empty">No layers to draw.</p>
      ) : (
        <div className="rt-grid">
          {risk.towers.map((tower) => (
            <figure key={tower.towerNo} className="rt-tower">
              <figcaption>{tower.towerName}</figcaption>
              <TowerChart
                tower={tower}
                fills={fills}
                selectedKey={selectedKey}
                onSelect={onSelect}
                loss={loss}
                scale={scale}
                height={height}
              />
            </figure>
          ))}
        </div>
      )}
      {legend && risk.towers.length > 0 && (
        <div className="rt-legend">
          <span>
            <span className="rt-swatch is-retention" /> kept by the cedant
          </span>
          {hasOtherReinsurers && (
            <span><span className="rt-swatch" /> {OTHER_REINSURERS}</span>
          )}
          {statuses.map((s) => (
            <span key={s}>
              <span className={`rt-swatch ${statusClass(s)}${quotes.has(s) ? ' rt-quote' : ''}`} /> {s}
            </span>
          ))}
          <span className="rt-legend-note">Width is share of the risk, height is amount.</span>
        </div>
      )}
    </section>
  )
}

/** Draws every tower in a towers response, one section per risk. */
export default function Towers({ data, riskId, selectedKey, onSelect, legend = true, className, ...chart }: TowersProps) {
  const [own, setOwn] = useState<{ riskId: string; key: string } | null>(null)
  const risks = riskId === undefined ? data.risks : data.risks.filter((r) => r.riskId === riskId)

  return (
    <div className={className ? `rt-towers ${className}` : 'rt-towers'}>
      {risks.length === 0 && <p className="rt-empty">No towers to draw.</p>}
      {risks.map((risk) => (
        <RiskSection
          key={risk.riskId}
          risk={risk}
          titled={risks.length > 1}
          selectedKey={selectedKey !== undefined ? selectedKey : own?.riskId === risk.riskId ? own.key : null}
          onSelect={(key) => {
            setOwn(key === null ? null : { riskId: risk.riskId, key })
            onSelect?.(key, risk)
          }}
          legend={legend}
          {...chart}
        />
      ))}
    </div>
  )
}
