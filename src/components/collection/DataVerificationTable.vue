<template>
  <div class="col-card">
    <div class="col-card-head">
      <div>
        <h2>Verifikasi Akurasi Data Tunggakan (SP Reference Check)</h2>
        <p>Nilai yang disebut dalam panggilan. Jalur Collection tidak membaca TMS/Ascend, jadi baris tanpa acuan ditandai "Tanpa Acuan".</p>
      </div>
    </div>
    <p v-if="!rows.length" class="col-muted">Tidak ada data tunggakan yang dapat diverifikasi pada audit ini.</p>
    <div v-else class="col-table-wrap">
      <table class="col-table">
        <thead>
          <tr>
            <th>Field Data Tunggakan</th>
            <th>Nilai Referensi (SP)</th>
            <th>Diucapkan Agent</th>
            <th>Status Match</th>
            <th>Kemiripan</th>
            <th>Keterangan / Alasan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="`${r.field}-${i}`">
            <td class="col-mono">{{ r.field }}</td>
            <td>{{ r.reference_value ?? '—' }}</td>
            <td>{{ r.extracted_value ?? '—' }}</td>
            <td><span class="col-pill" :class="`tone-${verdictTone(r.match)}`">{{ verdictLabel(r.match) }}</span></td>
            <td class="col-mono">{{ r.similarity_percent != null ? `${r.similarity_percent}%` : '—' }}</td>
            <td class="col-muted">{{ r.reason || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone, verdictLabel } from '../../utils/collectionReport.js'
const props = defineProps({ report: { type: Object, required: true } })
const rows = computed(() => props.report.collection_data_verification || [])
</script>
