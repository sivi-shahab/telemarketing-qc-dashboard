// Transformasi murni untuk halaman Assign Ticket. Tanpa Vue dan tanpa jaringan
// supaya bisa diuji langsung dengan `node --test`.

/**
 * Kelompokkan item tickets-daily menjadi satu baris per ticket id.
 * Satu `id` bisa memuat beberapa `tiket_id` (rekaman terpisah).
 * Hasil diurutkan dari `created_time` terbaru.
 */
export function groupTickets(items) {
  const map = new Map()
  for (const it of items || []) {
    const key = it.id ?? it.tiket_id
    if (key == null) continue
    let g = map.get(key)
    if (!g) {
      g = { id: key, campaigns: [], tickets: [], latest: it.created_time ?? null }
      map.set(key, g)
    }
    g.tickets.push(it)
    if (it.campaign && !g.campaigns.includes(it.campaign)) g.campaigns.push(it.campaign)
    const ts = it.created_time ?? null
    if (ts && (!g.latest || ts > g.latest)) g.latest = ts
  }
  return Array.from(map.values()).sort((a, b) => String(b.latest ?? '').localeCompare(String(a.latest ?? '')))
}

/**
 * Status satu baris. `done` HANYA bila seluruh tiket dalam grup sudah diproses
 * hulu. `processed_at` adalah epoch integer, jadi 0 pun berarti sudah diproses —
 * karena itu pemeriksaannya `!= null`, bukan truthiness.
 */
export function groupStatus(group) {
  const tickets = group?.tickets || []
  if (!tickets.length) return 'belum diproses'
  return tickets.every((t) => t.processed_at != null) ? 'done' : 'belum diproses'
}

/**
 * Gabungkan grup tickets-daily dengan item /list_results, dicocokkan lewat
 * ticket id. Ticket yang belum masuk sistem ini mendapat nilai null — kolom QC
 * akan tampil "— belum —" dan ticket tetap bisa di-assign.
 *
 * Bila satu ticket id punya lebih dari satu result (upload ulang), yang dipakai
 * adalah kemunculan PERTAMA: /list_results terurut uploaded_at menurun.
 *
 * `assignments` (dari /qc_assignments) adalah sumber kebenaran untuk kolom QC.
 * /list_results TIDAK cukup: endpoint itu beriterasi per baris tabel `results`,
 * jadi ticket yang belum diproses tidak muncul sama sekali di sana dan
 * assignment-nya tampak hilang setelah reload. Snapshot /list_results hanya
 * dipakai sebagai cadangan dan untuk kolom pemeriksaan QC.
 */
export function joinLocalResults(groups, localItems, assignments) {
  const byTicket = new Map()
  for (const it of localItems || []) {
    if (it?.id != null && !byTicket.has(it.id)) byTicket.set(it.id, it)
  }
  const byAssignment = new Map()
  for (const a of assignments || []) {
    if (a?.ticket_id != null && !byAssignment.has(a.ticket_id)) byAssignment.set(a.ticket_id, a)
  }
  return (groups || []).map((g) => {
    const local = byTicket.get(g.id) || null
    const assigned = byAssignment.get(g.id) || null
    return {
      ...g,
      status: groupStatus(g),
      assigned_qc: assigned?.qc_username ?? local?.assigned_qc ?? null,
      assigned_at: assigned?.assigned_at ?? local?.assigned_at ?? null,
      qc_checked_at: local?.qc_checked_at ?? null,
      qc_checked_by: local?.qc_checked_by ?? null,
      // Tahap KETIGA, terpisah dari qc_checked_*: "Checked At" adalah kapan QC
      // men-SUBMIT Manual Status, "Approved At" kapan vonis itu disetujui atasan.
      // Sebelumnya kolom bernama "Approved At" diisi qc_checked_at — dua peristiwa
      // berbeda yang ditampilkan sebagai satu.
      manual_approved_at: local?.manual_approved_at ?? null,
      manual_approved_by: local?.manual_approved_by ?? null,
    }
  })
}

/**
 * Baris untuk ticket yang dicari LINTAS TANGGAL (13 Oktober 2026): ticket yang tidak
 * ada di tickets-daily tanggal yang dimuat — termasuk tiket upload langsung yang
 * tidak pernah lewat App C sama sekali, padahal tetap bisa di-assign (batch
 * terjadwal membaca `results`, bukan tickets-daily).
 *
 * Datanya dari /list_results dan /qc_assignments untuk `ids` yang diminta. Id yang
 * tidak dikenal keduanya dibuang. Upload ulang: yang dipakai kemunculan PERTAMA,
 * sama seperti joinLocalResults. `outsideDaily` menandai baris ini supaya layar
 * bisa menyebut asalnya.
 */
export function rowsOutsideDaily(ids, localItems, assignments) {
  const rows = []
  for (const id of ids || []) {
    const local = (localItems || []).find((it) => it?.id === id) || null
    const assigned = (assignments || []).find((a) => a?.ticket_id === id) || null
    if (!local && !assigned) continue
    rows.push({
      ...joinLocalResults([{ id, campaigns: [], tickets: [], latest: null }], local ? [local] : [], assigned ? [assigned] : [])[0],
      campaigns: local?.campaign ? [local.campaign] : [],
      status: local?.status || 'belum diproses',
      outsideDaily: true,
    })
  }
  return rows
}

