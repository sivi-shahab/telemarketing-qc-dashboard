// Jalankan: node --test src/utils/collectionReport.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  verdictTone, verdictLabel, commitmentBadge, scorePercent, groupScorecard, formatEvidence,
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
  assert.deepEqual(commitmentBadge('COMMITTED_TO_PAY'), { label: 'Berkomitmen Membayar', tone: 'success' })
  assert.deepEqual(commitmentBadge('REFUSED'), { label: 'Menolak', tone: 'danger' })
  assert.deepEqual(commitmentBadge('xxx'), { label: 'Tidak Disebutkan', tone: 'muted' })
})

test('scorePercent aman terhadap maksimum nol', () => {
  assert.equal(scorePercent({ ai_score_phase_2: 90, maximum_score: 120 }), 75)
  assert.equal(scorePercent({ ai_score_phase_2: 0, maximum_score: 0 }), 0)
})

test('groupScorecard menjaga urutan kategori pertama kali muncul', () => {
  const g = groupScorecard([
    { category: 'B', weight: 2, item_score: 2 },
    { category: 'A', weight: 3, item_score: null },
    { category: 'B', weight: 4, item_score: 0 },
  ])
  assert.deepEqual(g.map(x => [x.category, x.items.length, x.weight, x.earned]), [['B', 2, 6, 2], ['A', 1, 3, 0]])
})

test('formatEvidence', () => {
  assert.equal(formatEvidence({ timestamp: '00:12', quote: 'halo' }), '[00:12] "halo"')
  assert.equal(formatEvidence({ timestamp: null, quote: 'halo' }), '"halo"')
  assert.equal(formatEvidence({ timestamp: '00:12', quote: null }), null)
  assert.equal(formatEvidence(null), null)
})
