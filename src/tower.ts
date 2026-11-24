import type { LayerTerms, Tower, VerticalBlock } from './types.js'

// ─── Formatting ───────────────────────────────────────────────────────────────

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)))

/** 2500000 → "2.5M". Amounts under a thousand stay exact. */
export function formatAmount(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${trim(n / 1e9, 2)}B`
  if (abs >= 1e6) return `${trim(n / 1e6, 2)}M`
  if (abs >= 1e3) return `${trim(n / 1e3, 1)}K`
  return trim(n, 2)
}

export const formatPercent = (n: number) => `${trim(n, 2)}%`

export const LAYER_TYPE_NAMES: Record<string, string> = {
  QSR: 'Quota share',
  SPL: 'Surplus',
  FAC: 'Facultative',
  XOL: 'Excess of loss',
}

export const BASIS_NAMES: Record<string, string> = {
  EVT: 'per event',
  CLM: 'per claim',
  RSK: 'per risk',
  AGR: 'aggregate',
}

export const PROTECTION_NAMES: Record<string, string> = {
  ALL: 'Whole risk',
  FGR: 'From gross',
  RET: 'Retention only',
}

/** "150 xs 250 xs 80 per event": limit, attachment, annual aggregate deductible, basis. */
export function layerTerms(l: LayerTerms): string | null {
  if (l.layerType === 'SPL' && l.upperLimit != null) {
    return `limits ${formatAmount(l.lowerLimit)} to ${formatAmount(l.upperLimit)}`
  }
  if (l.layerType !== 'XOL') return null
  const limit = l.upperLimit == null ? 'Unlimited' : formatAmount(l.upperLimit - l.lowerLimit)
  const aad = l.aad ? ` xs ${formatAmount(l.aad)}` : ''
  const basis = l.accumulateBasis ? ` ${BASIS_NAMES[l.accumulateBasis] ?? l.accumulateBasis}` : ''
  return `${limit} xs ${formatAmount(l.lowerLimit)}${aad}${basis}`
}

export const OTHER_REINSURERS = 'Other reinsurers'

export function reinsurerLabel(block: VerticalBlock): string | null {
  return block.blockKind === 'otherReinsurers' ? OTHER_REINSURERS : block.reinsurer
}

export function isQuoteBlock(block: VerticalBlock): boolean {
  return block.blockKind === 'line' &&
    (block.lineStatus === 'indication' || block.lineStatus === 'quoted')
}

/** Identifies a reinsurer-viewpoint cedant block that belongs to a Layer, excluding retention fillers. */
export function isLayerCedant(block: VerticalBlock): boolean {
  return block.blockKind === 'cedant' && block.contractRef != null
}

/** The lines written inside a block, most important first. */
export function blockLines(b: VerticalBlock): string[] {
  if (b.isRetention) return [b.share < 99.995 ? `Retention ${formatPercent(b.share)}` : 'Retention']
  const reinsurer = reinsurerLabel(b)
  if (reinsurer) {
    const lines = [reinsurer, formatPercent(b.share)]
    if (isQuoteBlock(b) && b.lineStatus) lines.push(b.lineStatus)
    return lines
  }

  const lines = [b.layerRef ? `${b.layerName} (${b.layerRef})` : (b.layerName ?? 'Layer')]
  const terms = layerTerms(b)
  if (terms) lines.push(terms)

  const share = b.participationShare
  if (b.layerType === 'XOL') {
    if (b.cededShare < 100) lines.push(`Placed at ${formatPercent(b.cededShare)}`)
  } else {
    if (share != null && share !== 100) lines.push(formatPercent(share))
    if (b.layerType === 'QSR' || (b.order != null && b.order < 100)) {
      lines.push(`Placed at ${formatPercent(b.cededShare)}`)
    }
  }
  return lines
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

export const layerKey = (l: { layerRef?: string | null; layerName?: string | null }) =>
  l.layerRef || l.layerName || 'unknown'

export type Shape = {
  id: string
  block: VerticalBlock
  from: number
  /** null: no upper limit, drawn to the top of the tower. */
  to: number | null
  x0: number
  x1: number
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9

/**
 * The rectangles to draw. The engine cuts every layer at each band boundary;
 * this joins the pieces of one layer back together.
 */
export function towerShapes(tower: Tower): Shape[] {
  const shapes: Shape[] = []
  const idOf = (b: VerticalBlock) => {
    if (isLayerCedant(b)) return `cedant|${b.contractRef}|${layerKey(b)}`
    if (b.isRetention) return 'retention'
    const key = `${layerKey(b)}|${b.reinsurer ?? ''}`
    return b.blockKind ? `${key}|${b.blockKind}|${b.lineStatus ?? ''}` : key
  }

  for (const band of [...tower.unlimitedBands, ...tower.bands]) {
    for (const block of band.verticalBlocks) {
      if (!block.isPrimary) continue
      const [x0, x1] = block.xSpan
      const kind = idOf(block)
      const below = band.isUnlimited
        ? undefined
        : shapes.find(
            (s) => s.to === band.hyFrom && idOf(s.block) === kind && same(s.x0, x0) && same(s.x1, x1),
          )
      if (below) below.to = band.hyTo
      else {
        shapes.push({
          id: `${kind}|${band.isUnlimited ? 'u' : band.hyFrom}|${x0}`,
          block,
          from: band.hyFrom,
          to: band.isUnlimited ? null : band.hyTo,
          x0,
          x1,
        })
      }
    }
  }
  return shapes
}

export type Caption = { key: string; text: string; x0: number; x1: number; to: number | null }

/** Captions sit above a Layer's reinsurer blocks or above its cedant blocks if it has no reinsurer blocks. */
export function layerCaptions(shapes: Shape[]): Caption[] {
  const captions = new Map<string, Caption>()
  const cedantCaptions = new Map<string, Caption>()
  for (const { block, x0, x1, to } of shapes) {
    const target = reinsurerLabel(block) ? captions : isLayerCedant(block) ? cedantCaptions : null
    if (!target) continue
    const key = layerKey(block)
    const caption = target.get(key)
    if (caption) {
      caption.x0 = Math.min(caption.x0, x0)
      caption.x1 = Math.max(caption.x1, x1)
    } else {
      const terms = layerTerms(block)
      target.set(key, { key, text: terms ? `${block.layerName}, ${terms}` : (block.layerName ?? key), x0, x1, to })
    }
  }
  for (const [key, caption] of cedantCaptions) {
    if (!captions.has(key)) captions.set(key, caption)
  }
  return [...captions.values()]
}

/** The highest finite amount drawn, or 0 when the tower has only unlimited layers. */
export const towerTop = (tower: Tower) => Math.max(0, ...tower.bands.map((b) => b.hyTo ?? 0))

// ─── Colour ───────────────────────────────────────────────────────────────────

/** Soft fills that keep dark text readable; neighbours in the list contrast. */
const FILLS = [
  '#cfe0f5', '#f3cfe8', '#c6ecc9', '#fbdcc4', '#fbf3b4',
  '#cdeaea', '#ddd3f3', '#f6cfd0', '#dfeebc', '#d4dcec',
]

/** Gives each colour key a fill, in the order the keys first appear. */
export function assignFills(towers: Tower[]): Map<string, string> {
  const fills = new Map<string, string>()
  for (const tower of towers) {
    for (const band of [...tower.unlimitedBands, ...tower.bands]) {
      for (const block of band.verticalBlocks) {
        if (block.isRetention || fills.has(block.colorKey)) continue
        fills.set(block.colorKey, block.colorOverride ?? FILLS[fills.size % FILLS.length])
      }
    }
  }
  return fills
}
