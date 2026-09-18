<template>
  <SidebarLayout title="Collection Results">
    <div class="detail-top">
      <RouterLink to="/dashboard/collection" class="back">‹ Kembali ke daftar</RouterLink>
    </div>

    <!-- Logika fetch/poll/render laporan tinggal di CollectionResultPanel.vue —
         dipakai juga oleh expand row CollectionView.vue supaya tidak dobel.
         Transkrip PDF kini selalu di bawah Hasil Scorecard (seperti Cashline),
         jadi toggle "Laporan + PDF / Laporan saja" tidak diperlukan lagi. -->
    <CollectionResultPanel :result-id="resultId" />
  </SidebarLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import CollectionResultPanel from '../../components/collection/CollectionResultPanel.vue'

const route = useRoute()
const resultId = computed(() => route.params.resultId)
</script>

<style scoped>
.detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.back { font-size: 13px; font-weight: 600; color: var(--text-muted); text-decoration: none; }
.back:hover { color: var(--mega-orange); }
</style>
