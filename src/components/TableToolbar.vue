<!--
  Toolbar cari / saring / Reset untuk tabel-tabel di menu Statistics.

  Dipakai enam tabel (Performa Sales, Daftar QC, Performa Campaign, Failure Reason,
  Daftar Sales Agent Tim Anda, Daftar Ticket ID Anda), jadi ditulis sekali — enam
  salinan markup yang sama pasti menyimpang, dan yang paling gampang tertinggal justru
  detail aksesibilitasnya (aria-label, title tombol Reset).

  Berupa KOMPONEN BERKAS TERSENDIRI, bukan render-function di dalam StatsView.vue:
  style di StatsView bersifat `scoped`, dan elemen yang dibuat di dalam sebuah
  functional component tidak menerima atribut `data-v-…` milik induknya — hanya elemen
  akarnya yang menerima. Akibatnya kotak cari, dropdown, dan tombol Reset kehilangan
  seluruh style-nya dan jatuh ke tampilan bawaan browser. Sebagai komponen sendiri,
  style-nya ikut di sini dan pasti kena.

  ``v`` adalah objek dari ``useTableView`` (reactive), jadi menulis ``v.search`` /
  ``v.mode`` di sini memang mengubah state milik pemanggil — bukan mutasi prop.
-->
<template>
  <div class="tbl-toolbar">
    <span class="tbl-search-box">
      <svg class="tbl-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" />
      </svg>
      <input v-model="v.search" class="tbl-search" type="search"
             :placeholder="placeholder" :aria-label="`Cari di tabel ${label}`" />
    </span>
    <select v-if="modes.length" v-model="v.mode" class="tbl-select"
            :aria-label="`Saring tabel ${label}`">
      <option v-for="m in modes" :key="m.value" :value="m.value">{{ m.label }}</option>
    </select>
    <button class="tbl-reset" type="button" :disabled="!v.isDirty"
            :title="v.isDirty ? 'Kosongkan pencarian, filter, dan urutan'
                              : 'Belum ada pencarian, filter, atau urutan yang diubah'"
            @click="v.reset()">
      ↺ Reset
    </button>
  </div>
</template>

<script setup>
defineProps({
  // Objek hasil useTableView(): { search, mode, isDirty, reset() }
  v: { type: Object, required: true },
  // Nama tabel, dipakai untuk aria-label ("Cari di tabel Performa Sales").
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  // [{ value, label }] — kosongkan untuk tabel tanpa filter tambahan (dropdown-nya
  // tidak dirender sama sekali, bukan dirender kosong).
  modes: { type: Array, default: () => [] },
})
</script>

<style scoped>
.tbl-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 10px; }

/* Kotak pencarian: latar abu + ikon kaca pembesar, supaya langsung terbaca sebagai
   kotak cari dan tidak tertukar dengan dropdown di sebelahnya. */
.tbl-search-box {
  position: relative; display: flex; align-items: center;
  flex: 1 1 280px; min-width: 220px;
}
.tbl-search-icon {
  position: absolute; left: 10px; width: 15px; height: 15px;
  color: var(--m-fg-3); pointer-events: none;
}
.tbl-search {
  width: 100%; padding: 8px 11px 8px 32px; font-size: 13px; font-family: inherit;
  border: 1px solid var(--m-border-1); border-radius: 8px;
  background: var(--m-bg-sunken); color: var(--m-fg-1);
  transition: background 0.15s, border-color 0.15s;
}
.tbl-search::placeholder { color: var(--m-fg-3); }
.tbl-search:hover { background: var(--m-gray-150); }
.tbl-search:focus { background: var(--m-bg-surface); border-color: var(--mega-orange); }
.tbl-search::-webkit-search-cancel-button { cursor: pointer; }
.tbl-select {
  padding: 8px 11px; font-size: 13px; font-family: inherit;
  border: 1px solid var(--m-border-1); border-radius: 8px; background: var(--m-bg-surface); color: var(--m-fg-1);
}
.tbl-reset {
  padding: 8px 12px; font-size: 12.5px; font-weight: 600; font-family: inherit; white-space: nowrap;
  border: 1px solid var(--mega-orange); border-radius: 8px;
  background: var(--mega-orange-soft); color: var(--mega-orange-deep);
}
.tbl-reset:hover:not(:disabled) { background: var(--mega-orange); color: #fff; }
.tbl-reset:disabled {
  border-color: var(--m-border-1); background: var(--m-bg-sunken);
  color: var(--m-fg-3); cursor: not-allowed;
}
.tbl-search:focus, .tbl-select:focus { outline: 2px solid var(--mega-orange-soft); outline-offset: 1px; }
</style>
