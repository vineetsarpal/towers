// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Towers from './Towers.js'
import type { TowersResponse, VerticalBlock } from './types.js'

afterEach(cleanup)

const block = (over: Partial<VerticalBlock>): VerticalBlock => ({
  vBlockNo: 0, sharedRiskCount: 1, color: '#ccc', layerRef: null, layerName: 'L', layerType: 'XOL', contractRef: null, lowerLimit: 0,
  upperLimit: 100, layerAmount: 100, share: 100, normalizedShare: 100, participationShare: null,
  retainedShare: null, order: 100, cededShare: 100, currency: 'USD', accumulateBasis: 'CLM',
  protection: 'ALL', aad: null, reinsurer: null, lineStatus: null, isRetention: false,
  colorKey: 'L', colorOverride: null, label: 'L', xSpan: [0, 1], ySpan: [0, 1], isPrimary: true,
  overlapId: null, ...over,
})

const risk = (riskId: string, insuredName: string) => ({
  riskId,
  insuredName,
  towers: [
    {
      towerNo: 1,
      towerName: 'Per claim',
      unlimitedBands: [],
      bands: [
        { bandRange: '', hBandNo: 1, hyFrom: 0, hyTo: 250, isUnlimited: false, verticalBlocks: [block({ layerName: 'Retention', isRetention: true, colorKey: 'retention' })] },
        { bandRange: '', hBandNo: 2, hyFrom: 250, hyTo: 400, isUnlimited: false, verticalBlocks: [block({ layerName: 'Xol-Ly1', layerRef: 'L1', lowerLimit: 250, upperLimit: 400, colorKey: 'L1' })] },
      ],
    },
  ],
})

const data: TowersResponse = { warnings: [], limitations: [], unlimitedDisplayHeight: 1_000_000, risks: [risk('r1', 'Acme'), risk('r2', 'Globex')] }

describe('Towers', () => {
  it('draws every risk in the response, titled by insured', () => {
    render(<Towers data={data} />)
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('Globex')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Xol-Ly1/ })).toHaveLength(2)
  })

  it('draws one risk, without a title, when riskId is given', () => {
    render(<Towers data={data} riskId="r2" />)
    expect(screen.queryByText('Globex')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Xol-Ly1/ })).toHaveLength(1)
  })

  it('keeps its own selection, scoped to the risk that was clicked', () => {
    const onSelect = vi.fn()
    render(<Towers data={data} onSelect={onSelect} />)
    const [first, second] = screen.getAllByRole('button', { name: /Xol-Ly1/ })

    fireEvent.click(first)
    expect(onSelect).toHaveBeenCalledWith('L1', data.risks[0])
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(second.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(first)
    expect(onSelect).toHaveBeenLastCalledWith(null, data.risks[0])
    expect(first.getAttribute('aria-pressed')).toBe('false')
  })

  it('follows selectedKey when the host controls it', () => {
    render(<Towers data={data} riskId="r1" selectedKey="L1" />)
    const layer = screen.getByRole('button', { name: /Xol-Ly1/ })
    fireEvent.click(layer)
    expect(layer.getAttribute('aria-pressed')).toBe('true')
  })

  it('flags a loss on the tower', () => {
    const { container } = render(<Towers data={data} riskId="r1" loss={300} />)
    expect(screen.getByText('Loss 300')).toBeTruthy()
    expect(container.querySelector('.rt-loss')).toBeTruthy()
  })

  it('reports how far a loss extends above the tower', () => {
    render(<Towers data={data} riskId="r1" loss={550} />)
    expect(screen.getByText('Loss 550, 150 above the tower')).toBeTruthy()
  })
})

