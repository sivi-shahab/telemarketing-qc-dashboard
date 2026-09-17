<template>
  <SidebarLayout title="Collection Results">
    <div class="detail-top">
      <RouterLink to="/dashboard/collection" class="back">‹ Kembali ke daftar</RouterLink>
      <div class="layout-toggle" v-if="hasReport">
        <button type="button" :class="{ on: layout === 'split' }" @click="setLayout('split')">Laporan + PDF</button>
        <button type="button" :class="{ on: layout === 'report' }" @click="setLayout('report')">Laporan saja</button>
      </div>
    </div>

    <!-- Logika fetch/poll/render laporan tinggal di CollectionResultPanel.vue —
         dipakai juga oleh expand row CollectionView.vue supaya tidak dobel. -->
    <CollectionResultPanel :result-id="resultId" :layout="layout" @loaded="onLoaded" />
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import CollectionResultPanel from '../../components/collection/CollectionResultPanel.vue'

const LAYOUT_KEY = 'collection.detail.layout'
const route = useRoute()
const resultId = computed(() => route.params.resultId)
const layout = ref(readLayout())
// Tombol toggle layout hanya masuk akal ketika laporannya ada (bukan lagi
// diproses/gagal/bukan laporan berbobot) — sama seperti perilaku lama.
const hasReport = ref(false)

function readLayout() {
  try { return localStorage.getItem(LAYOUT_KEY) === 'report' ? 'report' : 'split' } catch { return 'split' }
}
function setLayout(v) {
  layout.value = v
  try { localStorage.setItem(LAYOUT_KEY, v) } catch { /* abaikan */ }
}
function onLoaded(d) {
  hasReport.value = !!d?.report
}

// Tiket berganti (param route) → panel akan reload sendiri, tapi status
// "punya laporan" untuk toggle harus direset lebih dulu supaya tombol tidak
// nyangkut menampilkan status tiket sebelumnya sampai respons baru datang.
watch(resultId, () => { hasReport.value = false })
</script>

<style scoped>
.detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.back { font-size: 13px; font-weight: 600; color: var(--text-muted); text-decoration: none; }
.back:hover { color: var(--mega-orange); }
.layout-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; background: #fff; }
.layout-toggle button { border: 0; background: transparent; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--mega-gray-600); cursor: pointer; }
.layout-toggle button.on { background: var(--text); color: #fff; }
</style>
