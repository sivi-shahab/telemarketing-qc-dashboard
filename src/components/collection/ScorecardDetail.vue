<template>
  <div class="block">
    <div class="block-head">
      <span class="block-title">Hasil Scorecard ({{ items.length }} item)</span>
      <div class="sc-filter">
        <select v-model="category" aria-label="Filter kategori">
          <option value="">Semua Kategori ({{ items.length }})</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
        <input v-model="query" type="search" placeholder="Cari indikator / kode..." aria-label="Cari indikator" />
      </div>
    </div>
    <div class="tbl-scroll">
      <table class="tbl">
        <thead>
          <tr>
            <th>Item</th>
            <th>Requirement</th>
            <th>Tolerable Error</th>
            <th class="num">Bobot</th>
            <th>Status</th>
            <th class="num">Skor</th>
            <th>Evidence</th>
            <th>Reason</th>
            <th>Referensi KB</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!filtered.length">
            <td colspan="9" class="empty-inline">Tidak ada indikator yang cocok dengan pencarian / filter kategori.</td>
          </tr>
          <tr v-for="(it, i) in filtered" :key="`${it.item_code}-${i}`">
            <td class="strong">{{ it.item_code || '—' }}<div class="cat-sub">{{ it.category }}</div></td>
            <td>{{ it.requirement || '—' }}</td>
            <td><span class="badge" :class="it.tolerable === 'NO' ? 'tone-danger' : 'tone-muted'">{{ it.tolerable || '—' }}</span></td>
            <td class="num">{{ it.weight ?? '—' }}</td>
            <td><span class="badge" :class="`tone-${verdictTone(it.status)}`">{{ it.status || '—' }}</span></td>
            <td class="num">{{ it.item_score ?? '—' }}</td>
            <td><EvidenceCell :evidence="it.evidence" /></td>
            <td class="reason reason-cell">{{ it.reason || '—' }}</td>
            <td class="mono kb">{{ it.kb_reference || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { scorecardCategories, filterScorecard, verdictTone } from '../../utils/collectionReport.js'
import EvidenceCell from './EvidenceCell.vue'

const props = defineProps({ report: { type: Object, required: true } })
const category = ref('')
const query = ref('')

const items = computed(() => props.report.scorecard_result || [])
const categories = computed(() => scorecardCategories(items.value))
const filtered = computed(() => filterScorecard(items.value, category.value, query.value))
</script>

<style scoped>
.sc-filter { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
.sc-filter select, .sc-filter input {
  font-size: 12px; padding: 5px 10px; border: 1px solid var(--border);
  border-radius: 7px; background: #fff; color: var(--text);
}
.sc-filter input { width: 220px; max-width: 100%; }
.kb { font-size: 11px; white-space: nowrap; }
</style>
