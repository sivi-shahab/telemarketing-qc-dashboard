// Jalankan: node --test src/utils/collectionStats.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fmtInt, fmtPct, bucketOf, defaultWindow, bucketDaily, passFailChartData, wibToday,
  orderedDateRange, statsErrorMessage, shouldPollTick,
} from './collectionStats.js'
import { AI_COLORS, AI_LABEL_COLORS } from './aiStatusChart.js'

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

test('bucketOf: label mengikuti Stats Cashline per granularitas', () => {
  assert.deepEqual(bucketOf('2026-09-05', 'daily'), { key: '2026-09-05', label: '5 Sep' })
  // Minggu DALAM BULAN (1-7 = W1, 29-31 = W5), label bulan penuh bahasa Inggris.
  assert.deepEqual(bucketOf('2026-09-08', 'weekly'), { key: '2026-09-W2', label: 'W2 September 2026' })
  assert.deepEqual(bucketOf('2026-08-31', 'weekly'), { key: '2026-08-W5', label: 'W5 August 2026' })
  assert.deepEqual(bucketOf('2026-09-18', 'monthly'), { key: '2026-09', label: 'Sep 2026' })
  assert.deepEqual(bucketOf('2026-09-18', 'quarterly'), { key: '2026-Q3', label: 'Q3 2026' })
  assert.deepEqual(bucketOf('2026-09-18', 'semester'), { key: '2026-S2', label: 'S2 2026' })
  assert.deepEqual(bucketOf('2026-09-18', 'yearly'), { key: '2026', label: '2026' })
})

test('defaultWindow: lebar jendela sama dengan Cashline (4 bucket; harian 7 hari)', () => {
  assert.deepEqual(defaultWindow('daily', '2026-09-18'), { start: '2026-09-12', end: '2026-09-18' })
  // 4 bucket minggu-dalam-bulan terakhir: W3 Sep (15-21) mundur 3 -> W5 Agu (29-31).
  assert.deepEqual(defaultWindow('weekly', '2026-09-18'), { start: '2026-08-29', end: '2026-09-18' })
  assert.deepEqual(defaultWindow('monthly', '2026-09-18'), { start: '2026-06-01', end: '2026-09-18' })
  assert.deepEqual(defaultWindow('quarterly', '2026-09-18'), { start: '2025-10-01', end: '2026-09-18' })
  assert.deepEqual(defaultWindow('semester', '2026-09-18'), { start: '2025-01-01', end: '2026-09-18' })
  assert.deepEqual(defaultWindow('yearly', '2026-09-18'), { start: '2023-01-01', end: '2026-09-18' })
})

test('defaultWindow: offset menggeser jendela utuh ke belakang (angka dari Python Cashline)', () => {
  // Ekspektasi dihitung dengan _shift_anchor + _default_timeseries_range di
  // core/compliance/stats_aggregate.py, supaya kedua grafik tidak menyimpang.
  assert.deepEqual(defaultWindow('daily', '2026-09-18', -1), { start: '2026-09-05', end: '2026-09-11' })
  // Mingguan melangkah per BUCKET (bucket W5 bisa 1-3 hari), bukan per 7 hari.
  assert.deepEqual(defaultWindow('weekly', '2026-09-18', -1), { start: '2026-08-01', end: '2026-08-22' })
  assert.deepEqual(defaultWindow('monthly', '2026-09-18', -1), { start: '2026-02-01', end: '2026-05-18' })
  assert.deepEqual(defaultWindow('quarterly', '2026-09-18', -1), { start: '2024-10-01', end: '2025-09-18' })
  assert.deepEqual(defaultWindow('semester', '2026-09-18', -1), { start: '2023-01-01', end: '2024-09-18' })
  assert.deepEqual(defaultWindow('yearly', '2026-09-18', -1), { start: '2019-01-01', end: '2022-09-18' })
})

test('bucketDaily: menjumlah per bucket dan mempertahankan bucket kosong', () => {
  const daily = [
    { date: '2026-09-01', pass: 2, fail: 1 },
    { date: '2026-09-03', pass: 1, fail: 0 },
    { date: '2026-09-09', pass: 0, fail: 4 },
    { date: '2026-10-01', pass: 9, fail: 9 }, // di luar rentang -> diabaikan
  ]
  assert.deepEqual(bucketDaily(daily, 'weekly', '2026-09-01', '2026-09-20'), [
    { key: '2026-09-W1', label: 'W1 September 2026', pass: 3, fail: 1 },
    { key: '2026-09-W2', label: 'W2 September 2026', pass: 0, fail: 4 },
    { key: '2026-09-W3', label: 'W3 September 2026', pass: 0, fail: 0 },
  ])
  assert.equal(bucketDaily(daily, 'daily', '2026-09-01', '2026-09-03').length, 3)
  assert.deepEqual(bucketDaily(null, 'daily', '2026-09-01', '2026-09-01'),
    [{ key: '2026-09-01', label: '1 Sep', pass: 0, fail: 0 }])
})

test('passFailChartData: 100% bertumpuk, FAIL di dasar, warna & jumlah ikut Cashline', () => {
  const data = passFailChartData([
    { key: 'a', label: '1 Sep', pass: 3, fail: 1 },
    { key: 'b', label: '2 Sep', pass: 0, fail: 0 },
  ])
  assert.deepEqual(data.labels, ['1 Sep', '2 Sep'])
  const [fail, pass] = data.datasets
  assert.equal(fail.label, 'FAIL')
  assert.equal(pass.label, 'PASS')
  assert.deepEqual(fail.data, [25, 0])
  assert.deepEqual(pass.data, [75, 0])
  assert.deepEqual(fail._counts, [1, 0])
  assert.deepEqual(pass._counts, [3, 0])
  assert.equal(pass.backgroundColor, AI_COLORS.approve)
  assert.equal(fail.backgroundColor, AI_COLORS.return)
  assert.equal(fail._labelColor, AI_LABEL_COLORS.return)
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

test('wibToday: tanggal kalender WIB, bukan UTC', () => {
  // 18 Sep 2026 20:00 UTC = 19 Sep 2026 03:00 WIB.
  assert.equal(wibToday(new Date('2026-09-18T20:00:00Z')), '2026-09-19')
  assert.equal(wibToday(new Date('2026-09-18T10:00:00Z')), '2026-09-18')
})
