<template>
  <div class="col-card">
    <div class="col-card-head">
      <div class="head-title">
        <ColIcon name="briefcase" class="head-icon" />
        <div>
          <h2>Verifikasi Akurasi Data Tunggakan (SP Reference Check)</h2>
          <p>Pencocokan nominal dan rincian tunggakan yang disampaikan agent dengan data Surat Peringatan</p>
        </div>
      </div>
    </div>
    <div class="col-table-wrap">
      <table class="col-table">
        <thead>
          <tr>
            <th>Field Data Tunggakan</th>
            <th>Nilai Referensi (SP)</th>
            <th>Diucapkan Agent</th>
            <th>Status Match</th>
            <th>Keterangan / Alasan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="5" class="empty">Tidak ada data tunggakan yang dapat diverifikasi pada audit ini.</td>
          </tr>
          <tr v-for="(r, i) in rows" :key="`${r.field}-${i}`">
            <td class="field">{{ humanizeField(r.field) }}</td>
            <td class="col-mono ref">{{ r.reference_value != null ? String(r.reference_value) : '-' }}</td>
            <td class="col-mono said">
              <template v-if="r.extracted_value != null">{{ String(r.extracted_value) }}</template>
              <span v-else class="none">Tidak Disebutkan</span>
            </td>
            <td>
              <span class="match" :class="`tone-${verdictTone(r.match)}`">{{ r.match ? String(r.match).replace(/_/g, ' ') : '—' }}</span>
              <div v-if="r.similarity_percent != null" class="sim col-mono">{{ r.similarity_percent }}% mirip</div>
            </td>
            <td class="reason">{{ r.reason }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone, humanizeField } from '../../utils/collectionReport.js'
import ColIcon from './ColIcon.vue'
const props = defineProps({ report: { type: Object, required: true } })
const rows = computed(() => props.report.collection_data_verification || [])
</script>

<style scoped>
.head-title { display: flex; align-items: center; gap: 10px; }
.head-icon { color: var(--m-info, #2C6CB0); }
.col-table { font-size: 12px; font-weight: 500; }
.col-table th { padding: 12px 16px; }
.col-table td { padding: 12px 16px; }
.col-table tbody tr:hover { background: #FAFBFC; }
.empty { text-align: center; color: var(--gray); padding: 24px 16px; }
.field { font-weight: 700; color: var(--text); text-transform: capitalize; }
.ref { font-weight: 600; color: #4A4B4E; }
.said { font-weight: 600; color: var(--text); }
.none { font-family: inherit; font-style: italic; color: var(--gray); }
.match { display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid; white-space: nowrap; }
.match.tone-success { background: var(--green-bg); color: var(--green); border-color: #b7dfc6; }
.match.tone-danger { background: var(--red-bg); color: var(--red); border-color: #f0bcbc; }
.match.tone-muted { background: #F4F5F6; color: var(--mega-gray-600); border-color: var(--border); }
.sim { margin-top: 4px; font-size: 10px; color: var(--mega-gray-600); }
.reason { color: var(--mega-gray-600); }
</style>
