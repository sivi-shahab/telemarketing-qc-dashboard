<template>
  <div class="exec-sub">
    <div class="exec-sub-head">
      <span class="exec-sub-title">Verifikasi Data Tunggakan (SP Reference Check)</span>
      <span class="exec-sub-note">Nominal dan rincian tunggakan yang disampaikan agent vs data Surat Peringatan</span>
    </div>
    <div class="tbl-scroll">
      <table class="tbl">
        <thead>
          <tr>
            <th>Field</th>
            <th>Nilai Referensi (SP)</th>
            <th>Diucapkan Agent</th>
            <th>Status Match</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="5" class="empty-inline">Tidak ada data tunggakan yang dapat diverifikasi pada audit ini.</td>
          </tr>
          <tr v-for="(r, i) in rows" :key="`${r.field}-${i}`">
            <td class="strong field">{{ humanizeField(r.field) }}</td>
            <td class="mono">{{ r.reference_value != null ? String(r.reference_value) : '—' }}</td>
            <td class="mono">
              <template v-if="r.extracted_value != null">{{ String(r.extracted_value) }}</template>
              <span v-else class="muted"><i>Tidak Disebutkan</i></span>
            </td>
            <td>
              <span class="badge" :class="`tone-${verdictTone(r.match)}`">{{ r.match ? String(r.match).replace(/_/g, ' ') : '—' }}</span>
              <div v-if="r.similarity_percent != null" class="cat-sub mono">{{ r.similarity_percent }}% mirip</div>
            </td>
            <td class="reason reason-cell">{{ r.reason || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone, humanizeField } from '../../utils/collectionReport.js'
const props = defineProps({ report: { type: Object, required: true } })
const rows = computed(() => props.report.collection_data_verification || [])
</script>

<style scoped>
.field { text-transform: capitalize; }
</style>
