// Jalankan: node --test src/utils/collectionReport.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  verdictTone, verdictLabel, commitmentBadge, scorePercent, formatEvidence,
  scorecardCategories, filterScorecard, humanizeField, SCORECARD_CATEGORIES,
} from './collectionReport.js'

test('verdictTone memetakan kedua kosakata verdict', () => {
  assert.equal(verdictTone('PASS'), 'success')
  assert.equal(verdictTone('SESUAI'), 'success')
  assert.equal(verdictTone('MATCH'), 'success')
  assert.equal(verdictTone('FAIL'), 'danger')
  assert.equal(verdictTone('BELUM_SESUAI'), 'danger')
  assert.equal(verdictTone('MISMATCH'), 'danger')
  assert.equal(verdictTone('TIDAK_TERSEDIA'), 'muted')
  assert.equal(verdictTone('SKIPPED_NULL'), 'muted')
  assert.equal(verdictTone(undefined), 'muted')
})

test('verdictLabel tidak pernah menampilkan kode mentah bergaris bawah', () => {
  assert.equal(verdictLabel('BELUM_SESUAI'), 'Belum Sesuai')
  assert.equal(verdictLabel('TIDAK_TERSEDIA'), 'Tidak Tersedia')
  assert.equal(verdictLabel('SKIPPED_NULL'), 'Tanpa Acuan')
  assert.equal(verdictLabel(null), '—')
})

test('commitmentBadge', () => {
  assert.deepEqual(commitmentBadge('COMMITTED_TO_PAY'), { label: 'Committed to Pay (Setuju Bayar)', tone: 'success' })
  assert.deepEqual(commitmentBadge('PARTIAL_COMMITMENT'), { label: 'Partial Commitment (Komitmen Parsial)', tone: 'info' })
  assert.deepEqual(commitmentBadge('REFUSED'), { label: 'Menolak Membayar (Refused)', tone: 'danger' })
  assert.deepEqual(commitmentBadge('xxx'), { label: 'Tidak Ada Pernyataan Komitmen', tone: 'muted' })
})

test('scorePercent aman terhadap maksimum nol', () => {
  assert.equal(scorePercent({ ai_score_phase_2: 90, maximum_score: 120 }), 75)
  assert.equal(scorePercent({ ai_score_phase_2: 0, maximum_score: 0 }), 0)
})

test('formatEvidence', () => {
  assert.equal(formatEvidence({ timestamp: '00:12', quote: 'halo' }), '[00:12] "halo"')
  assert.equal(formatEvidence({ timestamp: null, quote: 'halo' }), '"halo"')
  assert.equal(formatEvidence({ timestamp: '00:12', quote: null }), null)
  assert.equal(formatEvidence(null), null)
})

test('scorecardCategories: 9 kategori tetap lalu kategori asing di belakang', () => {
  const cats = scorecardCategories([{ category: 'Etika & Cara Penagihan' }, { category: 'Lain' }, { category: 'Lain' }])
  assert.equal(cats.length, SCORECARD_CATEGORIES.length + 1)
  assert.equal(cats.at(-1), 'Lain')
})

test('filterScorecard menggabungkan kategori dan pencarian', () => {
  const items = [
    { item_code: 'COL-01', category: 'A', requirement: 'Salam pembuka', reason: 'ok' },
    { item_code: 'COL-02', category: 'B', requirement: 'Verifikasi', reason: 'agent menyebut nama' },
    { item_code: 'COL-03', category: 'B', requirement: null, reason: null },
  ]
  assert.equal(filterScorecard(items, '', '').length, 3)
  assert.deepEqual(filterScorecard(items, 'B', '').map(i => i.item_code), ['COL-02', 'COL-03'])
  assert.deepEqual(filterScorecard(items, '', 'col-01').map(i => i.item_code), ['COL-01'])
  assert.deepEqual(filterScorecard(items, 'B', 'NAMA').map(i => i.item_code), ['COL-02'])
})

test('humanizeField', () => {
  assert.equal(humanizeField('outstanding_amount'), 'outstanding amount')
  assert.equal(humanizeField(null), '')
})
