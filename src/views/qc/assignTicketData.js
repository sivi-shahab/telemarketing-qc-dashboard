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
 * Kalimat konfirmasi untuk tombol "Assign Otomatis".
 *
 * Aturan server (2 Oktober 2026, `qc_auto_assign.distribute_evenly`, mengganti aturan
 * "merata atas total beban" 4 September): antrean dibagi rata di antara QC yang AKTIF
 * saat tombol ditekan, beban lama tidak dihitung, antrean dikocok dan seri diundi.
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
  return `${n} ticket dibagi acak & merata ke ${k} QC aktif saat ini (beban lama `
    + `tidak dihitung, selisih antar-QC paling banyak 1). Jumlah per QC ditentukan server.`
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
