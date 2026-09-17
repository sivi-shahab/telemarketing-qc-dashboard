<template>
  <div class="col-card header">
    <div class="hdr-top">
      <div class="hdr-main">
        <div class="hdr-meta">
          <span class="chip chip-brand">POJK 22/2023 Weighted Audit</span>
          <span class="chip chip-muted col-mono">ID: {{ report.call_id }}</span>
          <span v-if="report.product_type" class="chip chip-info">Produk: {{ report.product_type }}</span>
          <span v-if="campaign" class="chip chip-muted">{{ campaign }}</span>
        </div>
        <h1>Hasil Audit Berbobot Kepatuhan Penagihan</h1>
        <div class="hdr-people">
          <span>Agent: <b>{{ report.agent_name || '—' }}</b></span>
          <span>Konsumen: <b>{{ report.consumer_full_name || '—' }}</b></span>
          <span>Topik Agunan: <b>{{ report.agunan_discussion_status || '—' }}</b></span>
        </div>
      </div>

      <div class="hdr-score">
        <div class="score-block">
          <div class="score-k">Total Skor Audit</div>
          <div class="score-v col-mono">{{ report.ai_score_phase_2 }} <small>/ {{ report.maximum_score }}</small></div>
          <div class="score-grade">Passing Grade: <b>{{ report.passing_grade }}</b> ({{ percent }}%)</div>
        </div>
        <div class="verdict" :class="isPass ? 'pass' : 'fail'">
          <ColIcon :name="isPass ? 'check' : 'x'" class="verdict-icon" />
          <span class="verdict-v">{{ isPass ? 'PASS' : 'FAIL' }}</span>
          <span class="verdict-k">{{ isPass ? 'Memenuhi Syarat' : 'Tidak Lulus' }}</span>
        </div>
      </div>
    </div>

    <div class="hdr-grid">
      <div class="sub">
        <div class="sub-k"><ColIcon name="award" class="ico-orange" /> Status Komitmen Konsumen (Consumer Commitment)</div>
        <div><span class="badge" :class="`tone-${commitment.tone}`">{{ commitment.label }}</span></div>
        <p class="sub-text">{{ report.commitment_status?.reason }}</p>
        <div v-if="report.commitment_status?.evidence?.quote" class="quote">
          "{{ report.commitment_status.evidence.quote }}"
          <span v-if="report.commitment_status.evidence.timestamp" class="ts">[{{ report.commitment_status.evidence.timestamp }}]</span>
        </div>
      </div>
      <div class="sub">
        <div class="sub-k"><ColIcon name="info" class="ico-blue" /> Konteks Diskusi Agunan &amp; Maksimal Skor</div>
        <div class="kv">
          <span>Status Pembahasan Agunan:</span>
          <b class="kv-tag" :class="{ amber: report.agunan_discussion_status === 'INITIATED' }">{{ report.agunan_discussion_status || '—' }}</b>
        </div>
        <div class="kv"><span>Skor Maksimal Evaluasi:</span><b>{{ report.maximum_score }} poin</b></div>
        <p class="note">
          {{ report.agunan_discussion_status === 'NOT_INITIATED'
            ? 'Kategori "Prosedur Penarikan Agunan" (16 poin) dieksklusi dari perhitungan karena topik agunan tidak dibahas.'
            : 'Kategori "Prosedur Penarikan Agunan" (16 poin) diikutsertakan secara penuh.' }}
        </p>
      </div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-k"><ColIcon name="file" /> Ringkasan Eksekutif Audit AI (Executive Summary)</div>
    <p>{{ report.ai_summary || 'Model tidak mengembalikan ringkasan.' }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { commitmentBadge, scorePercent } from '../../utils/collectionReport.js'
import ColIcon from './ColIcon.vue'

const props = defineProps({ report: { type: Object, required: true }, campaign: { type: String, default: '' } })
const percent = computed(() => Math.round(scorePercent(props.report)))
const isPass = computed(() => props.report.ai_status === 'PASS')
const commitment = computed(() => commitmentBadge(props.report.commitment_status?.status))
</script>

<style scoped>
.header { display: grid; gap: 0; }
.hdr-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid #EEEFF1; }
.hdr-main { display: grid; gap: 8px; min-width: 0; }
.hdr-main h1 { margin: 0; font-size: 22px; font-weight: 800; color: var(--text); }
.hdr-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); }
.chip-brand { background: #002D62; color: #fff; border-color: #002D62; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.chip-muted { background: #F4F5F6; color: #4A4B4E; }
.chip-info { background: var(--m-info-soft, #E2EDF7); color: var(--m-info, #2C6CB0); border-color: #bcd3ea; }
.hdr-people { display: flex; flex-wrap: wrap; gap: 4px 24px; font-size: 13px; font-weight: 500; color: var(--mega-gray-600); }
.hdr-people b { color: var(--text); }
.hdr-score { display: flex; align-items: center; gap: 20px; background: #FAFBFC; border: 1px solid var(--border); border-radius: 16px; padding: 16px 20px; }
.score-block { text-align: right; }
.score-k, .sub-k, .summary-k { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: var(--mega-gray-600); }
.score-v { font-size: 30px; font-weight: 800; color: var(--text); }
.score-v small { font-size: 18px; color: var(--gray); font-weight: 400; }
.score-grade { font-size: 12px; color: var(--mega-gray-600); margin-top: 2px; }
.verdict { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-radius: 12px; color: #fff; padding: 12px 20px; font-weight: 700; }
.verdict.pass { background: var(--green); box-shadow: 0 8px 18px rgba(31,138,76,.25); }
.verdict.fail { background: var(--red); box-shadow: 0 8px 18px rgba(199,56,56,.25); }
.verdict-icon { width: 32px; height: 32px; margin-bottom: 4px; }
.verdict-v { font-size: 18px; letter-spacing: .08em; }
.verdict-k { font-size: 10px; text-transform: uppercase; font-weight: 600; opacity: .9; }
.hdr-grid { margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.sub { background: #FAFBFC; border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: grid; gap: 8px; align-content: start; }
.sub-k { display: flex; align-items: center; gap: 6px; }
.sub-k .col-icon { width: 16px; height: 16px; }
.ico-orange { color: var(--mega-orange); } .ico-blue { color: var(--m-info, #2C6CB0); }
.badge { display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1px solid; }
.badge.tone-success { background: var(--green-bg); color: var(--green); border-color: #b7dfc6; }
.badge.tone-info { background: var(--m-info-soft, #E2EDF7); color: var(--m-info, #2C6CB0); border-color: #bcd3ea; }
.badge.tone-warning { background: var(--yellow-bg); color: var(--yellow); border-color: #f0dca0; }
.badge.tone-danger { background: var(--red-bg); color: var(--red); border-color: #f0bcbc; }
.badge.tone-muted { background: #EEEFF1; color: var(--mega-gray-600); border-color: var(--border); }
.sub-text { margin: 0; font-size: 12px; font-weight: 500; color: #4A4B4E; line-height: 1.55; }
.quote { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; font-style: italic; font-family: var(--font-mono); color: var(--text); }
.ts { margin-left: 6px; font-style: normal; font-size: 10px; font-weight: 700; background: #EEEFF1; color: var(--mega-gray-600); padding: 1px 6px; border-radius: 4px; }
.kv { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #EEEFF1; }
.kv span { color: var(--mega-gray-600); }
.kv-tag { padding: 1px 8px; border-radius: 4px; background: #E4E5E8; }
.kv-tag.amber { background: var(--yellow-bg); color: var(--yellow); }
.note { margin: 0; font-size: 11px; color: var(--mega-gray-600); line-height: 1.5; }
.summary { margin-top: 16px; border-radius: 16px; padding: 22px 24px; color: #e2e8f0; background: linear-gradient(90deg, #0b1f3a 0%, #1e293b 100%); box-shadow: 0 6px 16px rgba(11,31,58,.2); }
.summary-k { display: flex; align-items: center; gap: 8px; color: #FF9E4A; font-size: 13px; margin-bottom: 8px; }
.summary p { margin: 0; font-size: 14px; line-height: 1.65; }
@media (max-width: 720px) { .hdr-score { width: 100%; justify-content: space-between; } }
</style>
