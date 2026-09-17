<template>
  <div class="col-card">
    <div class="col-card-head">
      <div>
        <h2>Ringkasan Nilai Per Kategori (9 Kategori POJK 22)</h2>
        <p>Pencapaian skor per kategori dan aturan toleransi penagihan</p>
      </div>
    </div>
    <p v-if="!cats.length" class="col-muted">Model tidak mengembalikan ringkasan kategori.</p>
    <div v-else class="cat-grid">
      <article v-for="(c, i) in cats" :key="`${c.category}-${i}`" class="cat" :class="`edge-${verdictTone(c.category_result)}`">
        <header>
          <h3>{{ c.category }}</h3>
          <span class="col-pill" :class="`tone-${verdictTone(c.category_result)}`">{{ verdictLabel(c.category_result) }}</span>
        </header>
        <div class="cat-score col-mono">{{ c.earned_score }} <small>/ {{ c.total_weight }}</small></div>
        <div class="bar"><span :style="{ width: `${c.total_weight ? Math.min(100, c.earned_score / c.total_weight * 100) : 0}%` }"></span></div>
        <p v-if="c.fail_reason" class="col-muted">{{ c.fail_reason }}</p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone, verdictLabel } from '../../utils/collectionReport.js'
const props = defineProps({ report: { type: Object, required: true } })
const cats = computed(() => props.report.category_summary || [])
</script>

<style scoped>
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.cat { border: 1px solid var(--border); border-left-width: 4px; border-radius: 12px; padding: 12px; display: grid; gap: 6px; }
.cat.edge-success { border-left-color: var(--green); } .cat.edge-danger { border-left-color: var(--red); } .cat.edge-muted { border-left-color: #C5C6CA; }
.cat header { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.cat h3 { margin: 0; font-size: 12px; font-weight: 700; line-height: 1.35; color: var(--text); }
.cat-score { font-size: 20px; font-weight: 800; }
.cat-score small { font-size: 12px; color: var(--gray); font-weight: 500; }
.bar { height: 6px; background: #EEEFF1; border-radius: 999px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--mega-gradient); }
</style>
