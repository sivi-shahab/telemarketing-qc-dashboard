<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">Manual Status</h2>
            <!-- Manual Status = vonis HUMAN atas tiket ini. Berdiri sendiri: tidak
                 pernah menimpa AI Status. QC mengUSULkan (lewat hierarki), TL QC &
                 SPQ Head menetapkan langsung tanpa approval. -->
            <p class="modal-subtitle">
              {{ isDirectSetter
                ? 'Tetapkan Manual Status tiket ini. Berlaku langsung, tanpa approval.'
                : 'Ajukan Manual Status untuk ditinjau Team Leader QC (bisa diteruskan ke SPQ Head).' }}
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="displayId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ displayId }}</code>
          </div>

          <div
            v-if="existing && existing.approval_status"
            class="status-note"
            :class="noteClass"
          >
            Permintaan sebelumnya: <strong>{{ approvalLabel }}</strong>
            <template v-if="existing.requested_status">
              (usulan {{ aiStatusLabel(existing.requested_status) }})
            </template>
          </div>

          <div class="field">
            <label class="field-label" for="mc-status">Manual Status</label>
            <select id="mc-status" v-model="statusVal" class="select-input">
              <option value="" disabled>Pilih status…</option>
              <option value="PASS">QUALIFIED</option>
              <option value="FAIL">NOT QUALIFIED</option>
              <option value="PENDING">PENDING</option>
            </select>
            <p class="field-hint">
              Pilih PENDING bila belum bisa diputuskan (mis. menunggu dokumen).
            </p>
            <!-- Penetapan pertama yang sama dengan AI Status tidak mengubah apa pun,
                 jadi backend memfinalkannya tanpa hierarki. Katakan itu sebelum QC
                 menekan Submit, bukan sesudahnya. -->
            <p v-if="confirmsAiStatus" class="field-hint hint-ok">
              Sama dengan AI Status ({{ aiStatusLabel(aiStatus) }}) — berlaku langsung,
              tanpa approval Team Leader QC / SPQ Head.
            </p>
            <p v-else-if="willNeedApproval" class="field-hint">
              Berbeda dari AI Status ({{ aiStatusLabel(aiStatus) }}) — usulan ini
              ditinjau Team Leader QC (bisa diteruskan ke SPQ Head).
            </p>
          </div>

          <div class="field">
            <label class="field-label" for="mc-reason">Alasan</label>
            <textarea
              id="mc-reason"
              v-model="reasonVal"
              class="textarea-input"
              rows="5"
              placeholder="Tuliskan alasan perubahan status di sini…"
            ></textarea>
          </div>

          <ManualStatusHistory :result-id="resultId" />

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>

        <footer class="modal-foot">
          <button class="btn-cancel" @click="close">Batal</button>
          <button class="btn-submit" :disabled="!canSubmit" @click="submit">
            <span v-if="submitting" class="spinner"></span>
            {{ submitting ? 'Mengirim…' : 'Submit' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../api/client.js'
import ManualStatusHistory from './ManualStatusHistory.vue'
import { useAuthStore } from '../stores/auth.js'
import { P } from '../permissions.js'
import { aiStatusLabel } from '../utils/aiStatus.js'

const props = defineProps({
  resultId: { type: String, required: true },
  displayId: { type: String, default: null },
  existing: { type: Object, default: null },
  // AI Status tiket ini + apakah vonis human-nya sudah pernah ditetapkan. Dipakai
  // HANYA untuk keterangan di bawah dropdown; yang memutuskan perlu-tidaknya
  // approval tetap backend (_confirms_ai_status di api/routers/qc_status.py).
  aiStatus: { type: String, default: null },
  byHuman: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'submitted'])

// Team Leader QC & SPQ Head menetapkan Manual Status LANGSUNG (tanpa approval);
// QC hanya mengusulkan dan menunggu hierarki. Backend menegakkan hal yang sama.
const auth = useAuthStore()
const isDirectSetter = computed(() =>
  auth.can(P.MANUAL_STATUS_DIRECT)
)

const statusVal = ref(props.existing?.requested_status || '')
const reasonVal = ref(props.existing?.reason || '')
const errorMsg = ref('')
const submitting = ref(false)

// Hanya berlaku untuk pengusul (QC) pada penetapan PERTAMA: sesudah ada vonis human,
// setiap perubahan tetap lewat alur banding.
const firstVerdict = computed(() => !isDirectSetter.value && !props.byHuman && !!props.aiStatus)
const confirmsAiStatus = computed(() => firstVerdict.value && statusVal.value === props.aiStatus)
const willNeedApproval = computed(() => !isDirectSetter.value && !!statusVal.value && !confirmsAiStatus.value)

const canSubmit = computed(
  () => !!statusVal.value && reasonVal.value.trim().length > 0 && !submitting.value
)

const approvalLabel = computed(() => {
  const s = props.existing?.approval_status
  if (s === 'approved') return 'Approved'
  if (s === 'rejected') return 'Rejected'
  return 'Menunggu approval'
})

const noteClass = computed(() => {
  const s = props.existing?.approval_status
  if (s === 'approved') return 'note-green'
  if (s === 'rejected') return 'note-red'
  return 'note-gray'
})

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const form = new FormData()
    form.append('result_id', props.resultId)
    form.append('requested_status', statusVal.value)
    form.append('reason', reasonVal.value.trim())
    const res = await apiClient.post('/qc_status_request', form)
    emit('submitted', { resultId: props.resultId, request: res.data })
    close()
  } catch (e) {
    if (e.response?.status === 422 || e.response?.status === 404) {
      errorMsg.value = e.response.data?.detail || 'Input tidak valid.'
    } else if (e.response?.status === 403) {
      errorMsg.value = 'Akses hanya untuk QC.'
    } else {
      errorMsg.value = 'Gagal mengirim. Coba lagi.'
    }
  } finally {
    submitting.value = false
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
.id-label { font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; min-width: 64px; }
code.id-value {
  background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px;
  font-family: monospace; font-size: 12px; color: var(--text); word-break: break-all;
}

.status-note { font-size: 12.5px; border-radius: 8px; padding: 8px 12px; font-weight: 500; }
.note-gray { background: #f1f5f9; color: var(--text-muted); }
.note-green { background: var(--green-bg); color: #16a34a; }
.note-red { background: var(--red-bg); color: var(--red); }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--text); }
.select-input, .textarea-input {
  padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13px; color: var(--text); outline: none; background: #fff;
  transition: border-color 0.2s; font-family: inherit;
}
.select-input:focus, .textarea-input:focus { border-color: var(--blue); }
.textarea-input { min-height: 120px; resize: vertical; line-height: 1.5; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-weight: 500;
}

.modal-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  padding: 14px 24px; border-top: 1px solid var(--border); background: #fafbfc;
}
.btn-cancel {
  padding: 9px 16px; background: #fff; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-muted); transition: all 0.15s;
}
.btn-cancel:hover { background: #f1f5f9; color: var(--text); }
.btn-submit {
  padding: 9px 18px; background: var(--blue); color: #fff; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 700; transition: background 0.15s; display: flex; align-items: center; gap: 8px;
}
.btn-submit:hover:not(:disabled) { background: #2563eb; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.field-hint { margin: 4px 0 0; font-size: 11px; color: var(--text-muted, #6b7280); }
.hint-ok { color: #16a34a; font-weight: 600; }
</style>
