<template>
  <div class="col-card">
    <div class="col-card-head">
      <div>
        <h2>Analisis Kode Pelanggaran OJK (Error Code Analysis)</h2>
        <p>Deteksi otomatis pasal pelanggaran POJK 22/2023 berdasarkan bukti transkrip</p>
      </div>
      <span class="col-pill" :class="codes.length ? 'tone-danger' : 'tone-success'">{{ codes.length }} kode</span>
    </div>
    <p v-if="!codes.length" class="col-muted">Tidak ditemukan indikasi kode pelanggaran OJK pada panggilan ini.</p>
    <div v-else class="ec-list">
      <article v-for="(e, i) in codes" :key="`${e.error_code}-${i}`" class="ec">
        <h3><span class="col-mono">{{ e.error_code }}</span> {{ e.details_error }}</h3>
        <p v-if="e.trigger_source.reason" class="reason">{{ e.trigger_source.reason }}</p>
        <div v-if="formatEvidence(e.trigger_source.evidence)" class="col-quote">{{ formatEvidence(e.trigger_source.evidence) }}</div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatEvidence } from '../../utils/collectionReport.js'
const props = defineProps({ report: { type: Object, required: true } })
const codes = computed(() => props.report.error_codes || [])
</script>

<style scoped>
.ec-list { display: grid; gap: 10px; }
.ec { background: var(--red-bg); border: 1px solid #f0bcbc; border-radius: 12px; padding: 12px 14px; }
.ec h3 { margin: 0; font-size: 13px; font-weight: 700; color: #7f1d1d; }
.reason { margin: 6px 0 0; font-size: 12px; color: #4A4B4E; }
</style>
