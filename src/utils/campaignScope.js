// Penyaring daftar campaign ke CAKUPAN login yang sedang aktif.
//
// Semua dropdown campaign (Stats, Results, Transcripts, Upload Audio, Upload
// Transcript) sumbernya `/list_campaigns` — seluruh isi tabel campaigns, tanpa
// hubungan apa pun dengan tag campaign role. Akibatnya sebuah role yang sengaja
// dipersempit ke satu campaign tetap ditawari campaign lain, dan memilihnya hanya
// menghasilkan tabel kosong: server memang menolaknya (lihat
// `rbac.effective_campaigns_for`), tetapi layar tidak pernah mengatakan kenapa.
// Helper ini membuang pilihan yang pasti kosong itu sebelum sempat ditawarkan.
//
// `auth.campaigns` berasal dari `/auth/me` (= `effective_campaigns_for`). Daftar
// KOSONG di sana berarti "tidak dibatasi" — itulah bawaan hampir semua role — jadi
// daftarnya dikembalikan apa adanya. (Backend memetakan "dibatasi ke tidak ada apa
// pun" ke bentuk kosong yang sama; login seperti itu memang tidak melihat data di
// mana pun, jadi isi dropdown-nya tidak mengubah apa-apa.)
import { useAuthStore } from '../stores/auth.js'

export function campaignsInScope(names) {
  const auth = useAuthStore()
  const allowed = auth.campaigns || []
  if (!allowed.length) return names || []
  const set = new Set(allowed.map((c) => String(c || '').trim().toLowerCase()))
  return (names || []).filter((n) => set.has(String(n || '').trim().toLowerCase()))
}

// True bila login ini memang dibatasi ke sebagian campaign. Dipakai layar Upload
// untuk membedakan "belum ada campaign sama sekali" (ajakan Upload Campaign) dari
// "ada, tapi semuanya di luar cakupan Anda" — dua keadaan yang tindak lanjutnya
// berbeda tetapi tampak sama begitu dropdown-nya disaring.
export function isCampaignScoped() {
  const auth = useAuthStore()
  return (auth.campaigns || []).length > 0
}

// Varian untuk dropdown yang memegang OBJEK campaign ({ id, name, is_active })
// alih-alih nama telanjang — dipakai kedua menu Upload.
export function campaignObjectsInScope(items) {
  const auth = useAuthStore()
  const allowed = auth.campaigns || []
  if (!allowed.length) return items || []
  const set = new Set(allowed.map((c) => String(c || '').trim().toLowerCase()))
  return (items || []).filter((c) => set.has(String(c?.name || '').trim().toLowerCase()))
}
