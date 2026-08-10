<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">{{ stage === 'tl' ? 'Manual Check by QC' : 'Review Banding' }}</h2>
            <p class="modal-subtitle">
              {{ stage === 'tl'
                ? 'Terima (final), tolak, atau teruskan ke SPQ Head.'
                : 'Persetujuan final (banding diteruskan oleh Team Leader QC).' }}
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="displayId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ displayId }}</code>
          </div>

          <!-- Detail Error Code oleh AI -->
          <div class="section">
            <div class="section-title">Detail Error Code oleh AI</div>
            <div class="detail-grid">
              <div class="detail-row"><span class="dk">Sumber</span><span class="dv">{{ row.sumber || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Error Code</span><span class="dv">{{ row.error_code || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Risk Base</span><span class="dv">{{ row.risk_base || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Item Code</span><span class="dv">{{ row.item_code || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Details Error</span><span class="dv">{{ row.details_error || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Reason</span><span class="dv">{{ row.reason || '—' }}</span></div>
              <template v-if="isVerification">
                <div class="detail-row"><span class="dk">{{ referenceLabel }}</span><span class="dv">{{ row.reference_value ?? '—' }}</span></div>
                <div class="detail-row"><span class="dk">Transkrip</span><span class="dv">{{ row.extracted_value ?? '—' }}</span></div>
                <div class="detail-row"><span class="dk">Match</span><span class="dv">{{ row.match || '—' }}</span></div>
              </template>
              <div class="detail-row"><span class="dk">Evidence</span><span class="dv">{{ row.evidence || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Ticket ID</span><span class="dv">{{ row.ticket_id || '—' }}</span></div>
            </div>
          </div>

          <!-- Manual Check Error Code -->
          <div class="section">
            <div class="section-title">Manual Check Error Code</div>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="dk">Jenis Banding</span>
                <span class="dv">{{ kindLabel }}</span>
              </div>
              <div v-if="latest.appeal_kind === 'add'" class="detail-row">
                <span class="dk">Sumber</span>
                <span class="dv">{{ addSourceLabel }}</span>
              </div>
              <div v-if="latest.appeal_kind === 'change'" class="detail-row">
                <span class="dk">New Error Code</span>
                <span class="dv">{{ latest.qc_new_error_code || '—' }}<template v-if="latest.qc_new_error_code"> <span class="ec-from">(dari {{ row.error_code || '—' }})</span></template></span>
              </div>
              <div class="detail-row"><span class="dk">Alasan Perubahan</span><span class="dv">{{ latest.qc_reason || '—' }}</span></div>
              <template v-if="isVerification">
                <div class="detail-row"><span class="dk">{{ referenceLabel }}</span><span class="dv">{{ latest.qc_reference_value || '—' }}</span></div>
                <div class="detail-row"><span class="dk">Transkrip</span><span class="dv">{{ latest.qc_extracted_value || '—' }}</span></div>
              </template>
              <div class="detail-row"><span class="dk">Timestamp</span><span class="dv">{{ qcTimestamp || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Evidence</span><span class="dv">{{ qcEvidenceText || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Ticket ID</span><span class="dv">{{ latest.qc_ticket_id || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Diajukan oleh (QC)</span><span class="dv">{{ latest.requested_by_username || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Cek Team Leader QC</span><span class="dv">{{ tlQcText }}</span></div>
            </div>
          </div>

          <div v-if="blockedByTl" class="tl-warn">
            ⏳ Banding ini belum diteruskan Team Leader QC. SPQ Head hanya memutuskan
            banding yang di-<b>escalate</b> oleh Team Leader QC.
          </div>

          <div v-if="isDecided" class="info-row">
            <span class="info-label">Status</span>
            <span :class="['status-badge', latest.approval_status === 'approved' ? 'badge-green' : 'badge-red']">
              {{ latest.approval_status === 'approved' ? 'Approved' : 'Rejected' }}
            </span>
            <span v-if="latest.reviewed_by_username" class="reviewer">
              oleh {{ latest.reviewed_by_username }}
              <template v-if="latest.reviewed_at"> · {{ formatDate(latest.reviewed_at) }}</template>
            </span>
          </div>

          <!-- Komentar reviewer, per tingkat (TL QC & SPQ Head) -->
          <div v-if="latest.tl_qc_comment" class="review-comment">
            <span class="rc-label">Komentar Team Leader QC{{ latest.tl_qc_username ? ' — ' + latest.tl_qc_username : '' }}</span>
            <span class="rc-text">{{ latest.tl_qc_comment }}</span>
          </div>
          <div v-if="latest.review_comment" class="review-comment">
            <span class="rc-label">Komentar SPQ Head{{ latest.reviewed_by_username ? ' — ' + latest.reviewed_by_username : '' }}</span>
            <span class="rc-text">{{ latest.review_comment }}</span>
          </div>

          <!-- Riwayat pengajuan sebelumnya (bila lebih dari satu) -->
          <div v-if="history.length > 1" class="section">
            <div class="section-title">Riwayat ({{ history.length }})</div>
            <ul class="history">
              <li v-for="h in history" :key="h.id">
                <span :class="['status-badge', statusBadge(h.approval_status)]">{{ statusText(h.approval_status) }}</span>
                <span class="hist-reason">{{ h.qc_reason }}</span>
                <span v-if="h.tl_qc_comment" class="hist-reject">↳ TL QC: {{ h.tl_qc_comment }}</span>
                <span v-if="h.review_comment" class="hist-reject">↳ SPQ Head: {{ h.review_comment }}</span>
              </li>
            </ul>
          </div>

          <!-- Komentar reviewer; wajib diisi saat menolak. -->
          <div v-if="!isDecided && !blockedByTl" class="comment-box">
            <label class="comment-label">Komentar <span class="req">(wajib jika menolak)</span></label>
            <textarea v-model="comment" class="comment-input" rows="2"
                      placeholder="Alasan penolakan / catatan untuk QC..."></textarea>
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>

        <footer class="modal-foot">
          <button class="btn-cancel" @click="close">Tutup</button>
          <div v-if="stage === 'tl'" class="foot-actions">
            <button class="btn-reject" :disabled="submitting || isDecided" @click="review('reject')">
              <span v-if="submitting === 'reject'" class="spinner spinner-dark"></span>
              Tolak
            </button>
            <button class="btn-escalate" :disabled="submitting || isDecided" @click="review('escalate')">
              <span v-if="submitting === 'escalate'" class="spinner spinner-dark"></span>
              Teruskan ke SPQ Head
            </button>
            <button class="btn-approve" :disabled="submitting || isDecided" @click="review('approve')">
              <span v-if="submitting === 'approve'" class="spinner"></span>
              Terima (Final)
            </button>
          </div>
          <div v-else class="foot-actions">
            <button class="btn-reject" :disabled="submitting || isDecided || blockedByTl" @click="review('reject')">
              <span v-if="submitting === 'reject'" class="spinner spinner-dark"></span>
              Reject
            </button>
            <button class="btn-approve" :disabled="submitting || isDecided || blockedByTl" @click="review('approve')">
              <span v-if="submitting === 'approve'" class="spinner"></span>
              Approve
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../api/client.js'

const props = defineProps({
  resultId: { type: String, required: true },
  displayId: { type: String, default: null },
  // The Error Code row being reviewed; row.appeal carries latest_id + history.
  row: { type: Object, required: true },
  // 'tl' = Team Leader QC intermediate check; 'spq' = SPQ Head final approval.
  stage: { type: String, default: 'spq' },
})
const emit = defineEmits(['close', 'reviewed'])

const submitting = ref(null) // 'approve' | 'reject' | null
const errorMsg = ref('')
const comment = ref('')      // reviewer's note; mandatory when rejecting

const history = computed(() => props.row?.appeal?.history || [])
const latest = computed(() => history.value[history.value.length - 1] || {})
const isVerification = computed(() => {
  const ec = (props.row?.error_code || '').toUpperCase()
  return ec === 'B17' || ['B02', 'B03', 'B05'].some((x) => ec.includes(x))
})
// Team Leader QC decision: approve/reject are FINAL, escalate forwards to SPQ Head.
const tlQcText = computed(() => {
  const s = latest.value.tl_qc_status || 'pending'
  const who = latest.value.tl_qc_username ? ` oleh ${latest.value.tl_qc_username}` : ''
  if (s === 'approved') return `Diterima final${who}`
  if (s === 'rejected') return `Ditolak${who}`
  // Stage-aware: while awaiting a decision, show who is currently reviewing.
  if (s === 'escalated') return 'Reviewing by SPQ Head'
  return 'Reviewing by Team Leader QC'
})
// A stage is "decided" (buttons locked) once its own status is set.
const isDecided = computed(() =>
  props.stage === 'tl'
    ? ['approved', 'rejected', 'escalated'].includes(latest.value.tl_qc_status)
    : ['approved', 'rejected'].includes(latest.value.approval_status)
)
// SPQ Head may only act on banding that Team Leader QC ESCALATED.
const blockedByTl = computed(() => props.stage === 'spq' && latest.value.tl_qc_status !== 'escalated')

// The "Reference Value" label is source-specific: "TMS" for Cashline Data
// Verification, "Ascend" for Card Holder Verification (matches the QC modal).
const referenceLabel = computed(() => {
  const s = (props.row?.sumber || '').toLowerCase()
  if (s.includes('cashline')) return 'TMS'
  if (s.includes('card holder') || s.includes('card_holder')) return 'Ascend'
  return 'Reference Value'
})

const kindLabel = computed(() => ({
  change: 'Ubah Error Code', add: 'Tambah Error Code',
}[latest.value.appeal_kind] || 'Hapus Error Code'))
const addSourceLabel = computed(() => ({
  scorecard: 'Scorecard', cashline_data: 'Cashline Data Verification',
  card_holder: 'Card Holder Verification', others: 'Others',
}[latest.value.add_source] || latest.value.add_source || '—'))

// QC submits evidence as a single "timestamp quote" string; split it back so the
// Timestamp and Evidence-text rows mirror the QC Manual Check form.
function splitEvidence(ev) {
  const s = String(ev ?? '').trim()
  const m = s.match(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?(?:\s*[-–]\s*\d{1,2}:\d{2}(?::\d{2})?)?/)
  const ts = m ? m[0].trim() : ''
  return { ts, text: ts ? s.slice(m[0].length).trim() : s }
}
const qcTimestamp = computed(() => splitEvidence(latest.value.qc_evidence).ts)
const qcEvidenceText = computed(() => splitEvidence(latest.value.qc_evidence).text)

function formatDate(iso) {
  if (!iso) return ''
  // Backend stores naive UTC; parse as UTC then render in WIB (Asia/Jakarta).
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

function statusBadge(s) {
  if (s === 'approved') return 'badge-green'
  if (s === 'rejected') return 'badge-red'
  return 'badge-gray'
}
function statusText(s) {
  if (s === 'approved') return 'Approved'
  if (s === 'rejected') return 'Rejected'
  return 'Menunggu Approval'
}

async function review(decision) {
  if (submitting.value || isDecided.value || blockedByTl.value) return
  // A reject must carry a reason for the QC to see (enforced again on the backend).
  if (decision === 'reject' && !comment.value.trim()) {
    errorMsg.value = 'Komentar wajib diisi saat menolak banding.'
    return
  }
  const appealId = props.row?.appeal?.latest_id
  if (!appealId) return
  submitting.value = decision
  errorMsg.value = ''
  const path = props.stage === 'tl' ? 'tl_review' : 'review'
  try {
    const form = new FormData()
    form.append('decision', decision)
    if (comment.value.trim()) form.append('comment', comment.value.trim())
    const res = await apiClient.post(`/error_code_appeal/${appealId}/${path}`, form)
    emit('reviewed', { resultId: props.resultId, appeal: res.data })
    close()
  } catch (e) {
    if (e.response?.status === 404) {
      errorMsg.value = 'Banding tidak ditemukan.'
    } else if (e.response?.status === 409) {
      errorMsg.value = e.response.data?.detail || 'Banding belum bisa diproses pada tahap ini.'
    } else if (e.response?.status === 403) {
      errorMsg.value = props.stage === 'tl' ? 'Akses hanya untuk Team Leader QC.' : 'Akses hanya untuk SPQ Head.'
    } else {
      errorMsg.value = 'Gagal memproses. Coba lagi.'
    }
  } finally {
    submitting.value = null
  }
}

function close() {
  emit('close')
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 100;
}
.modal-card {
  background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh;
  display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); overflow: hidden;
}
.modal-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 20px 24px 14px; border-bottom: 1px solid var(--border);
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--text); }
.modal-subtitle { font-size: 12.5px; color: var(--text-muted); margin-top: 3px; }
.close-x {
  background: #f1f5f9; border: none; color: var(--text-muted); width: 28px; height: 28px;
  border-radius: 8px; font-size: 13px; flex-shrink: 0; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s;
}
.close-x:hover { background: #e2e8f0; color: var(--text); }

.modal-body { padding: 18px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.id-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.id-label { font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
code.id-value {
  background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px;
  font-family: monospace; font-size: 12px; color: var(--text); word-break: break-all;
}

.section { display: flex; flex-direction: column; gap: 8px; }
.section-title { font-size: 13px; font-weight: 700; color: var(--text); }
.detail-grid {
  display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; background: #f8fafc;
}
.detail-row { display: flex; gap: 10px; padding: 7px 12px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
.detail-row:last-child { border-bottom: none; }
.dk { font-weight: 700; color: var(--text-muted); min-width: 120px; flex-shrink: 0; }
.dv { color: var(--text); word-break: break-word; white-space: pre-wrap; }
.ec-from { color: var(--text-muted); font-size: 11.5px; font-weight: 500; }

.info-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.info-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.reviewer { font-size: 12px; color: var(--text-muted); }

.history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.history li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; flex-wrap: wrap; }
.hist-reason { color: var(--text); word-break: break-word; }
.hist-reject { color: var(--text-muted); word-break: break-word; font-size: 12px; flex-basis: 100%; padding-left: 4px; }

.review-comment {
  background: #f8fafc; border: 1px solid var(--border); border-radius: 8px;
  padding: 9px 12px; display: flex; flex-direction: column; gap: 3px; margin-top: 8px;
}
.rc-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.rc-text { font-size: 12.5px; color: var(--text); word-break: break-word; }

.comment-box { display: flex; flex-direction: column; gap: 5px; }
.comment-label { font-size: 12.5px; font-weight: 600; color: var(--text); }
.comment-label .req { font-weight: 500; color: var(--text-muted); }
.comment-input {
  width: 100%; border: 1.5px solid var(--border); border-radius: 8px; padding: 8px 10px;
  font-size: 13px; font-family: inherit; color: var(--text); resize: vertical; outline: none;
}
.comment-input:focus { border-color: var(--blue); }

.status-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-weight: 500;
}
.tl-warn {
  background: var(--yellow-bg, #fef9c3); color: #92600a; border: 1px solid #fde68a;
  border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-weight: 500;
}

.modal-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 24px; border-top: 1px solid var(--border); background: #fafbfc;
}
.foot-actions { display: flex; gap: 10px; }
.btn-cancel {
  padding: 9px 16px; background: #fff; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-muted); transition: all 0.15s;
}
.btn-cancel:hover { background: #f1f5f9; color: var(--text); }
.btn-approve {
  padding: 9px 18px; background: #16a34a; color: #fff; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 700; transition: background 0.15s; display: flex; align-items: center; gap: 8px;
}
.btn-approve:hover:not(:disabled) { background: #15803d; }
.btn-reject {
  padding: 9px 18px; background: #fff; color: var(--red); border: 1.5px solid var(--red); border-radius: 8px;
  font-size: 13px; font-weight: 700; transition: all 0.15s; display: flex; align-items: center; gap: 8px;
}
.btn-reject:hover:not(:disabled) { background: var(--red-bg); }
.btn-escalate {
  padding: 9px 16px; background: #fff; color: #b45309; border: 1.5px solid #fcd34d; border-radius: 8px;
  font-size: 13px; font-weight: 700; transition: all 0.15s; display: flex; align-items: center; gap: 8px;
}
.btn-escalate:hover:not(:disabled) { background: #fffbeb; }
.btn-approve:disabled, .btn-reject:disabled, .btn-escalate:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
.spinner-dark { border: 2px solid rgba(220,38,38,0.3); border-top-color: var(--red); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
