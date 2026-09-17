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

const COMMITMENT = {
  COMMITTED_TO_PAY: { label: 'Berkomitmen Membayar', tone: 'success' },
  PARTIAL_COMMITMENT: { label: 'Komitmen Sebagian', tone: 'warning' },
  DISPUTE: { label: 'Sengketa', tone: 'warning' },
  REFUSED: { label: 'Menolak', tone: 'danger' },
  NOT_STATED: { label: 'Tidak Disebutkan', tone: 'muted' },
}

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

export function groupScorecard(items) {
  const groups = new Map()
  for (const it of items || []) {
    const key = it.category || '-'
    if (!groups.has(key)) groups.set(key, { category: key, items: [], weight: 0, earned: 0 })
    const g = groups.get(key)
    g.items.push(it)
    g.weight += Number(it.weight) || 0
    g.earned += Number(it.item_score) || 0
  }
  return [...groups.values()]
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
