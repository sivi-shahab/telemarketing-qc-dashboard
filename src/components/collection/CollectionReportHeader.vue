<template>
  <div class="col-card header">
    <div class="hdr-main">
      <div class="hdr-meta">
        <span class="col-pill tone-muted col-mono">ID: {{ report.call_id }}</span>
        <span v-if="report.product_type" class="col-pill tone-muted">Produk: {{ report.product_type }}</span>
        <span class="col-pill tone-muted">{{ campaign }}</span>
      </div>
      <h1>Hasil Audit Berbobot Kepatuhan Penagihan</h1>
      <div class="hdr-people">
        <span>Agent: <b>{{ report.agent_name || '—' }}</b></span>
        <span>Konsumen: <b>{{ report.consumer_full_name || '—' }}</b></span>
        <span>Topik Agunan: <b>{{ verdictLabel(report.agunan_discussion_status) }}</b></span>
      </div>
    </div>

    <div class="hdr-score">
      <div class="score-block">
        <div class="score-k">Total Skor Audit</div>
        <div class="score-v col-mono">{{ report.ai_score_phase_2 }} <small>/ {{ report.maximum_score }}</small></div>
        <div class="score-bar" role="meter" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
          <span class="fill" :class="`tone-${verdictTone(report.ai_status)}`" :style="{ width: `${Math.min(percent, 100)}%` }"></span>
          <span class="grade" :style="{ left: '90%' }" title="Passing grade 90%"></span>
        </div>
        <div class="col-muted">Passing Grade: <b>{{ report.passing_grade }}</b> · {{ percent }}%</div>
      </div>
      <div class="verdict" :class="`tone-${verdictTone(report.ai_status)}`">
        <span class="verdict-v">{{ report.ai_status }}</span>
        <span class="verdict-k">{{ report.ai_status === 'PASS' ? 'Memenuhi Syarat' : 'Tidak Lulus' }}</span>
      </div>
    </div>

    <div class="hdr-grid">
      <div class="sub">
        <div class="sub-k">Status Komitmen Konsumen (Consumer Commitment)</div>
        <span class="col-pill" :class="`tone-${commitment.tone}`">{{ commitment.label }}</span>
        <p class="sub-text">{{ report.commitment_status.reason || '—' }}</p>
        <div v-if="formatEvidence(report.commitment_status.evidence)" class="col-quote">{{ formatEvidence(report.commitment_status.evidence) }}</div>
      </div>
      <div class="sub">
        <div class="sub-k">Konteks Diskusi Agunan &amp; Maksimal Skor</div>
        <div class="kv"><span>Status Pembahasan Agunan</span><b>{{ verdictLabel(report.agunan_discussion_status) }}</b></div>
        <div class="kv"><span>Skor Maksimal Evaluasi</span><b>{{ report.maximum_score }} poin</b></div>
        <p class="col-muted">
          {{ report.agunan_discussion_status === 'NOT_INITIATED'
            ? 'Kategori "Prosedur Penarikan Agunan" (16 poin) dieksklusi dari perhitungan karena topik agunan tidak dibahas.'
            : 'Kategori "Prosedur Penarikan Agunan" (16 poin) diikutsertakan secara penuh.' }}
        </p>
      </div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-k">Ringkasan Eksekutif Audit AI (Executive Summary)</div>
    <p>{{ report.ai_summary || 'Model tidak mengembalikan ringkasan.' }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { verdictTone, verdictLabel, commitmentBadge, scorePercent, formatEvidence } from '../../utils/collectionReport.js'

const props = defineProps({ report: { type: Object, required: true }, campaign: { type: String, default: '' } })
const percent = computed(() => scorePercent(props.report))
const commitment = computed(() => commitmentBadge(props.report.commitment_status?.status))
</script>

<style scoped>
.header { display: grid; gap: 18px; }
.hdr-main h1 { margin: 8px 0 6px; font-size: 22px; font-weight: 800; color: var(--text); }
.hdr-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.hdr-people { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 13px; color: var(--mega-gray-600); }
.hdr-people b { color: var(--text); }
.hdr-score { display: flex; flex-wrap: wrap; align-items: stretch; gap: 14px; background: #FAFBFC; border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
.score-block { flex: 1; min-width: 220px; display: grid; gap: 6px; }
.score-k, .sub-k, .summary-k { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: var(--text-muted); }
.score-v { font-size: 30px; font-weight: 800; color: var(--text); }
.score-v small { font-size: 16px; color: var(--gray); font-weight: 500; }
.score-bar { position: relative; height: 8px; background: var(--border); border-radius: 999px; overflow: visible; }
.score-bar .fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; }
.score-bar .fill.tone-success { background: var(--green); } .score-bar .fill.tone-danger { background: var(--red); } .score-bar .fill.tone-muted { background: var(--gray); }
.score-bar .grade { position: absolute; top: -4px; width: 2px; height: 16px; background: var(--text); }
.verdict { min-width: 130px; display: grid; place-content: center; text-align: center; border-radius: 12px; color: #fff; padding: 10px 18px; }
.verdict.tone-success { background: var(--green); } .verdict.tone-danger { background: var(--red); } .verdict.tone-muted { background: var(--text-muted); }
.verdict-v { font-size: 22px; font-weight: 800; letter-spacing: .08em; }
.verdict-k { font-size: 10px; text-transform: uppercase; font-weight: 600; opacity: .9; }
.hdr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.sub { background: #FAFBFC; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; display: grid; gap: 6px; align-content: start; }
.sub-text { margin: 0; font-size: 12px; color: #4A4B4E; line-height: 1.5; }
.kv { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #EEEFF1; }
.summary { margin-top: 16px; border-radius: 14px; padding: 18px 22px; color: #e2e8f0; background: linear-gradient(90deg, #0b1f3a 0%, var(--text) 100%); }
.summary-k { color: var(--mega-gold); margin-bottom: 6px; }
.summary p { margin: 0; font-size: 14px; line-height: 1.6; }
</style>