/**
 * Pilihan dropdown filter Campaign: campaign unik dari baris yang termuat, urut
 * abjad. Nilainya kode campaign App C apa adanya (`ACT02`, `LOC26`, …) — sama
 * dengan yang tampil di kolom Campaign.
 */
export function campaignOptions(rows) {
  const set = new Set()
  for (const r of rows || []) {
    for (const c of r?.campaigns || []) if (c) set.add(c)
  }
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
}

/**
 * Baris yang termasuk campaign terpilih. `campaign` kosong = semua baris. Satu
 * ticket id bisa membawa beberapa campaign (lihat groupTickets) — cukup salah
 * satunya cocok.
 */
export function filterByCampaign(rows, campaign) {
  if (!campaign) return rows || []
  return (rows || []).filter((r) => (r?.campaigns || []).includes(campaign))
}

/**
 * Kalimat konfirmasi untuk tombol "Assign Otomatis".
 *
 * Aturan server (2 Oktober 2026, `qc_auto_assign.distribute_evenly`, mengganti aturan
 * "merata atas total beban" 4 September): antrean dibagi rata di antara QC yang AKTIF
 * saat tombol ditekan, beban lama tidak dihitung, antrean dikocok dan seri diundi.
 * Sejak 13 Oktober 2026 rata juga PER CAMPAIGN (campaign App C), bukan hanya total.
 *
 * Jumlah per QC tetap TIDAK dihitung di browser — server bisa membuang sebagian ticket
 * (di luar cakupan, atau keburu di-assign orang lain). Kalimat ini sengaja berhenti
 * pada apa yang benar-benar dijanjikan: berapa ticket, ke berapa QC, dan aturan
 * pembagiannya. Menyebut "n ticket per QC" seperti rumus lama berarti orang
 * menyetujui pembagian yang bukan yang akan terjadi.
 */
export function describeSplit(n, k) {
  if (!k) return 'Tidak ada QC aktif untuk dibagikan.'
  if (!n) return 'Tidak ada ticket yang belum di-assign.'
  return `${n} ticket dibagi acak & merata ke ${k} QC aktif saat ini, rata per campaign `
    + `dan total (beban lama tidak dihitung, selisih antar-QC paling banyak 1). `
    + `Jumlah per QC ditentukan server.`
}

/**
 * Pecah daftar ticket id menjadi potongan-potongan untuk query string.
 *
 * Halaman ini hanya butuh data lokal untuk ticket yang BENAR-BENAR ada di
 * tabelnya. Sebelumnya ia menarik /list_results halaman demi halaman tanpa satu
 * pun filter — sampai 10.000 baris — lalu membuang hampir semuanya; dan
 * /qc_assignments mengirim seluruh riwayat assignment.
 *
 * Id kosong dibuang dan duplikat dibuang, jadi daftar yang seluruhnya kosong
 * menghasilkan NOL potongan — bukan satu potongan kosong. Bedanya penting:
 * `ticket_ids=` kosong adalah permintaan yang tidak ada gunanya, dan di server
 * artinya "tidak ada id yang diminta".
 */
export function chunkTicketIds(ids, size = 200) {
  const seen = []
  const taken = new Set()
  for (const raw of ids || []) {
    const t = String(raw ?? '').trim()
    if (!t || taken.has(t)) continue
    taken.add(t)
    seen.push(t)
  }
  const out = []
  for (let i = 0; i < seen.length; i += size) out.push(seen.slice(i, i + size))
  return out
}

// --- Riwayat assignment (tab Log QC, GET /qc_assignment/events) -------------

const EVENT_ACTIONS = {
  assign: { text: 'Assign', tone: 'green' },
  reassign: { text: 'Pindah', tone: 'blue' },
  unassign: { text: 'Lepas', tone: 'red' },
}

/** Label + warna untuk kolom Aksi. Aksi tak dikenal ditampilkan apa adanya. */
export function eventActionLabel(action) {
  return EVENT_ACTIONS[action] || { text: String(action ?? '—'), tone: 'gray' }
}

const EVENT_SOURCES = {
  manual: 'Manual',
  auto: 'Assign Otomatis',
  scheduler: 'Batch terjadwal',
  lepas: 'Lepas',
  lepas_semua: 'Lepas Semua',
  user_deleted: 'User QC dihapus',
  // Kepemilikan yang sudah ada saat tabel riwayat dibuat (migrasi 0065).
  backfill: 'Data awal',
}

/** Label kolom Jalur (`source` event). */
export function eventSourceLabel(source) {
  if (!source) return '—'
  return EVENT_SOURCES[source] || source
}

/** Saring riwayat dengan teks bebas: ticket id, QC lama/baru (username/nama), pelaku. */
export function filterEvents(events, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return events || []
  const fields = ['ticket_id', 'qc_username', 'qc_name', 'previous_qc_username', 'previous_qc_name', 'actor_username']
  return (events || []).filter((e) => fields.some((f) => String(e[f] ?? '').toLowerCase().includes(q)))
}
