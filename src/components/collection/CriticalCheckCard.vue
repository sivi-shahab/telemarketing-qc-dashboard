<template>
  <div class="col-card">
    <div class="col-card-head">
      <div class="head-title">
        <ColIcon name="shield" class="head-icon" :class="`fg-${toneOf(check.status)}`" />
        <div>
          <h2>Pemeriksaan Kepatuhan Kritis (Critical Compliance Check)</h2>
          <p>Evaluasi indikator utama berisiko sanksi OJK (Pasal 62 &amp; Pasal 22)</p>
        </div>
      </div>
      <!-- TIDAK_TERSEDIA = model tidak memberi verdict yang bisa dibaca; sengaja
           netral, tidak boleh tampak lulus maupun gagal. -->
      <span class="col-pill" :class="`tone-${toneOf(check.status)}`">CRITICAL CHECK: {{ rawLabel(check.status) }}</span>
    </div>

    <div v-if="!check.checked_items?.length" class="empty">
      Rincian pemeriksaan kepatuhan kritis tidak tersedia untuk audit ini. Model tidak mengembalikan
      daftar <span class="col-mono">checked_items</span> dalam format yang dapat dibaca, sehingga
      status PASS/FAIL per indikator tidak dapat ditampilkan.
    </div>
    <div v-else class="crit-grid">
      <div v-for="(it, i) in check.checked_items" :key="`${it.item_code}-${i}`" class="crit" :class="`tone-${toneOf(it.status)}`">
        <ColIcon :name="iconOf(it.status)" class="crit-icon" />
        <div>
          <div class="crit-top">
            <span class="col-mono code">{{ it.item_code }}</span>
            <span class="tag">{{ rawLabel(it.status) }}</span>
          </div>
          <p>{{ it.requirement || '—' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone } from '../../utils/collectionReport.js'
import ColIcon from './ColIcon.vue'

const props = defineProps({ report: { type: Object, required: true } })
const check = computed(() => props.report.critical_compliance_check || { status: null, checked_items: [] })
const toneOf = verdictTone
const iconOf = s => ({ success: 'check', danger: 'x' })[verdictTone(s)] || 'minus'
const rawLabel = s => (s ? String(s).replace(/_/g, ' ') : '—')
</script>

<style scoped>
.head-title { display: flex; align-items: center; gap: 10px; }
.head-icon { width: 24px; height: 24px; }
.fg-success { color: var(--green); } .fg-danger { color: var(--red); } .fg-muted { color: var(--gray); }
.empty { background: #FAFBFC; border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; font-size: 12px; font-weight: 500; color: var(--mega-gray-600); }
.crit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.crit { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid; border-radius: 12px; }
.crit.tone-success { background: #F2FAF5; border-color: #b7dfc6; color: #14532d; }
.crit.tone-danger { background: #FDF3F3; border-color: #f0bcbc; color: #7f1d1d; }
.crit.tone-muted { background: #FAFBFC; border-color: var(--border); color: #4A4B4E; }
.crit-icon { margin-top: 2px; }
.crit.tone-success .crit-icon { color: var(--green); } .crit.tone-danger .crit-icon { color: var(--red); } .crit.tone-muted .crit-icon { color: var(--gray); }
.crit-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.code { font-size: 12px; font-weight: 700; padding: 1px 6px; background: #fff; border: 1px solid var(--border); border-radius: 4px; color: var(--text); }
.tag { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 8px; border-radius: 4px; }
.crit.tone-success .tag { background: #b7dfc6; } .crit.tone-danger .tag { background: #f0bcbc; } .crit.tone-muted .tag { background: var(--border); }
.crit p { margin: 0; font-size: 12px; font-weight: 500; line-height: 1.4; }
</style>
