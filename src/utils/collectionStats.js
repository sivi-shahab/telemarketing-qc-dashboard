// Helper murni untuk CollectionStatsPanel.vue. Tidak mengimpor Vue, supaya bisa
// diuji `node --test` seperti collectionReport.test.mjs / statsView.test.mjs.
//
// Warna dataset chart di-hardcode (bukan `var(--m-success)`/`var(--m-danger)`)
// karena Chart.js menulis ke <canvas> lewat CanvasRenderingContext2D.fillStyle,
// yang tidak me-resolve custom property CSS seperti elemen DOM biasa — pola yang
// sama dipakai StatsView.vue (lihat `AI_COLORS`). Nilainya disalin persis dari
// token `--m-success` / `--m-danger` di src/assets/mega.css.
export const CHART_SUCCESS_COLOR = '#1F8A4C'
export const CHART_DANGER_COLOR = '#C73838'

// Bilangan bulat dengan pemisah ribuan ala Indonesia; `null`/`undefined` -> 0.
export function fmtInt(n) {
  return (n ?? 0).toLocaleString('id-ID')
}

// Persentase yang sudah dibulatkan 1 desimal oleh API; pembagi nol -> `null` dari
// backend, ditampilkan sebagai "—" (bukan "0%", supaya tidak dikira memang nol).
export function fmtPct(v) {
  return v == null ? '—' : `${v}%`
}

// Bangun data Bar chart.js bertumpuk dari `daily` ({date, pass, fail}[]) hasil
// GET /stats/collection. Murni transformasi bentuk data — tidak menyentuh DOM.
export function dailyChartData(daily) {
  const rows = Array.isArray(daily) ? daily : []
  return {
    labels: rows.map((d) => d.date),
    datasets: [
      {
        label: 'PASS',
        data: rows.map((d) => d.pass ?? 0),
        backgroundColor: CHART_SUCCESS_COLOR,
        stack: 'verdict',
      },
      {
        label: 'FAIL',
        data: rows.map((d) => d.fail ?? 0),
        backgroundColor: CHART_DANGER_COLOR,
        stack: 'verdict',
      },
    ],
  }
}

// Rentang bawaan filter tanggal panel: 30 hari terakhir (hari ini ikut dihitung).
// Tanpa batas, GET /stats/collection membaca SELURUH tiket Collection tiap 30 detik.
export const DEFAULT_RANGE_DAYS = 30

// Tanggal kalender WIB (Asia/Jakarta) sebagai 'YYYY-MM-DD' — filter API memakai WIB.
function wibDateParts(now) {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

// { start, end } = (hari ini WIB − 29 hari) .. hari ini WIB.
export function defaultDateRange(now = new Date()) {
  const { y, m, d } = wibDateParts(now)
  return {
    start: isoDate(Date.UTC(y, m - 1, d - (DEFAULT_RANGE_DAYS - 1))),
    end: isoDate(Date.UTC(y, m - 1, d)),
  }
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