describe('Reinsurer viewpoint', () => {
  it.each(['quoted', 'indication'])('labels other reinsurers and styles a %s Line', (lineStatus) => {
    const reinsurerRisk = risk('reinsurer', 'Acme')
    reinsurerRisk.towers[0].bands[1].verticalBlocks = [
      block({ blockKind: 'line', layerRef: 'L1', reinsurer: 'R', lineStatus, share: 16, xSpan: [0, 0.16] }),
      block({ blockKind: 'otherReinsurers', layerRef: 'L1', share: 64, xSpan: [0.16, 0.8] }),
      block({ blockKind: 'cedant', contractRef: 'C1', layerRef: 'L1', isRetention: true, share: 20, xSpan: [0.8, 1] }),
    ]

    const { container } = render(<Towers data={{ ...data, risks: [reinsurerRisk] }} />)
    const quote = screen.getByRole('button', { name: /R\s*16%/ })
    expect(quote.classList.contains('rt-quote')).toBe(true)
    expect(quote.classList.contains(`rt-status-${lineStatus}`)).toBe(true)
    expect(quote.getAttribute('title')).toContain(lineStatus)
    expect(screen.getByRole('button', { name: /Other reinsurers\s*64%/ })).toBeTruthy()
    expect(screen.getByText('Retention 20%')).toBeTruthy()
    expect(container.querySelector('.rt-legend')?.textContent).toContain('Other reinsurers')
    expect(container.querySelector(`.rt-legend .rt-status-${lineStatus}.rt-quote`)).toBeTruthy()

    fireEvent.click(quote)
    expect(quote.classList.contains('rt-quote')).toBe(true)
    expect(quote.classList.contains('is-selected')).toBe(true)
  })

  it('selects a Layer drawn entirely as cedant', () => {
    const reinsurerRisk = risk('reinsurer', 'Acme')
    reinsurerRisk.towers[0].bands[0].verticalBlocks[0].blockKind = 'cedant'
    reinsurerRisk.towers[0].bands[1].verticalBlocks = [
      block({ blockKind: 'cedant', contractRef: 'C1', layerRef: 'L1', layerName: 'Upper XL', order: null, isRetention: true }),
    ]
    const response = { ...data, risks: [reinsurerRisk] }
    const onSelect = vi.fn()
    const { rerender } = render(<Towers data={response} selectedKey={null} onSelect={onSelect} />)
    const cedant = screen.getByRole('button', { name: 'Upper XL, Retention' })
    expect(cedant.classList.contains('is-retention')).toBe(true)
    expect(cedant.getAttribute('title')).toContain('Upper XL')

    fireEvent.click(cedant)
    expect(onSelect).toHaveBeenCalledWith('L1', reinsurerRisk)

    rerender(<Towers data={response} selectedKey="L1" onSelect={onSelect} />)
    expect(cedant.classList.contains('is-selected')).toBe(true)
    expect(cedant.getAttribute('aria-pressed')).toBe('true')
  })

  it('selects the same key from the cedant share and the Line', () => {
    const reinsurerRisk = risk('reinsurer', 'Acme')
    const bands = reinsurerRisk.towers[0].bands
    bands[0].verticalBlocks = [block({ layerRef: 'L0', layerName: 'Lower XL' })]
    bands[1].verticalBlocks = [
      block({ blockKind: 'line', contractRef: 'C1', layerRef: 'L1', reinsurer: 'R', share: 80, xSpan: [0, 0.8] }),
      block({ blockKind: 'cedant', contractRef: 'C1', layerRef: 'L1', isRetention: true, share: 20, xSpan: [0.8, 1] }),
    ]
    const onSelect = vi.fn()
    render(<Towers data={{ ...data, risks: [reinsurerRisk] }} onSelect={onSelect} />)
    const line = screen.getByRole('button', { name: /R\s*80%/ })
    const cedant = screen.getByRole('button', { name: 'L, Retention 20%' })

    fireEvent.click(cedant)
    expect(onSelect).toHaveBeenLastCalledWith('L1', reinsurerRisk)
    expect(line.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /Lower XL/ }))
    expect(cedant.classList.contains('is-dimmed')).toBe(true)

    fireEvent.click(line)
    expect(onSelect).toHaveBeenLastCalledWith('L1', reinsurerRisk)
    expect(cedant.getAttribute('aria-pressed')).toBe('true')
  })

  it.each(['cedant', undefined] as const)('renders a retention filler with blockKind %s as a div', (blockKind) => {
    const retainedRisk = risk('retained', 'Acme')
    retainedRisk.towers[0].bands[0].verticalBlocks[0].blockKind = blockKind
    render(<Towers data={{ ...data, risks: [retainedRisk] }} selectedKey="L1" />)

    const filler = screen.getByTitle('Retention')
    expect(filler.tagName).toBe('DIV')
    expect(filler.className).toBe('rt-shape is-retention')
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
