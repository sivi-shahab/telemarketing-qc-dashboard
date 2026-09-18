// Helper murni untuk CollectionStatsPanel.vue. Tidak mengimpor Vue, supaya bisa
// diuji `node --test` seperti collectionReport.test.mjs / statsView.test.mjs.
//
import { AI_COLORS, AI_LABEL_COLORS } from './aiStatusChart.js'

// Bilangan bulat dengan pemisah ribuan ala Indonesia; `null`/`undefined` -> 0.
export function fmtInt(n) {
  return (n ?? 0).toLocaleString('id-ID')
}

// Persentase yang sudah dibulatkan 1 desimal oleh API; pembagi nol -> `null` dari
// backend, ditampilkan sebagai "—" (bukan "0%", supaya tidak dikira memang nol).
export function fmtPct(v) {
  return v == null ? '—' : `${v}%`
}

// Tanggal kalender WIB (Asia/Jakarta) sebagai 'YYYY-MM-DD' — filter API memakai WIB.
function wibDateParts(now) {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

// Tanggal awal setelah tanggal akhir ditukar supaya request tidak pernah memakai
// rentang terbalik (yang pasti kosong). String 'YYYY-MM-DD' aman dibandingkan leksikal.
export function orderedDateRange(start, end) {
  if (start && end && start > end) return { start: end, end: start }
  return { start, end }
}

// Pesan error panel: `detail` API hanya bila berupa string (422 FastAPI berbentuk
// array objek — tidak layak ditampilkan mentah); selain itu pesan umum.
export function statsErrorMessage(e) {
  const detail = e?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail : 'Gagal memuat statistik Collection.'
}

// Tick auto-refresh 30 detik dilewati bila tab tidak terlihat atau request
// sebelumnya belum selesai (tidak membatalkan request yang sedang berjalan).
export function shouldPollTick({ visibilityState, inFlight }) {
  return visibilityState === 'visible' && !inFlight
}

// --- Grafik PASS/FAIL per waktu (Harian/Mingguan/Bulanan/…) ------------------
// GET /stats/collection hanya mengirim `daily`; bucket yang lebih kasar dihitung di
// sini. Aturan jendela dan label SENGAJA menyalin compute_ai_status_timeseries
// Cashline (core/compliance/stats_aggregate.py: _bucket_of, _default_timeseries_range,
// _shift_anchor) supaya kedua grafik Stats terbaca dengan cara yang sama. Bedanya
// satu: jangkar jendela bawaan di sini hari ini (WIB), bukan tanggal data terakhir.

export const GRANULARITIES = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'quarterly', label: 'Kuartal' },
  { key: 'semester', label: 'Semester' },
  { key: 'yearly', label: 'Tahunan' },
]

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Label mingguan memakai nama bulan penuh bahasa Inggris ("W1 July 2026"), sama
// seperti Cashline (aturan bisnis 31 Agustus 2026).
const MONTHS_FULL_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// Tanggal ditangani sebagai {y, m, d} kalender murni (m 1..12) — tanpa zona waktu,
// supaya tidak ada geseran UTC/WIB di tengah hitungan.
function parse(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return { y, m, d }
}
function fmt({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate() }
function addDays(dt, n) {
  const t = new Date(Date.UTC(dt.y, dt.m - 1, dt.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}
function monthIndex(dt) { return dt.y * 12 + (dt.m - 1) }
function fromMonthIndex(i, d = 1) {
  const y = Math.floor(i / 12)
  const m = (i % 12) + 1
  return { y, m, d: Math.min(d, daysInMonth(y, m)) }
}
// _sub_months: hari pertama bulan, n bulan sebelum dt.
function subMonths(dt, n) { return fromMonthIndex(monthIndex(dt) - n, 1) }
// _add_months: geser n bulan, hari dipertahankan tapi dipotong ke panjang bulan.
function addMonths(dt, n) { return fromMonthIndex(monthIndex(dt) + n, dt.d) }

function womStart(dt) { return { ...dt, d: Math.floor((dt.d - 1) / 7) * 7 + 1 } }
function womEnd(start) { return { ...start, d: Math.min(start.d + 6, daysInMonth(start.y, start.m)) } }
function shiftWom(dt, n) {
  let cur = womStart(dt)
  for (let i = 0; i < Math.abs(n); i++) {
    cur = n < 0 ? womStart(addDays(cur, -1)) : womStart(addDays(womEnd(cur), 1))
  }
  return cur
}

// Hari ini menurut kalender WIB sebagai 'YYYY-MM-DD'.
export function wibToday(now = new Date()) {
  return fmt(wibDateParts(now))
}

// { key, label } bucket untuk tanggal 'YYYY-MM-DD'.
export function bucketOf(iso, granularity) {
  const dt = parse(iso)
  const { y, m, d } = dt
  switch (granularity) {
    case 'daily': return { key: fmt(dt), label: `${d} ${MONTHS_ABBR[m - 1]}` }
    case 'weekly': {
      const w = Math.floor((d - 1) / 7) + 1
      return { key: `${y}-${String(m).padStart(2, '0')}-W${w}`, label: `W${w} ${MONTHS_FULL_EN[m - 1]} ${y}` }
    }
    case 'quarterly': { const q = Math.floor((m - 1) / 3) + 1; return { key: `${y}-Q${q}`, label: `Q${q} ${y}` } }
    case 'semester': { const s = m <= 6 ? 1 : 2; return { key: `${y}-S${s}`, label: `S${s} ${y}` } }
    case 'yearly': return { key: String(y), label: String(y) }
    default: return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS_ABBR[m - 1]} ${y}` }
  }
}

function shiftAnchor(anchor, granularity, offset) {
  if (!offset) return anchor
  switch (granularity) {
    case 'daily': return addDays(anchor, 7 * offset)
    case 'weekly': return shiftWom(anchor, 4 * offset)
    case 'quarterly': return addMonths(anchor, 12 * offset)
    case 'semester': return addMonths(anchor, 24 * offset)
    case 'yearly': return addMonths(anchor, 48 * offset)
    default: return addMonths(anchor, 4 * offset)
  }
}

// Jendela bawaan { start, end } berakhir di `anchorIso` (hari ini WIB), digeser
// `offset` jendela utuh (0 = terbaru, -1 = satu jendela lebih lama).
export function defaultWindow(granularity, anchorIso, offset = 0) {
  const a = shiftAnchor(parse(anchorIso), granularity, offset)
  let start
  switch (granularity) {
    case 'daily': start = addDays(a, -6); break
    case 'weekly': start = shiftWom(a, -3); break
    case 'quarterly': start = subMonths({ y: a.y, m: Math.floor((a.m - 1) / 3) * 3 + 1, d: 1 }, 9); break
    case 'semester': start = subMonths({ y: a.y, m: a.m <= 6 ? 1 : 7, d: 1 }, 18); break
    case 'yearly': start = { y: a.y - 3, m: 1, d: 1 }; break
    default: start = subMonths(a, 3)
  }
  return { start: fmt(start), end: fmt(a) }
}

// Jumlahkan `daily` ({date, pass, fail}[]) ke bucket granularitas, menutup SELURUH
// rentang [start, end] — bucket tanpa data tetap ada (0/0) supaya sumbu waktunya
// tidak bolong, sama seperti Cashline.
export function bucketDaily(daily, granularity, start, end) {
  const buckets = []
  const byKey = new Map()
  const endIso = String(end).slice(0, 10)
  for (let dt = parse(start); fmt(dt) <= endIso; dt = addDays(dt, 1)) {
    const b = bucketOf(fmt(dt), granularity)
    if (!byKey.has(b.key)) {
      const row = { ...b, pass: 0, fail: 0 }
      byKey.set(b.key, row)
      buckets.push(row)
    }
  }
  for (const r of Array.isArray(daily) ? daily : []) {
    if (!r?.date || r.date < start || r.date > endIso) continue
    const row = byKey.get(bucketOf(r.date, granularity).key)
    if (!row) continue
    row.pass += r.pass || 0
    row.fail += r.fail || 0
  }
  return buckets
}

// Data Bar chart.js 100% bertumpuk untuk bucket PASS/FAIL, bentuknya sama dengan
// stackedData() Stats Cashline (persen per bucket, jumlah mentah di `_counts`,
// warna label di `_labelColor`) supaya stackedOptions & plugin barPct bisa dipakai
// apa adanya. Dataset pertama duduk di dasar batang: FAIL di bawah, PASS di atas.
export function passFailChartData(buckets) {
  const rows = Array.isArray(buckets) ? buckets : []
  const passPct = [], failPct = [], passCnt = [], failCnt = []
  for (const b of rows) {
    const p = b.pass || 0, f = b.fail || 0, t = p + f
    passCnt.push(p); failCnt.push(f)
    passPct.push(t ? (p / t) * 100 : 0)
    failPct.push(t ? (f / t) * 100 : 0)
  }
  return {
    labels: rows.map((b) => b.label),
    datasets: [
      { label: 'FAIL', data: failPct, backgroundColor: AI_COLORS.return, _labelColor: AI_LABEL_COLORS.return, stack: 'ai', _counts: failCnt, maxBarThickness: 46 },
      { label: 'PASS', data: passPct, backgroundColor: AI_COLORS.approve, _labelColor: AI_LABEL_COLORS.approve, stack: 'ai', _counts: passCnt, maxBarThickness: 46 },
    ],
  }
}
