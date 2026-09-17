<template>
  <div class="col-card">
    <div class="col-card-head">
      <div class="head-title">
        <ColIcon name="octagon" class="head-icon" />
        <div>
          <h2>Analisis Kode Pelanggaran OJK (Error Code Analysis)</h2>
          <p>Deteksi otomatis pasal pelanggaran POJK 22/2023 berdasarkan bukti transkrip</p>
        </div>
      </div>
      <span class="total col-mono">Total Error: {{ codes.length }}</span>
    </div>
    <div v-if="!codes.length" class="clean">✅ Tidak ditemukan indikasi kode pelanggaran OJK pada panggilan ini.</div>
    <div v-else class="ec-list">
      <article v-for="(e, i) in codes" :key="`${e.error_code}-${i}`" class="ec">
        <div class="ec-top">
          <span class="ec-code col-mono">{{ e.error_code }}</span>
          <h3>{{ e.details_error }}</h3>
        </div>
        <p v-if="e.trigger_source?.reason" class="reason">{{ e.trigger_source.reason }}</p>
        <div v-if="e.trigger_source?.evidence?.quote" class="quote">
          "{{ e.trigger_source.evidence.quote }}"
          <span v-if="e.trigger_source.evidence.timestamp" class="ts">[{{ e.trigger_source.evidence.timestamp }}]</span>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ColIcon from './ColIcon.vue'
const props = defineProps({ report: { type: Object, required: true } })
const codes = computed(() => props.report.error_codes || [])
</script>

<style scoped>
.head-title { display: flex; align-items: center; gap: 10px; }
.head-icon { color: var(--red); }
.total { padding: 4px 10px; background: #F4F5F6; color: #4A4B4E; font-size: 12px; font-weight: 700; border-radius: 8px; white-space: nowrap; }
.clean { background: var(--green-bg); border: 1px solid #b7dfc6; border-radius: 12px; padding: 16px; text-align: center; color: var(--green); font-size: 12px; font-weight: 500; }
.ec-list { display: grid; gap: 12px; }
.ec { background: #FDF3F3; border: 1px solid #f0bcbc; border-radius: 12px; padding: 16px; display: grid; gap: 8px; }
.ec-top { display: flex; align-items: center; gap: 8px; }
.ec-code { padding: 3px 10px; background: var(--red); color: #fff; font-size: 12px; font-weight: 700; border-radius: 6px; }
.ec h3 { margin: 0; font-size: 12px; font-weight: 700; color: #7f1d1d; }
.reason { margin: 0; font-size: 12px; font-weight: 500; line-height: 1.55; color: #9f2a2a; }
.quote { background: #fff; border: 1px solid #f0bcbc; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-style: italic; font-family: var(--font-mono); color: var(--text); }
.ts { margin-left: 6px; font-style: normal; font-size: 10px; font-weight: 700; background: var(--red-bg); color: #9f2a2a; padding: 1px 6px; border-radius: 4px; }
</style>
