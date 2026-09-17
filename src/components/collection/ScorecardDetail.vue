<template>
  <div class="col-card sc">
    <div class="col-card-head sc-head">
      <div>
        <h2>Rincian Evaluasi Scorecard Berbobot ({{ items.length }} Indikator)</h2>
        <p>Lihat bukti transkrip, skor per item, dan alasan evaluasi kepatuhan</p>
      </div>
      <label class="search">
        <ColIcon name="search" class="search-icon" />
        <input v-model="query" type="text" placeholder="Cari indikator / kode..." />
      </label>
    </div>

    <div class="tabs">
      <button type="button" :class="{ on: category === '' }" @click="category = ''">Semua Kategori ({{ items.length }})</button>
      <button v-for="c in categories" :key="c" type="button" :class="{ on: category === c }" @click="category = c">{{ c }}</button>
    </div>

    <div class="list">
      <div v-if="!filtered.length" class="empty">Tidak ada indikator yang cocok dengan pencarian / filter kategori.</div>
      <div v-for="(it, i) in filtered" :key="`${it.item_code}-${i}`" class="ind" :class="statusClass(it.status)">
        <div
          class="ind-head" role="button" tabindex="0" :aria-expanded="isOpen(it)"
          @click="toggle(it)" @keydown.enter.prevent="toggle(it)" @keydown.space.prevent="toggle(it)"
        >
          <div class="ind-left">
            <span class="code col-mono">{{ it.item_code }}</span>
            <div>
              <div class="ind-tags">
                <span class="cat">{{ it.category }}</span>
                <span class="weight">Bobot: {{ it.weight }} pt</span>
                <span v-if="it.tolerable === 'NO'" class="critical">Toleransi: NO (Critical)</span>
              </div>
              <h3>{{ it.requirement }}</h3>
            </div>
          </div>
          <div class="ind-right">
            <div class="score">
              <span class="status">{{ it.status }}</span>
              <div class="col-mono">Skor: <b>{{ it.item_score ?? '-' }}</b></div>
            </div>
            <ColIcon :name="isOpen(it) ? 'chevronUp' : 'chevronDown'" class="chev" />
          </div>
        </div>

        <div v-if="isOpen(it)" class="ind-body">
          <div>
            <span class="lbl">Alasan Evaluasi AI:</span>
            <p>{{ it.reason }}</p>
          </div>
          <div v-if="it.evidence && (it.evidence.quote || it.evidence.timestamp)">
            <span class="lbl">Bukti Verbatim Transkrip:</span>
            <div class="quote col-mono">
              "{{ it.evidence.quote || 'Tidak ditemukan segment spesifik' }}"
              <span v-if="it.evidence.timestamp" class="ts">[{{ it.evidence.timestamp }}]</span>
            </div>
          </div>
          <p v-if="it.kb_reference" class="kb">Referensi KB: <span class="col-mono">{{ it.kb_reference }}</span></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { scorecardCategories, filterScorecard } from '../../utils/collectionReport.js'
import ColIcon from './ColIcon.vue'

const props = defineProps({ report: { type: Object, required: true } })
const category = ref('')
const query = ref('')
const expanded = reactive({})

const items = computed(() => props.report.scorecard_result || [])
const categories = computed(() => scorecardCategories(items.value))
const filtered = computed(() => filterScorecard(items.value, category.value, query.value))

const isOpen = it => !!expanded[it.item_code]
const toggle = it => { expanded[it.item_code] = !expanded[it.item_code] }
const statusClass = s => ({ SESUAI: 'sesuai', BELUM_SESUAI: 'belum' })[s] || 'lain'
</script>

<style scoped>
.sc { display: grid; gap: 16px; }
.sc-head { flex-wrap: wrap; align-items: center; margin-bottom: 0; }
.search { position: relative; width: 256px; max-width: 100%; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--gray); }
.search input { width: 100%; box-sizing: border-box; padding: 6px 12px 6px 34px; font-size: 12px; background: #FAFBFC; border: 1px solid var(--border); border-radius: 12px; outline: none; }
.search input:focus { box-shadow: 0 0 0 2px var(--mega-orange); }
.tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; }
.tabs button { flex-shrink: 0; border: 0; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 8px; white-space: nowrap; cursor: pointer; background: #F4F5F6; color: var(--mega-gray-600); }
.tabs button:hover { background: var(--border); }
.tabs button.on { background: #002D62; color: #fff; }
.list { display: grid; gap: 12px; }
.empty { padding: 32px; text-align: center; font-size: 12px; font-weight: 500; color: var(--gray); }
.ind { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #fff; }
.ind.sesuai:hover { border-color: #C5C6CA; }
.ind.belum { border-color: #f0bcbc; background: #FEF9F9; }
.ind.belum:hover { border-color: #e59a9a; }
.ind.lain { background: #FAFBFC; }
.ind-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px; cursor: pointer; user-select: none; }
.ind-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.code { flex-shrink: 0; padding: 4px 8px; font-size: 12px; font-weight: 800; background: #F4F5F6; color: var(--text); border: 1px solid var(--border); border-radius: 6px; }
.ind-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 4px; }
.cat { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--gray); }
.weight { font-size: 10px; font-weight: 700; color: #4A4B4E; background: #F4F5F6; padding: 1px 6px; border-radius: 4px; }
.critical { font-size: 9px; font-weight: 700; color: var(--red); background: var(--red-bg); padding: 1px 6px; border-radius: 4px; }
.ind h3 { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.35; color: var(--text); }
.ind-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.score { text-align: right; font-size: 11px; color: var(--mega-gray-600); }
.score b { color: var(--text); }
.status { display: inline-block; padding: 3px 10px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1px solid var(--border); background: #F4F5F6; color: var(--mega-gray-600); margin-bottom: 2px; }
.ind.sesuai .status { background: var(--green-bg); color: var(--green); border-color: #b7dfc6; }
.ind.belum .status { background: var(--red-bg); color: var(--red); border-color: #f0bcbc; }
.chev { color: var(--gray); }
.ind-body { padding: 8px 16px 16px; border-top: 1px solid #EEEFF1; background: #FAFBFC; display: grid; gap: 8px; }
.lbl { display: block; margin-bottom: 2px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--mega-gray-600); }
.ind-body p { margin: 0; font-size: 12px; font-weight: 500; line-height: 1.6; color: var(--text); }
.quote { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; color: var(--text); }
.ts { margin-left: 6px; font-size: 10px; font-weight: 700; background: var(--mega-orange); color: #fff; padding: 1px 6px; border-radius: 4px; }
.ind-body .kb { font-size: 11px; color: var(--mega-gray-600); }
@media (max-width: 720px) {
  .ind-head { align-items: flex-start; }
  .ind h3 { font-size: 12px; }
}
</style>
