<template>
  <div class="col-card">
    <div class="col-card-head">
      <div class="head-title">
        <ColIcon name="scale" class="head-icon" />
        <div>
          <h2>Ringkasan Nilai Per Kategori (9 Kategori POJK 22)</h2>
          <p>Pencapaian skor per kategori dan aturan toleransi penagihan</p>
        </div>
      </div>
    </div>
    <p v-if="!cats.length" class="col-muted">Model tidak mengembalikan ringkasan kategori.</p>
    <div v-else class="cat-grid">
      <article v-for="(c, i) in cats" :key="`${c.category}-${i}`" class="cat" :class="{ fail: c.category_result === 'FAIL' }">
        <div>
          <header>
            <h3>{{ c.category }}</h3>
            <span class="res" :class="`tone-${verdictTone(c.category_result)}`">
              {{ c.category_result === 'TIDAK_TERSEDIA' || !c.category_result ? 'N/A' : c.category_result }}
            </span>
          </header>
          <div class="earned">
            <span>Earned Score:</span>
            <b class="col-mono">{{ c.earned_score }} <small>/ {{ c.total_weight }}</small></b>
          </div>
          <div class="bar"><span :class="`tone-${verdictTone(c.category_result)}`" :style="{ width: `${pct(c)}%` }"></span></div>
        </div>
        <p v-if="c.fail_reason" class="fail-reason">⚠️ {{ c.fail_reason }}</p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone } from '../../utils/collectionReport.js'
import ColIcon from './ColIcon.vue'
const props = defineProps({ report: { type: Object, required: true } })
const cats = computed(() => props.report.category_summary || [])
const pct = c => (c.total_weight > 0 ? Math.min(100, Math.max(0, Math.round(c.earned_score / c.total_weight * 100))) : 0)
</script>

<style scoped>
.head-title { display: flex; align-items: center; gap: 10px; }
.head-icon { color: var(--mega-orange); }
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.cat { display: flex; flex-direction: column; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: #FAFBFC; }
.cat.fail { background: #FDF6F6; border-color: #f0bcbc; }
.cat header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.cat h3 { margin: 0; font-size: 12px; font-weight: 700; line-height: 1.35; color: var(--text); }
.res { padding: 1px 8px; font-size: 10px; font-weight: 800; border-radius: 4px; }
.res.tone-success { background: var(--green-bg); color: var(--green); }
.res.tone-danger { background: var(--red-bg); color: var(--red); }
.res.tone-muted { background: var(--border); color: var(--mega-gray-600); }
.earned { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.earned span { font-size: 11px; font-weight: 500; color: var(--mega-gray-600); }
.earned b { font-size: 14px; color: var(--text); }
.earned small { font-size: 12px; font-weight: 400; color: var(--gray); }
.bar { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; margin-bottom: 8px; }
.bar span { display: block; height: 100%; border-radius: 999px; }
.bar .tone-success { background: var(--green); } .bar .tone-danger { background: var(--red); } .bar .tone-muted { background: var(--gray); }
.fail-reason { margin: 8px 0 0; padding-top: 8px; border-top: 1px solid #f0bcbc; font-size: 11px; font-weight: 500; line-height: 1.35; color: #9f2a2a; }
</style>
