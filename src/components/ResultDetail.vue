<template>
  <div class="result-detail">
    <!-- Agent Error Summary + catatan QC disetujui (SPQ Head & Sales Agent/Team
         Leader). Persis pola versi A: AgentErrorTable dulu, baru evaluasi. -->
    <template v-if="showAgentSummary">
      <div v-if="loadingAgent" class="result-loading">
        <span class="spinner"></span> Memuat agent summary...
      </div>
      <AgentErrorTable v-else-if="agentSummary" :summary="agentSummary" />

      <!-- Approved QC note (role Sales Agent/Team Leader): alasan QC di balik
           perubahan AI Status yang sudah disetujui SPQ Head. -->
      <div
        v-if="isSimpleViewer && item.qc_request?.approval_status === 'approved'"
        class="qc-approval-note"
      >
        <div class="qan-title">📝 Catatan QC (Disetujui SPQ Head)</div>
        <p class="qan-reason">{{ item.qc_request.reason || '—' }}</p>
        <div class="qan-meta">
          Status:
          <span :class="['status-badge', item.qc_request.requested_status === 'PASS' ? 'badge-green' : 'badge-red']">
            {{ aiStatusLabel(item.qc_request.requested_status) }}
          </span>
          <span v-if="item.qc_request.reviewed_by_username" class="qan-reviewer">
            · Disetujui oleh {{ item.qc_request.reviewed_by_username }}
            <template v-if="item.qc_request.reviewed_at"> · {{ formatDate(item.qc_request.reviewed_at) }}</template>
          </span>
        </div>
      </div>
    </template>

    <!-- Evaluasi lengkap: Ringkasan Penilaian AI, Executive Summary, Scorecard,
         Transkrip PDF (via PdfViewer di dalam EvaluationView), modal banding
         per-error-code -- SEMUA sudah ditangani EvaluationView sendiri, tidak
         direimplementasi di sini. hide-error-code=true karena AgentErrorTable
         di atas sudah cover kebutuhan serupa untuk role ini (mirror versi A). -->
    <div v-if="loadingResult" class="result-loading">
      <span class="spinner"></span> Memuat hasil...
    </div>
    <div v-else-if="result?.status === 'done' && result?.result">
      <EvaluationView
        :result="result.result"
        :hide-error-code="true"
        :result-id="item.result_id"
        :display-id="item.id"
        @appeal-changed="onAppealChanged"
      >
        <template #after-exec-summary>
          <DocumentsSection
            v-if="item.has_documents"
            :result-id="item.result_id"
            :evaluation="result.result.evaluation || null"
          />
        </template>
      </EvaluationView>
    </div>
    <div v-else-if="result?.status === 'failed'" class="result-failed">
      ✗ Gagal: {{ result?.error || 'Unknown error' }}
    </div>
    <div v-else-if="result" class="result-pending">
      <span class="spinner"></span>
      Status: <strong>{{ result?.status }}</strong> — hasil belum tersedia.
    </div>

    <!-- Fallback: dokumen tetap terlihat walau evaluasi belum ada (belum done). -->
    <DocumentsSection
      v-if="item.has_documents && !(result?.status === 'done' && result?.result)"
      :result-id="item.result_id"
    />
  </div>
</template>

<script setup>
// Compose komponen yang SUDAH TERUJI di produksi (versi A) -- ResultDetail ini
// TIDAK mereimplementasi tampilan evaluasi/dokumen/agent-summary sendiri.
import EvaluationView from './EvaluationView.vue'
import DocumentsSection from './DocumentsSection.vue'
import AgentErrorTable from './AgentErrorTable.vue'
import { aiStatusLabel } from '../utils/aiStatus.js'

const props = defineProps({
  item: { type: Object, required: true },
  result: { type: Object, default: null },
  loadingResult: { type: Boolean, default: false },
  agentSummary: { type: Object, default: null },
  loadingAgent: { type: Boolean, default: false },
  showAgentSummary: { type: Boolean, default: false },
  isSimpleViewer: { type: Boolean, default: false },
})

// EvaluationView emit 'appeal-changed' dengan resultId (banding PER ERROR CODE,
// beda dari ManualCheckModal/QcApprovalModal di ResultsView yang urus USULAN
// STATUS AI KESELURUHAN -- dua sistem banding terpisah, jangan tertukar).
const emit = defineEmits(['appeal-changed'])
function onAppealChanged(resultId) {
  emit('appeal-changed', resultId || props.item.result_id)
}

function formatDate(iso) {
  if (!iso) return '—'
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}
</script>

<style scoped>
/* Disalin persis dari ResultsView.vue A -- supaya tampilan identik dengan yang
   sudah terbukti bekerja di produksi. */
.result-detail { display: flex; flex-direction: column; gap: 4px; }

.result-loading, .result-pending {
  display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 13px;
}
.result-failed { color: var(--red); font-size: 13px; }

.spinner {
  width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: var(--blue);
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.qc-approval-note {
  background: var(--green-bg); border: 1px solid #bbf7d0; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 16px;
}
.qan-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
.qan-reason {
  background: #fff; border: 1px solid #d1fae5; border-radius: 8px; padding: 10px 12px;
  font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-wrap; word-break: break-word; margin: 0;
}
.qan-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
.qan-reviewer { color: var(--text-muted); }

.status-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: capitalize; white-space: nowrap; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }
</style>