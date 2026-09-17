import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveStatsView, STATS_VIEW_KEY } from './statsView.js'

test('satu tampilan dipakai apa adanya', () => {
  assert.equal(resolveStatsView(['collection'], 'cashline'), 'collection')
  assert.equal(resolveStatsView(['cashline'], null), 'cashline')
})

test('dua tampilan: pilihan tersimpan dihormati bila sah', () => {
  assert.equal(resolveStatsView(['cashline', 'collection'], 'collection'), 'collection')
  assert.equal(resolveStatsView(['cashline', 'collection'], 'aneh'), 'cashline')
  assert.equal(resolveStatsView(['cashline', 'collection'], null), 'cashline')
})

test('tanpa tampilan', () => {
  assert.equal(resolveStatsView([], 'cashline'), null)
  assert.equal(resolveStatsView(undefined, null), null)
})

test('kunci localStorage stabil', () => {
  assert.equal(STATS_VIEW_KEY, 'stats.view')
})
