// Warna, opsi, dan plugin label grafik batang AI Status (100% stacked) — dipakai
// bersama oleh Stats Cashline (StatsView.vue) dan Stats Collection
// (CollectionStatsPanel.vue) supaya kedua grafik tampil sama persis. Dipindah dari
// StatsView.vue tanpa perubahan perilaku (18 September 2026).
//
// Warna di-hardcode (bukan var(--m-…)): Chart.js menggambar ke <canvas>, yang tidak
// me-resolve custom property CSS.

// AI status bar chart: PASS = Qualified (hijau), FAIL = Not Qualified (merah),
// PENDING = butuh dokumen dalam tenggat H+2 (kuning).
//
// 28 Agustus 2026 — permintaan bisnis KHUSUS bar chart (tidak menyentuh KPI card,
// badge, atau tabel yang tetap memakai --m-success/--m-danger/#D97706):
//   hijau  -> hijau stabilo, tulisan hitam   (dulu #1F8A4C)
//   merah  -> digelapkan,    tulisan putih   (dulu #C73838)
//   kuning -> diterangkan,   tulisan hitam   (dulu #D97706)
// ``AI_LABEL_COLORS`` dipakai plugin ``barPct`` untuk mewarnai persentase di dalam
// tiap segmen; tanpa ini semua label tetap putih dan hilang di atas kuning terang.
export const AI_COLORS = { approve: '#5CE65C', return: '#9B1C1C', pending: '#FFD93D' }
export const AI_LABEL_COLORS = { approve: '#1E1F21', return: '#FFFFFF', pending: '#1E1F21' }
// 14 September 2026: dipakai juga (bersama AI_LABEL_COLORS untuk teksnya) sebagai
// background solid Qualified/Not Qualified/Pending di tabel Performa Sales & tabel
// Hierarki Failure Rate (Area Manager → Team Leader → Agent) — permintaan bisnis
// supaya warnanya SAMA PERSIS dengan bar chart AI Status di atas, bukan pastel.

export const stackedOptions = {
  responsive: true, maintainAspectRatio: false,
  layout: { padding: { top: 24 } }, // ruang di atas batang untuk label total submisi
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } },
    y: { stacked: true, min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + '%' }, grid: { color: 'rgba(0,0,0,.06)' } },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const cnt = ctx.dataset._counts?.[ctx.dataIndex] ?? 0
          return ` ${ctx.dataset.label}: ${cnt.toLocaleString('id-ID')} (${(ctx.raw ?? 0).toFixed(1)}%)`
        },
      },
    },
  },
}
// Inline plugin: write each segment's percentage (white, bold) centred in its
// stacked bar. Skips segments too short/narrow to fit the label so dense views
// (e.g. 30 daily columns) or tiny slices don't turn into clutter.
export const barPct = {
  id: 'barPct',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = '700 12px "Plus Jakarta Sans", Inter, system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 1) percentage centred inside each segment, dalam warna milik dataset itu
    //    (``_labelColor``): hitam di atas hijau stabilo & kuning terang, putih di
    //    atas merah gelap. Bayangannya ikut warna label supaya kontrasnya menambah,
    //    bukan mengaburkan — label hitam dulu memakai bayangan hitam dan jadi tebal
    //    berlumur di atas kuning.
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return
      const labelColor = ds._labelColor || '#fff'
      ctx.fillStyle = labelColor
      ctx.shadowColor = labelColor === '#FFFFFF' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.55)'
      ctx.shadowBlur = 3
      meta.data.forEach((bar, i) => {
        const v = Number(ds.data[i]) || 0
        if (!v) return
        const height = Math.abs(bar.base - bar.y)
        if (height < 14 || bar.width < 18) return // too small to label legibly
        ctx.fillText(`${Math.round(v)}%`, bar.x, (bar.y + bar.base) / 2)
      })
    })
    // 2) total dinilai (qualified + not qualified + pending) above each column
    const meta0 = chart.getDatasetMeta(0)
    const cA = chart.data.datasets[0]?._counts || []
    const cR = chart.data.datasets[1]?._counts || []
    const cP = chart.data.datasets[2]?._counts || []
    const yTop = chart.chartArea.top - 9
    ctx.shadowBlur = 0
    ctx.fillStyle = '#1E1F21' // ikut aturan "semua tulisan hitam" (dulu #334155)
    ctx.font = '800 12px "Plus Jakarta Sans", Inter, system-ui, -apple-system, sans-serif'
    meta0.data.forEach((bar, i) => {
      const total = (Number(cA[i]) || 0) + (Number(cR[i]) || 0) + (Number(cP[i]) || 0)
      if (!total || bar.width < 14) return
      ctx.fillText(total.toLocaleString('id-ID'), bar.x, yTop)
    })
    ctx.restore()
  },
}
