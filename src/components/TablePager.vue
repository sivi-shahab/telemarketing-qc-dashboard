<!--
  Navigasi halaman untuk tabel-tabel di menu Statistics. Pasangan TableToolbar.vue —
  lihat catatan di sana soal kenapa ini komponen berkas tersendiri dan bukan
  render-function di dalam StatsView.vue (style `scoped` tidak menjangkau elemen yang
  dibuat functional component, sehingga tombol halamannya kehilangan style).

  Tombolnya hanya berisi simbol « dan », jadi keterangan arahnya dipasang lewat
  aria-label + title supaya pembaca layar dan hover tidak kehilangan makna.
-->
<template>
  <div v-if="v.total" class="pager">
    <span class="pg-info">{{ v.from }}–{{ v.to }} dari {{ v.total }} {{ label }}</span>
    <div class="pg-nav">
      <button class="pg-btn" :class="{ 'is-off': v.page <= 1 }" :disabled="v.page <= 1"
              aria-label="Halaman sebelumnya" title="Halaman sebelumnya"
              @click="v.go(v.page - 1)">«</button>
      <span class="pg-page">Hal {{ currentPage }} / {{ v.pageCount }}</span>
      <button class="pg-btn" :class="{ 'is-off': v.page >= v.pageCount }" :disabled="v.page >= v.pageCount"
              aria-label="Halaman berikutnya" title="Halaman berikutnya"
              @click="v.go(v.page + 1)">»</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Objek hasil useTableView(): { total, from, to, page, pageCount, go() }
  v: { type: Object, required: true },
  // Satuan baris, mis. "agent" / "tiket" / "kategori".
  label: { type: String, default: 'baris' },
})

// Halaman aktif bisa melampaui pageCount sesaat setelah data menyusut; ditahan di
// sini supaya penunjuk halaman tidak pernah membaca "Hal 4 / 3".
const currentPage = computed(() => Math.min(props.v.page, props.v.pageCount))
</script>

<style scoped>
.pager {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 8px; padding: 10px 2px 2px; font-size: 12.5px; color: var(--m-fg-2);
}
.pg-nav { display: flex; align-items: center; gap: 6px; }
.pg-btn {
  width: 30px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px; line-height: 1; font-weight: 700; font-family: inherit;
  border: 1px solid var(--m-border-1); border-radius: 7px; background: var(--m-bg-surface); color: var(--m-fg-1);
}
.pg-btn:hover:not(.is-off) { background: var(--m-gray-100); }
.pg-btn.is-off { opacity: 0.45; cursor: not-allowed; }
.pg-page { font-variant-numeric: tabular-nums; }
</style>
