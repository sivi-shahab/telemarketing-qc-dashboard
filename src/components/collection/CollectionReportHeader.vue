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
            <div v-if="cases.length" class="ct-reason">
              Standard Penagihan + Etika Penagihan. Item opsional adalah bonus; ambang lulus dihitung dari
              bobot item wajib ({{ report.base_maximum_score ?? '—' }} poin).
            </div>
            <div v-else class="ct-reason">
              {{ report.agunan_discussion_status === 'NOT_INITIATED'
                ? 'Kategori "Prosedur Penarikan Agunan" (16 poin) dieksklusi dari perhitungan karena topik agunan tidak dibahas.'
                : 'Kategori "Prosedur Penarikan Agunan" (16 poin) diikutsertakan secara penuh.' }}
            </div>
          </td>
          <td class="ct-result">{{ report.maximum_score ?? '—' }}</td>
        </tr>
        <tr v-for="c in cases" :key="c.case" class="row-case">
          <td>
            <span class="ct-name">{{ caseLabel(c.case) }}</span>
            <span class="badge case-badge" :class="`tone-${verdictTone(c.case_result)}`">{{ verdictLabel(c.case_result) }}</span>
            <div class="ct-reason">
              Item wajib {{ c.mandatory_earned }} / {{ c.mandatory_weight }} · bonus opsional {{ c.optional_earned }}
              <template v-if="c.case === 'etika_penagihan'"> · satu item etika Belum Sesuai menolkan Total Skor Audit</template>
            </div>
          </td>
          <td class="ct-result">{{ c.case_points }} / {{ c.max_points }}</td>
        </tr>
        <tr>
          <td>
            <span class="ct-name">Total Skor Audit</span>
            <div v-if="etikaGated" class="ct-reason ct-danger">
              Dinolkan karena ada pelanggaran Etika Penagihan (sebelum gerbang: {{ rawTotal }}).
            </div>
          </td>
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
      <div v-if="!cases.length" class="meta-item">
        <div class="meta-label">Pembahasan Agunan</div>
        <div class="meta-value">{{ report.agunan_discussion_status ? verdictLabel(report.agunan_discussion_status) : '—' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { caseLabel, caseSummary, scorePercent, verdictLabel, verdictTone } from '../../utils/collectionReport.js'

const props = defineProps({ report: { type: Object, required: true }, campaign: { type: String, default: '' } })
const cases = computed(() => caseSummary(props.report))
const etikaGated = computed(() => cases.value.some(c => c.case === 'etika_penagihan' && c.case_result === 'FAIL'))
const rawTotal = computed(() => Math.round(cases.value.reduce((n, c) => n + (Number(c.case_points) || 0), 0) * 10) / 10)
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
.row-case .ct-name { padding-left: 12px; }
.case-badge { margin-left: 8px; font-size: 11px; }
.ct-danger { color: var(--red); }
</style>
