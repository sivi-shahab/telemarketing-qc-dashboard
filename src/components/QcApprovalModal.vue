<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">{{ stage === 'tl' ? 'Cek Manual Status (Team Leader QC)' : 'Review Manual Status (SPQ Head)' }}</h2>
            <p class="modal-subtitle">
              Tinjau usulan Manual Status (override AI Status) dari QC.
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="displayId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ displayId }}</code>
          </div>

          <div class="info-row">
            <span class="info-label">Status AI</span>
            <span v-if="currentAiStatus" :class="['status-badge', badgeClass(currentAiStatus)]">{{ aiStatusLabel(currentAiStatus) }}</span>
            <span v-else>—</span>
          </div>

          <div class="info-row">
            <span class="info-label">Perubahan Status oleh QC</span>
            <span :class="['status-badge', badgeClass(request.requested_status)]">{{ aiStatusLabel(request.requested_status) }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Alasan Perubahan Status</span>
            <p class="reason-text">{{ request.reason || '—' }}</p>
          </div>

          <div v-if="isDecided" class="info-row">
            <span class="info-label">{{ stage === 'tl' ? 'Keputusan TL QC' : 'Approval Status' }}</span>
            <span :class="['status-badge', decidedClass]">{{ decidedText }}</span>
            <span v-if="reviewerName" class="reviewer">oleh {{ reviewerName }}</span>
          </div>

          <!-- Komentar reviewer, per tingkat (TL QC & SPQ Head) -->
          <div v-if="request.tl_qc_comment" class="review-comment">
            <span class="rc-label">Komentar Team Leader QC{{ request.tl_qc_username ? ' — ' + request.tl_qc_username : '' }}</span>
            <span class="rc-text">{{ request.tl_qc_comment }}</span>
          </div>
          <div v-if="request.review_comment" class="review-comment">
            <span class="rc-label">Komentar SPQ Head{{ request.reviewed_by_username ? ' — ' + request.reviewed_by_username : '' }}</span>
            <span class="rc-text">{{ request.review_comment }}</span>
          </div>

          <!-- Komentar reviewer; wajib diisi saat menolak. -->
          <div v-if="!isDecided" class="comment-box">
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
            <button class="btn-reject" :disabled="submitting || isDecided" @click="review('reject')">
              <span v-if="submitting === 'reject'" class="spinner spinner-dark"></span>
              Reject
            </button>
            <button class="btn-approve" :disabled="submitting || isDecided" @click="review('approve')">
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
import { aiStatusLabel } from '../utils/aiStatus.js'

const props = defineProps({
  resultId: { type: String, required: true },
  displayId: { type: String, default: null },
  request: { type: Object, required: true },
  currentAiStatus: { type: String, default: null },
  // 'tl' = Team Leader QC intermediate check (approve/reject/escalate); 'spq' = SPQ Head final.
  stage: { type: String, default: 'spq' },
})
const emit = defineEmits(['close', 'reviewed'])

const submitting = ref(null) // 'approve' | 'reject' | 'escalate' | null
const errorMsg = ref('')
const comment = ref('')      // reviewer's note; mandatory when rejecting

const isDecided = computed(() =>
  props.stage === 'tl'
    ? ['approved', 'rejected', 'escalated'].includes(props.request?.tl_qc_status)
    : ['approved', 'rejected'].includes(props.request?.approval_status)
)
const decidedText = computed(() => {
  if (props.stage === 'tl') {
    return { approved: 'Diterima final', escalated: 'Diteruskan ke SPQ Head', rejected: 'Ditolak' }[props.request?.tl_qc_status] || ''
  }
  return props.request?.approval_status === 'approved' ? 'Approved' : 'Rejected'
})
const decidedClass = computed(() => {
  const s = props.stage === 'tl' ? props.request?.tl_qc_status : props.request?.approval_status
  return s === 'approved' ? 'badge-green' : s === 'escalated' ? 'badge-gray' : 'badge-red'
})
const reviewerName = computed(() =>
  props.stage === 'tl' ? props.request?.tl_qc_username : props.request?.reviewed_by_username
)

function badgeClass(status) {
  return status === 'PASS' ? 'badge-green' : 'badge-red'
}

function formatDate(iso) {
  if (!iso) return ''
  // Backend stores naive UTC; parse as UTC then render in WIB (Asia/Jakarta).
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

async function review(decision) {
  if (submitting.value) return
  // A reject must carry a reason for the QC to see (enforced again on the backend).
  if (decision === 'reject' && !comment.value.trim()) {
    errorMsg.value = 'Komentar wajib diisi saat menolak permintaan.'
    return
  }
  submitting.value = decision
  errorMsg.value = ''
  const path = props.stage === 'tl' ? 'tl_review' : 'review'
  try {
    const form = new FormData()
    form.append('decision', decision)
    if (comment.value.trim()) form.append('comment', comment.value.trim())
    const res = await apiClient.post(`/qc_status_request/${props.resultId}/${path}`, form)
    emit('reviewed', { resultId: props.resultId, request: res.data })
    close()
  } catch (e) {
    if (e.response?.status === 404) {
      errorMsg.value = 'Permintaan tidak ditemukan.'
    } else if (e.response?.status === 403) {
      errorMsg.value = 'Akses hanya untuk SPQ Head.'
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

.info-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.info-block { display: flex; flex-direction: column; gap: 6px; }
.info-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; min-width: 150px; }
.reason-text {
  background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
  font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-wrap; word-break: break-word;
}
.reviewer { font-size: 12px; color: var(--text-muted); }

.status-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-weight: 500;
}

.review-comment {
  background: #f8fafc; border: 1px solid var(--border); border-radius: 8px;
  padding: 9px 12px; display: flex; flex-direction: column; gap: 3px;
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
  padding: 9px 18px; background: #fff; color: var(--blue); border: 1.5px solid var(--blue); border-radius: 8px;
  font-size: 13px; font-weight: 700; transition: all 0.15s; display: flex; align-items: center; gap: 8px;
}
.btn-escalate:hover:not(:disabled) { background: var(--blue-bg); }
.btn-approve:disabled, .btn-reject:disabled, .btn-escalate:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
.spinner-dark { border: 2px solid rgba(220,38,38,0.3); border-top-color: var(--red); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
