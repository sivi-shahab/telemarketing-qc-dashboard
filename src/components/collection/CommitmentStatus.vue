<template>
  <div class="exec-sub">
    <div class="exec-sub-head">
      <span class="exec-sub-title">Status Komitmen Konsumen</span>
      <span class="badge" :class="`tone-${commitment.tone}`">{{ commitment.label }}</span>
    </div>
    <table class="tbl">
      <thead>
        <tr>
          <th>Alasan</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="reason reason-cell">{{ status.reason || '—' }}</td>
          <td><EvidenceCell :evidence="status.evidence" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { commitmentBadge } from '../../utils/collectionReport.js'
import EvidenceCell from './EvidenceCell.vue'

const props = defineProps({ report: { type: Object, required: true } })
const status = computed(() => props.report.commitment_status || {})
const commitment = computed(() => commitmentBadge(status.value.status))
</script>
