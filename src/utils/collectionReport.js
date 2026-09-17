// Helper murni tampilan laporan audit berbobot Collection. Tidak mengimpor Vue,
// supaya bisa diuji `node --test` seperti assignTicketData.test.mjs.
//
// Kosakata verdict mengikuti api core/compliance/collection_report.py. Nilai yang
// tidak dikenal SELALU jatuh ke 'muted' — tidak pernah ditebak lulus/gagal.

const SUCCESS = new Set(['PASS', 'SESUAI', 'MATCH'])
const DANGER = new Set(['FAIL', 'BELUM_SESUAI', 'MISMATCH'])

const LABELS = {
  PASS: 'Pass', FAIL: 'Fail', SESUAI: 'Sesuai', BELUM_SESUAI: 'Belum Sesuai',
  TIDAK_DINILAI: 'Tidak Dinilai', TIDAK_TERSEDIA: 'Tidak Tersedia',
  MATCH: 'Cocok', MISMATCH: 'Tidak Cocok', SKIPPED_NULL: 'Tanpa Acuan',
  INITIATED: 'Dibahas', NOT_INITIATED: 'Tidak Dibahas',
}

// Label & warna mengikuti getCommitmentBadge() di WeightedAuditView.tsx.
const COMMITMENT = {
  COMMITTED_TO_PAY: { label: 'Committed to Pay (Setuju Bayar)', tone: 'success' },
  PARTIAL_COMMITMENT: { label: 'Partial Commitment (Komitmen Parsial)', tone: 'info' },
  DISPUTE: { label: 'Sengketa / Dispute Tagihan', tone: 'warning' },
  REFUSED: { label: 'Menolak Membayar (Refused)', tone: 'danger' },
  NOT_STATED: { label: 'Tidak Ada Pernyataan Komitmen', tone: 'muted' },
}

// Urutan 9 kategori POJK 22 untuk tab filter scorecard (sama dengan
// `categories` di WeightedAuditView.tsx). Kategori lain yang muncul di data
// ditambahkan di belakang supaya tidak pernah tersembunyi dari filter.
export const SCORECARD_CATEGORIES = [
  'Pembukaan & Identifikasi Petugas',
  'Verifikasi Nasabah & Kerahasiaan Data',
  'Penyampaian Informasi Tunggakan',
  'Etika & Cara Penagihan',
  'Waktu & Tempat Penagihan',
  'Hak Konsumen & Layanan Pengaduan',
  'Penawaran Solusi Penyelesaian',
  'Prosedur Penarikan Agunan',
  'Penutup & Dokumentasi Panggilan',
]

export function verdictTone(value) {
  if (SUCCESS.has(value)) return 'success'
  if (DANGER.has(value)) return 'danger'
  return 'muted'
}

export function verdictLabel(value) {
  if (value == null || value === '') return '—'
  return LABELS[value] || String(value)
}

export function commitmentBadge(status) {
  return COMMITMENT[status] || COMMITMENT.NOT_STATED
}

export function scorePercent(report) {
  const max = Number(report?.maximum_score) || 0
  if (max <= 0) return 0
  return Math.round(((Number(report?.ai_score_phase_2) || 0) / max) * 1000) / 10
}

export function scorecardCategories(items) {
  const extra = []
  for (const it of items || []) {
    const c = it.category
    if (c && !SCORECARD_CATEGORIES.includes(c) && !extra.includes(c)) extra.push(c)
  }
  return [...SCORECARD_CATEGORIES, ...extra]
}

// Filter kategori ('' = semua) + pencarian bebas atas kode, requirement, alasan.
export function filterScorecard(items, category, query) {
  const q = (query || '').trim().toLowerCase()
  return (items || []).filter(it => {
    if (category && it.category !== category) return false
    if (!q) return true
    return [it.item_code, it.requirement, it.reason].some(v => String(v || '').toLowerCase().includes(q))
  })
}

// 'outstanding_amount' → 'outstanding amount' (kapitalisasi lewat CSS).
export function humanizeField(field) {
  return String(field || '').replace(/_/g, ' ')
}

export function formatEvidence(evidence) {
  if (!evidence || !evidence.quote) return null
  return evidence.timestamp ? `[${evidence.timestamp}] "${evidence.quote}"` : `"${evidence.quote}"`
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  // Stempel dari API naive UTC; tampilkan dalam WIB seperti menu lain.
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })
}
