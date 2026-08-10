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
 */
export function joinLocalResults(groups, localItems) {
  const byTicket = new Map()
  for (const it of localItems || []) {
    if (it?.id != null && !byTicket.has(it.id)) byTicket.set(it.id, it)
  }
  return (groups || []).map((g) => {
    const local = byTicket.get(g.id) || null
    return {
      ...g,
      status: groupStatus(g),
      assigned_qc: local?.assigned_qc ?? null,
      assigned_at: local?.assigned_at ?? null,
      qc_checked_at: local?.qc_checked_at ?? null,
      qc_checked_by: local?.qc_checked_by ?? null,
    }
  })
}
