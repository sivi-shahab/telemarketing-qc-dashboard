import { ref, reactive, computed, watch } from 'vue'

// --- Kendali tabel bersama: cari / saring / urutkan / halaman -------------
// Dipakai SEMUA tabel datar menu Stats — Performa Sales, Daftar QC, Performa
// Campaign, Failure Reason, kedua tabel tampilan scoped (Daftar Sales Agent Tim
// Anda & Daftar Ticket ID Anda), dan tabel-tabel Stats Collection. Dipindah dari
// StatsView.vue tanpa perubahan perilaku (18 September 2026).
// Ditulis sekali sebagai factory supaya perilakunya tidak menyimpang antar tabel — mis. lupa mereset halaman ke 1
// setelah mencari, yang membuat tabel tampak kosong padahal datanya ada.
//
// ``extra`` menyambungkan kontrol yang HIDUP DI LUAR factory (mis. dropdown bulan
// pada Performa Campaign) ke tombol Reset. Tanpa itu Reset akan mengaku
// "mengembalikan semuanya" padahal menyisakan satu filter yang masih aktif.
export function useTableView(source, { fields, sortKey, sortDir = 'desc', perPage = 10, filterFn, extra }) {
  const search = ref('')
  const mode = ref('')            // filter tambahan; '' = semua
  const key = ref(sortKey)
  const dir = ref(sortDir)
  const page = ref(1)
  // Nilai awal disimpan supaya Reset benar-benar mengembalikan SEMUANYA — termasuk
  // urutan kolom, yang gampang terlupa kalau reset hanya mengosongkan kotak cari.
  const initial = { key: sortKey, dir: sortDir }

  const filtered = computed(() => {
    let list = source.value || []
    if (filterFn && mode.value) list = list.filter((r) => filterFn(r, mode.value))
    const q = search.value.trim().toLowerCase()
    if (q) {
      // ``fields`` boleh berupa fungsi supaya kolom yang dicari mengikuti kolom yang
      // benar-benar TAMPIL. Mencari nama Team Leader padahal kolomnya disembunyikan
      // hanya menghasilkan baris yang tak jelas kenapa cocok.
      const fs = typeof fields === 'function' ? fields() : fields
      // Tiap entri boleh berupa nama kolom ATAU fungsi (r) => teks — dipakai saat yang
      // dicari adalah teks yang TAMPIL, bukan nilai mentahnya (mis. AI Status tampil
      // "Qualified" padahal datanya "PASS", dan bulan tampil "Agustus 2026" dari "2026-08").
      list = list.filter((r) => fs.some((f) => String(
        (typeof f === 'function' ? f(r) : r[f]) ?? '').toLowerCase().includes(q)))
    }
    const sign = dir.value === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = a[key.value]
      const vb = b[key.value]
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign
      return String(va ?? '').localeCompare(String(vb ?? ''), 'id') * sign
    })
  })

  const total = computed(() => filtered.value.length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / perPage)))
  const rows = computed(() => {
    const p = Math.min(page.value, pageCount.value)
    return filtered.value.slice((p - 1) * perPage, p * perPage)
  })
  const from = computed(() => (total.value ? (Math.min(page.value, pageCount.value) - 1) * perPage + 1 : 0))
  const to = computed(() => Math.min(from.value + perPage - 1, total.value))

  function sortBy(k) {
    if (key.value === k) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
    else {
      key.value = k
      dir.value = 'desc'
    }
    page.value = 1
  }
  function indicator(k) {
    if (key.value !== k) return '⇅'
    return dir.value === 'asc' ? '▲' : '▼'
  }
  function go(p) {
    page.value = Math.min(Math.max(1, p), pageCount.value)
  }

  // Tombol Reset SELALU tampil (dinonaktifkan saat bersih). Versi sebelumnya
  // menyembunyikannya sampai ada filter aktif — hasilnya tidak pernah ditemukan orang,
  // karena fitur yang hanya muncul setelah dipakai tidak bisa ditemukan sebelum dipakai.
  const isDirty = computed(
    () => !!search.value || !!mode.value || key.value !== initial.key || dir.value !== initial.dir
      || (extra ? extra.isDirty() : false))
  function reset() {
    search.value = ''
    mode.value = ''
    key.value = initial.key
    dir.value = initial.dir
    page.value = 1
    extra?.reset()
  }

  // Mencari/menyaring selalu kembali ke halaman 1; kalau datanya menyusut sampai
  // halaman aktif tidak ada lagi, mundur ke halaman terakhir yang masih ada.
  watch([search, mode, source], () => { page.value = 1 })
  watch(pageCount, (n) => { if (page.value > n) page.value = n })

  // reactive(): ref di dalamnya ikut ter-unwrap, sehingga template cukup menulis
  // ``salesView.search`` (termasuk untuk v-model) tanpa ``.value`` di mana-mana.
  return reactive({
    search, mode, page, pageCount, rows, total, from, to,
    sortBy, indicator, go, isDirty, reset,
  })
}
