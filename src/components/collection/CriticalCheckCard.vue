<template>
  <div class="exec-sub">
    <div class="exec-sub-head">
      <span class="exec-sub-title">Critical Compliance Check</span>
      <!-- TIDAK_TERSEDIA = model tidak memberi verdict yang bisa dibaca; sengaja
           netral, tidak boleh tampak lulus maupun gagal. -->
      <span v-if="check.status" class="badge" :class="`tone-${verdictTone(check.status)}`">{{ rawLabel(check.status) }}</span>
      <span class="exec-sub-note">Indikator utama berisiko sanksi OJK (Pasal 62 &amp; Pasal 22)</span>
    </div>
    <table v-if="check.checked_items?.length" class="tbl">
      <thead>
        <tr>
          <th>Item Code</th>
          <th>Requirement</th>
          <th>Status</th>
          <th>Alasan</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(it, i) in check.checked_items" :key="`${it.item_code}-${i}`">
          <td class="strong">{{ it.item_code || '—' }}</td>
          <td>{{ it.requirement || '—' }}</td>
          <td><span class="badge" :class="`tone-${verdictTone(it.status)}`">{{ rawLabel(it.status) }}</span></td>
          <!-- Model tidak mengirim alasan per item critical check; alasannya
               diambil dari item scorecard dengan item_code yang sama. -->
          <td class="muted reason reason-cell">{{ reasonOf(it) }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-inline">
      Rincian pemeriksaan kepatuhan kritis tidak tersedia — model tidak mengembalikan
      daftar <span class="mono">checked_items</span> yang dapat dibaca.
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone } from '../../utils/collectionReport.js'

const props = defineProps({ report: { type: Object, required: true } })
const check = computed(() => props.report.critical_compliance_check || { status: null, checked_items: [] })
const scorecardByCode = computed(() => {
  const m = {}
  for (const it of props.report.scorecard_result || []) if (it?.item_code) m[it.item_code] = it
  return m
})
const reasonOf = it => it?.reason || scorecardByCode.value[it?.item_code]?.reason || '—'
const rawLabel = s => (s ? String(s).replace(/_/g, ' ') : '—')
</script>
