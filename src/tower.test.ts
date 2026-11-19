import { describe, expect, it } from 'vitest'
import type { Tower, VerticalBlock } from './types.js'
import { applyLoss, blockLines, formatAmount, layerCaptions, towerShapes } from './tower.js'

const block = (over: Partial<VerticalBlock>): VerticalBlock => ({
  vBlockNo: 0, sharedRiskCount: 1, color: '#ccc', layerRef: null, layerName: 'L', layerType: 'XOL', contractRef: null, lowerLimit: 0,
  upperLimit: 100, layerAmount: 100, share: 100, normalizedShare: 100, participationShare: null,
  retainedShare: null, order: 100, cededShare: 100, currency: 'USD', accumulateBasis: 'CLM',
  protection: 'ALL', aad: null, reinsurer: null, lineStatus: null, isRetention: false,
  colorKey: 'L', colorOverride: null, label: 'L', xSpan: [0, 1], ySpan: [0, 1], isPrimary: true,
  overlapId: null, ...over,
})
const retention = (xSpan: [number, number]) =>
  block({ layerName: 'Retention', layerType: null, isRetention: true, colorKey: 'retention', xSpan })
const band = (hyFrom: number, hyTo: number, verticalBlocks: VerticalBlock[]) => ({
  bandRange: '', hBandNo: 0, hyFrom, hyTo, isUnlimited: false, verticalBlocks,
})

// Story example 3: quota share (20% retained) under per-claim XOL placed 60/40, then a full layer.
const qs = block({ layerName: 'Cont-QS1', layerRef: 'QS', layerType: 'QSR', participationShare: 100, retainedShare: 20, cededShare: 80, xSpan: [0, 0.8] })
const ly1 = block({ layerName: 'Xol-Ly1', layerRef: 'L1', lowerLimit: 250, upperLimit: 400, layerAmount: 150, order: 60, cededShare: 60, xSpan: [0, 0.6] })
const ly2 = block({ layerName: 'Xol-Ly2', layerRef: 'L2', lowerLimit: 250, upperLimit: 400, layerAmount: 150, order: 40, cededShare: 40, xSpan: [0.6, 1] })
const ly3 = block({ layerName: 'Xol-Ly3', layerRef: 'L3', lowerLimit: 400, upperLimit: 500, layerAmount: 100, xSpan: [0, 1] })
const example3: Tower = {
  towerNo: 1, towerName: 'Tower', unlimitedBands: [],
  bands: [
    band(0, 100, [qs, retention([0.8, 1])]),
    band(100, 250, [qs, retention([0.8, 1])]),
    band(250, 400, [ly1, ly2]),
    band(400, 500, [ly3]),
  ],
}

describe('towerShapes', () => {
  it('joins a layer cut across bands into one rectangle', () => {
    const shapes = towerShapes(example3)

    expect(shapes.map((s) => [s.block.layerName, s.from, s.to, s.x0, s.x1])).toEqual([
      ['Cont-QS1', 0, 250, 0, 0.8],
      ['Retention', 0, 250, 0.8, 1],
      ['Xol-Ly1', 250, 400, 0, 0.6],
      ['Xol-Ly2', 250, 400, 0.6, 1],
      ['Xol-Ly3', 400, 500, 0, 1],
    ])
  })

  it('runs an unlimited layer the full height, marked as having no top', () => {
    const tower: Tower = {
      towerNo: 1, towerName: 'Tower', bands: [],
      unlimitedBands: [{ bandRange: '', hBandNo: 1, hyFrom: 0, hyTo: null, isUnlimited: true, verticalBlocks: [qs, retention([0.8, 1])] }],
    }

    expect(towerShapes(tower).map((s) => [s.block.layerName, s.from, s.to])).toEqual([
      ['Cont-QS1', 0, null],
      ['Retention', 0, null],
    ])
  })

  it('leaves out blocks hidden behind another in the same slot', () => {
    const tower: Tower = { ...example3, bands: [band(0, 100, [ly3, block({ layerName: 'Hidden', isPrimary: false })])] }

    expect(towerShapes(tower).map((s) => s.block.layerName)).toEqual(['Xol-Ly3'])
  })
})

describe('layerCaptions', () => {
  it('names a layer once across the reinsurer lines that make it up', () => {
    const lines = [
      block({ layerName: 'Cat XL 2', layerRef: 'C2', lowerLimit: 20, upperLimit: 50, accumulateBasis: 'EVT', reinsurer: 'Harbour Re', xSpan: [0, 0.35] }),
      block({ layerName: 'Cat XL 2', layerRef: 'C2', lowerLimit: 20, upperLimit: 50, accumulateBasis: 'EVT', reinsurer: 'Alpine Rück', xSpan: [0.35, 0.85] }),
    ]
    const tower: Tower = { towerNo: 1, towerName: 'T', unlimitedBands: [], bands: [band(20, 50, [...lines, retention([0.85, 1])])] }

    expect(layerCaptions(towerShapes(tower))).toEqual([
      { key: 'C2', text: 'Cat XL 2, 30 xs 20 per event', x0: 0, x1: 0.85, to: 50 },
    ])
  })

  it('adds nothing for a layer drawn as a single block', () => {
    expect(layerCaptions(towerShapes(example3))).toEqual([])
  })
})

