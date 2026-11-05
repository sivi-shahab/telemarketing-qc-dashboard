// Unduh PDF transkrip App C — KHUSUS role admin (5 November 2026).
//
// Server yang menegakkan aturannya: `GET /tickets_daily_pdf/{tiket_id}/download`
// menjawab 403 untuk role selain admin (api/routers/tickets_daily_pdf.py). Tombolnya
// di sini hanya disembunyikan dari role lain supaya tidak menawarkan aksi yang pasti
// ditolak. Role lain tetap bisa membaca PDF di viewer (pdf.js), tanpa unduhan.
import apiClient from '../api/client.js'

export function canDownloadTranscriptPdf(user) {
  return (user?.role || '') === 'admin'
}

// Nama berkas mengikuti header server; fallback ke `<tiket_id>.pdf`.
function filenameFrom(headers, tiketId) {
  const cd = headers?.['content-disposition'] || ''
  const m = cd.match(/filename="?([^";]+)"?/i)
  return m ? m[1] : `${tiketId}.pdf`
}

// Pesan galat dari body yang terbaca sebagai Blob (responseType 'blob').
async function errorDetail(e) {
  try {
    const raw = e?.response?.data
    if (raw && typeof raw.text === 'function') return JSON.parse(await raw.text())?.detail || ''
  } catch { /* body bukan JSON */ }
  return ''
}

export async function downloadTranscriptPdf(tiketId) {
  try {
    const res = await apiClient.get(
      `/tickets_daily_pdf/${encodeURIComponent(tiketId)}/download`,
      { responseType: 'blob', headers: { Accept: 'application/pdf' } },
    )
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filenameFrom(res.headers, tiketId)
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Beri browser waktu memulai unduhan sebelum URL-nya dilepas.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch (e) {
    const status = e?.response?.status
    const detail = await errorDetail(e)
    throw new Error(detail || (status ? `Gagal mengunduh PDF (HTTP ${status}).` : 'Gagal mengunduh PDF.'))
  }
}
