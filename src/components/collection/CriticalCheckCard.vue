<template>
  <div class="col-card">
    <div class="col-card-head">
      <div>
        <h2>Pemeriksaan Kepatuhan Kritis (Critical Compliance Check)</h2>
        <p>Evaluasi indikator utama berisiko sanksi OJK (Pasal 62 &amp; Pasal 22)</p>
      </div>
      <span class="col-pill" :class="`tone-${verdictTone(check.status)}`">{{ verdictLabel(check.status) }}</span>
    </div>
    <p v-if="!check.checked_items.length" class="col-muted">
      Rincian pemeriksaan kepatuhan kritis tidak tersedia untuk audit ini. Model tidak mengembalikan
      daftar <span class="col-mono">checked_items</span> dalam format yang dapat dibaca, sehingga
      status PASS/FAIL per indikator tidak dapat ditampilkan.
    </p>
    <ul v-else class="crit-list">
      <li v-for="it in check.checked_items" :key="it.item_code">
        <span class="col-mono code">{{ it.item_code }}</span>
        <span class="req">{{ it.requirement || '—' }}</span>
        <span class="col-pill" :class="`tone-${verdictTone(it.status)}`">{{ verdictLabel(it.status) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone, verdictLabel } from '../../utils/collectionReport.js'
const props = defineProps({ report: { type: Object, required: true } })
const check = computed(() => props.report.critical_compliance_check)
</script>

<style scoped>
.crit-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.crit-list li { display: grid; grid-template-columns: 90px 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid #EEEFF1; border-radius: 10px; }
.code { font-size: 12px; font-weight: 700; color: #4A4B4E; }
.req { font-size: 13px; color: var(--text); }
</style>
