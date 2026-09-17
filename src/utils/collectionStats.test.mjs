// Jalankan: node --test src/utils/collectionStats.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fmtInt, fmtPct, dailyChartData, CHART_SUCCESS_COLOR, CHART_DANGER_COLOR,
  DEFAULT_RANGE_DAYS, defaultDateRange, orderedDateRange, statsErrorMessage, shouldPollTick,
} from './collectionStats.js'

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

test('defaultDateRange: 30 hari terakhir menurut tanggal WIB (hari ini ikut)', () => {
  assert.equal(DEFAULT_RANGE_DAYS, 30)
  // 17 Sep 2026 20:00 UTC = 18 Sep 2026 03:00 WIB
  assert.deepEqual(defaultDateRange(new Date('2026-09-17T20:00:00Z')), { start: '2026-08-20', end: '2026-09-18' })
  // 17 Sep 2026 10:00 UTC = 17 Sep 17:00 WIB
  assert.deepEqual(defaultDateRange(new Date('2026-09-17T10:00:00Z')), { start: '2026-08-19', end: '2026-09-17' })
  // lintas tahun
  assert.deepEqual(defaultDateRange(new Date('2026-01-10T00:00:00Z')), { start: '2025-12-12', end: '2026-01-10' })
})

test('orderedDateRange: tanggal awal > akhir ditukar; kosong dibiarkan', () => {
  assert.deepEqual(orderedDateRange('2026-09-10', '2026-09-01'), { start: '2026-09-01', end: '2026-09-10' })
  assert.deepEqual(orderedDateRange('2026-09-01', '2026-09-10'), { start: '2026-09-01', end: '2026-09-10' })
  assert.deepEqual(orderedDateRange('', '2026-09-10'), { start: '', end: '2026-09-10' })
  assert.deepEqual(orderedDateRange('2026-09-10', ''), { start: '2026-09-10', end: '' })
})

test('statsErrorMessage: detail API dipakai hanya bila string', () => {
  const fallback = 'Gagal memuat statistik Collection.'
  assert.equal(statsErrorMessage({ response: { data: { detail: 'Akses ditolak' } } }), 'Akses ditolak')
  assert.equal(statsErrorMessage({ response: { data: { detail: [{ msg: 'x' }] } } }), fallback)
  assert.equal(statsErrorMessage({ response: { data: { detail: '  ' } } }), fallback)
  assert.equal(statsErrorMessage({ response: { data: {} } }), fallback)
  assert.equal(statsErrorMessage(new Error('Network Error')), fallback)
  assert.equal(statsErrorMessage(undefined), fallback)
})

test('shouldPollTick: hanya saat tab terlihat dan tidak ada request berjalan', () => {
  assert.equal(shouldPollTick({ visibilityState: 'visible', inFlight: false }), true)
  assert.equal(shouldPollTick({ visibilityState: 'hidden', inFlight: false }), false)
  assert.equal(shouldPollTick({ visibilityState: 'visible', inFlight: true }), false)
  assert.equal(shouldPollTick({ visibilityState: 'hidden', inFlight: true }), false)
})
