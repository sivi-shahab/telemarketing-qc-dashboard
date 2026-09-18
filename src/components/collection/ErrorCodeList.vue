<template>
  <div class="exec-sub">
    <div class="exec-sub-head">
      <span class="exec-sub-title">Error Code</span>
      <span class="badge" :class="codes.length ? 'tone-danger' : 'tone-success'">{{ codes.length }} error</span>
      <span class="exec-sub-note">Pasal pelanggaran POJK 22/2023 berdasarkan bukti transkrip</span>
    </div>
    <div v-if="!codes.length" class="empty-inline">Tidak ditemukan indikasi kode pelanggaran OJK pada panggilan ini.</div>
    <div v-else class="tbl-scroll">
      <table class="tbl">
        <thead>
          <tr>
            <th>Error Code</th>
            <th>Details Error</th>
            <th>Reason</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in codes" :key="`${e.error_code}-${i}`">
            <td class="strong mono">{{ e.error_code || '—' }}</td>
            <td>{{ e.details_error || '—' }}</td>
            <td class="reason reason-cell">{{ e.trigger_source?.reason || '—' }}</td>
            <td><EvidenceCell :evidence="e.trigger_source?.evidence" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import EvidenceCell from './EvidenceCell.vue'
const props = defineProps({ report: { type: Object, required: true } })
const codes = computed(() => props.report.error_codes || [])
</script>
