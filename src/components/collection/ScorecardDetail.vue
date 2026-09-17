<template>
  <div class="col-card">
    <div class="col-card-head">
      <div>
        <h2>Rincian Evaluasi Scorecard Berbobot ({{ report.scorecard_result.length }} Indikator)</h2>
        <p>Dikelompokkan per kategori; klik indikator untuk melihat alasan dan bukti</p>
      </div>
      <div class="filters">
        <button v-for="f in FILTERS" :key="f.value" type="button" :class="{ on: filter === f.value }" @click="filter = f.value">{{ f.label }}</button>
      </div>
    </div>

    <section v-for="g in groups" :key="g.category" class="grp">
      <header class="grp-head">
        <h3>{{ g.category }}</h3>
        <span class="col-mono col-muted">{{ g.earned }} / {{ g.weight }}</span>
      </header>
      <details v-for="it in g.items" :key="it.item_code" class="ind" :open="it.status === 'BELUM_SESUAI'">
        <summary>
          <span class="col-mono code">{{ it.item_code }}</span>
          <span class="req">{{ it.requirement || '—' }}</span>
          <span v-if="it.tolerable === 'NO'" class="col-pill tone-warning" title="Non-tolerable">Kritis</span>
          <span class="col-mono w">{{ it.item_score ?? '—' }} / {{ it.weight }}</span>
          <span class="col-pill" :class="`tone-${verdictTone(it.status)}`">{{ verdictLabel(it.status) }}</span>
        </summary>
        <div class="ind-body">
          <p class="reason">{{ it.reason || 'Tidak ada alasan dari model.' }}</p>
          <div v-if="formatEvidence(it.evidence)" class="col-quote">{{ formatEvidence(it.evidence) }}</div>
          <p v-if="it.kb_reference" class="col-muted">Referensi KB: <span class="col-mono">{{ it.kb_reference }}</span></p>
        </div>
      </details>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { verdictTone, verdictLabel, groupScorecard, formatEvidence } from '../../utils/collectionReport.js'

const props = defineProps({ report: { type: Object, required: true } })
const FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'BELUM_SESUAI', label: 'Belum Sesuai' },
  { value: 'TIDAK_DINILAI', label: 'Tidak Dinilai' },
  { value: 'SESUAI', label: 'Sesuai' },
]
const filter = ref('')
const groups = computed(() => groupScorecard(
  (props.report.scorecard_result || []).filter(it => !filter.value || it.status === filter.value),
))
</script>

<style scoped>
.filters { display: flex; gap: 4px; flex-wrap: wrap; }
.filters button { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 600; color: var(--mega-gray-600); cursor: pointer; }
.filters button.on { background: var(--text); color: #fff; border-color: var(--text); }
.grp + .grp { margin-top: 14px; }
.grp-head { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 2px; }
.grp-head h3 { margin: 0; font-size: 13px; font-weight: 700; color: var(--text); }
.ind { border: 1px solid #EEEFF1; border-radius: 10px; margin-top: 6px; }
.ind summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 90px 1fr auto auto auto; gap: 10px; align-items: center; padding: 10px 12px; }
.ind summary::-webkit-details-marker { display: none; }
.ind[open] summary { border-bottom: 1px solid #EEEFF1; background: #FAFBFC; border-radius: 10px 10px 0 0; }
.code { font-size: 12px; font-weight: 700; color: #4A4B4E; }
.req { font-size: 13px; color: var(--text); }
.w { font-size: 12px; color: var(--mega-gray-600); }
.ind-body { padding: 10px 12px 12px; display: grid; gap: 6px; }
.reason { margin: 0; font-size: 13px; color: #4A4B4E; line-height: 1.5; }
@media (max-width: 720px) { .ind summary { grid-template-columns: 1fr auto; } .ind summary .code, .ind summary .w { display: none; } }
</style>
