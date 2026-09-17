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
