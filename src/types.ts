/** The computed towers response: what the backend's tower engine returns. */

export type VerticalBlock = {
  vBlockNo: number
  layerRef: string | null
  layerName: string | null
  layerType: string | null
  contractRef: string | null
  sharedRiskCount: number
  lowerLimit: number
  upperLimit: number | null
  layerAmount: number
  share: number
  normalizedShare: number
  participationShare: number | null
  retainedShare: number | null
  order: number | null
  cededShare: number
  currency: string | null
  accumulateBasis: string | null
  protection: string | null
  aad: number | null
  reinsurer: string | null
  lineStatus: string | null
  isRetention: boolean
  color: string
  colorKey: string
  colorOverride: string | null
  label: string
  /** [left, right] as fractions of the tower's width. */
  xSpan: [number, number]
  ySpan: [number, number]
  isPrimary: boolean
  overlapId: string | null
}

export type HorizontalBand = {
  bandRange: string
  hBandNo: number
  hyFrom: number
  hyTo: number | null
  isUnlimited: boolean
  verticalBlocks: VerticalBlock[]
}

export type Tower = {
  towerNo: number
  towerName: string
  bands: HorizontalBand[]
  unlimitedBands: HorizontalBand[]
}

export type RiskTowers = {
  riskId: string
  policyRef?: string | null
  insuredName?: string | null
  towers: Tower[]
}

export type Issue = { code: string; message: string; path?: string }

export type TowersResponse = {
  risks: RiskTowers[]
  unlimitedDisplayHeight: number
  warnings: Issue[]
  limitations: Issue[]
}

/** The fields of a layer or block that its terms line is written from. */
export type LayerTerms = {
  layerType: string | null
  lowerLimit: number
  upperLimit?: number | null
  aad?: number | null
  accumulateBasis?: string | null
}
