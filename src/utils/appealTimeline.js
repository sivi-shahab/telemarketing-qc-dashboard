// Timeline banding Error Code — SATU sumber wording, dipakai dua tempat:
// tabel Error Code di detail evaluasi dan modal Riwayat di kolom Results.
// Kalau dibiarkan terduplikasi, kedua tampilan cepat berbeda kata-katanya.
const KIND = {
  remove: 'Ajukan hapus error code',
  change: 'Ajukan ubah error code',
  add: 'Ajukan tambah error code',
}
const TL = { approved: 'Diterima (final)', rejected: 'Ditolak', escalated: 'Diteruskan ke SPQ Head' }
const SPQ = { approved: 'Approved', rejected: 'Rejected' }
// Edit langsung oleh reviewer tidak melewati rantai QC -> TL -> SPQ: satu kejadian saja.
const DIRECT_ROLE = { tl_direct: 'TL QC', spq_direct: 'SPQ Head' }
const DIRECT_ACTION = {
  remove: 'Hapus error code (langsung)',
  change: 'Ubah error code (langsung)',
  add: 'Tambah error code (langsung)',
}

/** Ubah daftar riwayat banding menjadi kejadian berurutan (terlama dulu). */
export function appealTimeline(history) {
  const ev = []
  for (const h of history || []) {
    if (h.origin === 'tl_direct' || h.origin === 'spq_direct') {
      ev.push({
        at: h.tl_qc_reviewed_at || h.requested_at,
        role: DIRECT_ROLE[h.origin],
        who: h.requested_by_username,
        action: DIRECT_ACTION[h.appeal_kind] || 'Edit langsung',
        note: h.qc_reason,
        error_code: h.error_code,
        item_code: h.item_code,
      })
      continue
    }
    ev.push({
      at: h.requested_at, role: 'QC', who: h.requested_by_username,
      action: KIND[h.appeal_kind] || 'Ajukan banding', note: h.qc_reason,
      error_code: h.error_code, item_code: h.item_code,
    })
    if (h.tl_qc_reviewed_at) {
      ev.push({
        at: h.tl_qc_reviewed_at, role: 'TL QC', who: h.tl_qc_username,
        action: TL[h.tl_qc_status] || h.tl_qc_status, note: h.tl_qc_comment,
        error_code: h.error_code, item_code: h.item_code,
      })
    }
    if (h.reviewed_at) {
      ev.push({
        at: h.reviewed_at, role: 'SPQ Head', who: h.reviewed_by_username,
        action: SPQ[h.approval_status] || h.approval_status, note: h.review_comment,
        error_code: h.error_code, item_code: h.item_code,
      })
    }
  }
  return ev.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0))
}
