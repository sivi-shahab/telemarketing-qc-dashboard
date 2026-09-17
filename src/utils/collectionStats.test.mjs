// Jalankan: node --test src/utils/collectionStats.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmtInt, fmtPct, dailyChartData, CHART_SUCCESS_COLOR, CHART_DANGER_COLOR } from './collectionStats.js'

test('fmtInt memformat ribuan ala Indonesia dan null/undefined -> 0', () => {
  assert.equal(fmtInt(1234), '1.234')
  assert.equal(fmtInt(0), '0')
  assert.equal(fmtInt(null), '0')
  assert.equal(fmtInt(undefined), '0')
})

test('fmtPct: null tampil sebagai "—", bukan "0%"', () => {
  assert.equal(fmtPct(null), '—')
  assert.equal(fmtPct(undefined), '—')
  assert.equal(fmtPct(0), '0%')
  assert.equal(fmtPct(87.5), '87.5%')
})

test('dailyChartData: bentuk labels/datasets PASS-FAIL bertumpuk', () => {
  const data = dailyChartData([
    { date: '2026-09-01', pass: 3, fail: 1 },
    { date: '2026-09-02', pass: 0, fail: 2 },
  ])
  assert.deepEqual(data.labels, ['2026-09-01', '2026-09-02'])
  assert.equal(data.datasets.length, 2)
  assert.equal(data.datasets[0].label, 'PASS')
  assert.deepEqual(data.datasets[0].data, [3, 0])
  assert.equal(data.datasets[0].backgroundColor, CHART_SUCCESS_COLOR)
  assert.equal(data.datasets[0].stack, 'verdict')
  assert.equal(data.datasets[1].label, 'FAIL')
  assert.deepEqual(data.datasets[1].data, [1, 2])
  assert.equal(data.datasets[1].backgroundColor, CHART_DANGER_COLOR)
})

test('dailyChartData: input kosong/tidak valid -> bentuk kosong, tidak melempar', () => {
  assert.deepEqual(dailyChartData([]).labels, [])
  assert.deepEqual(dailyChartData(undefined).labels, [])
  assert.deepEqual(dailyChartData(null).labels, [])
})
