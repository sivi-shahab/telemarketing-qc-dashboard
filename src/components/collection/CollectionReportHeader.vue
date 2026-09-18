<template>
  <!-- Ringkasan Penilaian AI — pola tabel perhitungan Cashline: skor maksimal
       (dengan konteks agunan yang menentukannya), skor audit, passing grade, hasil. -->
  <div class="block">
    <div class="block-head">
      <span class="block-title">Ringkasan Penilaian AI</span>
      <span class="badge tone-muted">POJK 22/2023 Weighted Audit</span>
    </div>
    <table class="calc-tbl">
      <thead>
        <tr>
          <th>Keterangan</th>
          <th class="num">Hasil</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <span class="ct-name">Skor Maksimal Evaluasi</span>
            <div class="ct-reason">
              {{ report.agunan_discussion_status === 'NOT_INITIATED'
                ? 'Kategori "Prosedur Penarikan Agunan" (16 poin) dieksklusi dari perhitungan karena topik agunan tidak dibahas.'
                : 'Kategori "Prosedur Penarikan Agunan" (16 poin) diikutsertakan secara penuh.' }}
            </div>
          </td>
          <td class="ct-result">{{ report.maximum_score ?? '—' }}</td>
        </tr>
        <tr>
          <td><span class="ct-name">Total Skor Audit</span></td>
          <td class="ct-result">{{ report.ai_score_phase_2 ?? '—' }}</td>
        </tr>
        <tr>
          <td>
            <span class="ct-name">Passing Grade</span>
            <div class="ct-reason">Skor audit tercapai {{ percent }}% dari skor maksimal.</div>
          </td>
          <td class="ct-result">{{ report.passing_grade ?? '—' }}</td>
        </tr>
        <tr class="row-total">
          <td><span class="ct-name">Hasil</span></td>
          <td class="ct-result">
            <span class="badge" :class="isPass ? 'tone-success' : 'tone-danger'">{{ isPass ? 'PASS' : 'FAIL' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="block">
    <div class="block-title">Data Audit</div>
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">ID Panggilan</div>
        <div class="meta-value mono small">{{ report.call_id || '—' }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Agent</div>
        <div class="meta-value">{{ report.agent_name || '—' }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Konsumen</div>
        <div class="meta-value">{{ report.consumer_full_name || '—' }}</div>
      </div>
      <div v-if="report.product_type" class="meta-item">
        <div class="meta-label">Produk</div>
        <div class="meta-value">{{ report.product_type }}</div>
      </div>
      <div v-if="campaign" class="meta-item">
        <div class="meta-label">Campaign</div>
        <div class="meta-value">{{ campaign }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Pembahasan Agunan</div>
        <div class="meta-value">{{ report.agunan_discussion_status ? verdictLabel(report.agunan_discussion_status) : '—' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { scorePercent, verdictLabel } from '../../utils/collectionReport.js'

const props = defineProps({ report: { type: Object, required: true }, campaign: { type: String, default: '' } })
const percent = computed(() => Math.round(scorePercent(props.report)))
const isPass = computed(() => props.report.ai_status === 'PASS')
</script>

<style scoped>
/* Disalin dari .calc-tbl di EvaluationView.vue (Cashline). */
.calc-tbl {
  width: 100%; max-width: 680px; border-collapse: collapse;
  background: #f8fafc; border: 1px solid var(--border); border-radius: 10px;
}
.calc-tbl th {
  background: #f1f5f9; padding: 9px 14px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted);
  border-bottom: 1px solid var(--border); text-align: left;
}
.calc-tbl th.num { text-align: right; }
.calc-tbl td { padding: 10px 14px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
.calc-tbl tr:last-child td { border-bottom: none; }
.ct-name { font-size: 13px; font-weight: 600; color: var(--text); }
.ct-reason { font-size: 12px; color: var(--text-muted); line-height: 1.45; margin-top: 4px; }
.ct-result { font-size: 14px; font-weight: 700; color: var(--text); white-space: nowrap; text-align: right; width: 90px; }
.row-total td { border-top: 2px double var(--text-muted); }
.row-total .ct-name { font-weight: 700; }
.row-total .ct-result { background: #eef2f6; }
.meta-value.small { font-size: 13px; }
</style>
