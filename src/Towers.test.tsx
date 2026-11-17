// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Towers from './Towers.js'
import type { TowersResponse, VerticalBlock } from './types.js'

afterEach(cleanup)

const block = (over: Partial<VerticalBlock>): VerticalBlock => ({
  vBlockNo: 0, layerRefNo: null, layerName: 'L', layerType: 'XOL', contractRef: null, lowerLimit: 0,
  upperLimit: 100, layerAmount: 100, share: 100, normalizedShare: 100, participationShare: null,
  retainedShare: null, placedAt: 100, cededShare: 100, currency: 'USD', accumulateBasis: 'CLM',
  protection: 'ALL', aadLimit: null, reinsurerName: null, reinsurerStatus: null, isRetention: false,
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
        { hBandNo: 1, hyFrom: 0, hyTo: 250, isUnlimited: false, verticalBlocks: [block({ layerName: 'Retention', isRetention: true, colorKey: 'retention' })] },
        { hBandNo: 2, hyFrom: 250, hyTo: 400, isUnlimited: false, verticalBlocks: [block({ layerName: 'Xol-Ly1', layerRefNo: 'L1', lowerLimit: 250, upperLimit: 400, colorKey: 'L1' })] },
      ],
    },
  ],
})

const data: TowersResponse = { risks: [risk('r1', 'Acme'), risk('r2', 'Globex')] }

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
    render(<Towers data={data} riskId="r1" loss={300} />)
    expect(screen.getByText('Loss 300')).toBeTruthy()
  })
})
