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
      g = { id: key, contexts: [], tickets: [], latest: it.created_time ?? null }
      map.set(key, g)
    }
    g.tickets.push(it)
    if (it.context && !g.contexts.includes(it.context)) g.contexts.push(it.context)
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
    }
  })
}

/**
 * Kalimat konfirmasi untuk tombol "Assign Otomatis".
 *
 * Angkanya HARUS sama dengan pembagian di server
 * (`api/routers/qc_assignment.py` :: `split_evenly`): `floor(n/k)` per QC dan
 * sisanya disebar satu-satu ke QC pertama. Kalau kedua sisi berbeda, orang
 * menyetujui pembagian yang bukan yang benar-benar terjadi.
 */
export function describeSplit(n, k) {
  if (!k) return 'Tidak ada QC aktif untuk dibagikan.'
  if (!n) return 'Tidak ada ticket yang belum di-assign.'
  if (n < k) return `${n} ticket dibagi ke ${n} QC pertama — 1 ticket per QC.`

  const base = Math.floor(n / k)
  const rem = n % k
  const head = `${n} ticket dibagi ke ${k} QC — ${base} ticket per QC`
  return rem ? `${head}, ${rem} QC pertama dapat ${base + 1}.` : `${head}.`
}