describe('applyLoss', () => {
  it('splits a loss between the layers it reaches and the cedant', () => {
    const result = applyLoss(example3, 300)

    expect(result.recoveries.map((r) => [r.name, r.amount])).toEqual([
      ['Cont-QS1', 200],
      ['Xol-Ly1', 30],
      ['Xol-Ly2', 20],
    ])
    expect(result.recovered).toBe(250)
    expect(result.retained).toBe(50)
  })

  it('keeps everything above the top of the tower with the cedant', () => {
    const result = applyLoss(example3, 800)

    expect(result.recovered).toBe(200 + 90 + 60 + 100)
    expect(result.retained).toBe(350)
  })

  it('lets an unlimited quota share follow the loss all the way up', () => {
    const tower: Tower = {
      towerNo: 1, towerName: 'Tower', bands: [],
      unlimitedBands: [{ bandRange: '', hBandNo: 1, hyFrom: 0, hyTo: null, isUnlimited: true, verticalBlocks: [qs, retention([0.8, 1])] }],
    }

    expect(applyLoss(tower, 1000)).toMatchObject({ recovered: 800, retained: 200 })
  })

  it('totals the lines of one layer under the layer', () => {
    const lines = [
      block({ layerName: 'Cat XL', layerRef: 'C1', reinsurer: 'Meridian Re', xSpan: [0, 0.25] }),
      block({ layerName: 'Cat XL', layerRef: 'C1', reinsurer: 'Harbour Re', xSpan: [0.25, 1] }),
    ]
    const result = applyLoss({ towerNo: 1, towerName: 'T', unlimitedBands: [], bands: [band(0, 100, lines)] }, 40)

    expect(result.recoveries).toEqual([{ key: 'C1', name: 'Cat XL', amount: 40 }])
  })
})

describe('blockLines', () => {
  it('describes an excess layer the way the slip does', () => {
    expect(blockLines(block({ ...ly1, accumulateBasis: 'EVT' }))).toEqual(['Xol-Ly1 (L1)', '150 xs 250 per event', 'Placed at 60%'])
    expect(blockLines(block({ ...ly3 }))).toEqual(['Xol-Ly3 (L3)', '100 xs 400 per claim'])
  })

  it('adds the annual aggregate deductible to the terms', () => {
    expect(blockLines(block({ ...ly1, aad: 80 }))[1]).toBe('150 xs 250 xs 80 per claim')
  })

  it('shows how much of a quota share is placed', () => {
    expect(blockLines(qs)).toEqual(['Cont-QS1 (QS)', 'Placed at 80%'])
    expect(blockLines(block({ ...qs, participationShare: 50, cededShare: 90 }))).toEqual(['Cont-QS1 (QS)', '50%', 'Placed at 90%'])
  })

  it('gives surplus its limits and facultative its share', () => {
    expect(blockLines(block({ layerName: 'Cont-SP1', layerRef: 'S1', layerType: 'SPL', lowerLimit: 400, upperLimit: 550, participationShare: 15 }))).toEqual([
      'Cont-SP1 (S1)', 'limits 400 to 550', '15%',
    ])
    expect(blockLines(block({ layerName: 'Cont-Fac1', layerRef: 'F1', layerType: 'FAC', upperLimit: null, participationShare: 20, cededShare: 20 }))).toEqual([
      'Cont-Fac1 (F1)', '20%',
    ])
  })

  it('names the reinsurer on a line of the panel', () => {
    expect(blockLines(block({ ...ly3, reinsurer: 'Meridian Re', share: 25 }))).toEqual(['Meridian Re', '25%'])
  })

  it('states the retained share', () => {
    expect(blockLines(block({ ...retention([0.76, 1]), share: 24 }))).toEqual(['Retention 24%'])
    expect(blockLines(block({ ...retention([0, 1]), share: 100 }))).toEqual(['Retention'])
  })
})

describe('formatAmount', () => {
  it('shortens large amounts and keeps small ones exact', () => {
    expect([250, 1500, 10_000, 2_500_000, 100_000_000, 1_250_000_000].map(formatAmount)).toEqual([
      '250', '1.5K', '10K', '2.5M', '100M', '1.25B',
    ])
  })
})
