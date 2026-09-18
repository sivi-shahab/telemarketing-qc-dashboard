<template>
  <div class="exec-sub">
    <div class="exec-sub-head">
      <span class="exec-sub-title">Ringkasan Kategori</span>
      <span class="exec-sub-note">9 kategori POJK 22 — skor per kategori dan aturan toleransi penagihan</span>
    </div>
    <table v-if="cats.length" class="tbl">
      <thead>
        <tr>
          <th>Kategori</th>
          <th class="num">Bobot</th>
          <th class="num">Skor</th>
          <th>Hasil</th>
          <th>Alasan</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(c, i) in cats" :key="`${c.category}-${i}`">
          <td class="strong">{{ c.category || '—' }}</td>
          <td class="num">{{ c.total_weight ?? '—' }}</td>
          <td class="num">{{ c.earned_score ?? '—' }}</td>
          <td>
            <span class="badge" :class="`tone-${verdictTone(c.category_result)}`">
              {{ c.category_result === 'TIDAK_TERSEDIA' || !c.category_result ? 'N/A' : c.category_result }}
            </span>
          </td>
          <td class="muted reason reason-cell">{{ c.fail_reason || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-inline">Model tidak mengembalikan ringkasan kategori.</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone } from '../../utils/collectionReport.js'
const props = defineProps({ report: { type: Object, required: true } })
const cats = computed(() => props.report.category_summary || [])
</script>
