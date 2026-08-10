<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">Manual Check — {{ row.sumber || 'Verifikasi Data' }}</h2>
            <p class="modal-subtitle">
              Ajukan perubahan verifikasi data untuk ditinjau SPQ Head.
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="displayId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ displayId }}</code>
          </div>

          <div v-if="lastRejected" class="status-note note-red">
            Pengajuan sebelumnya <strong>Rejected</strong>. Anda dapat mengajukan ulang.
          </div>

          <!-- Detail Error Code oleh AI (display only) -->
          <div class="section">
            <div class="section-title">Detail Error Code oleh AI</div>
            <div class="detail-grid">
              <div class="detail-row"><span class="dk">Sumber</span><span class="dv">{{ row.sumber || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Error Code</span><span class="dv">{{ row.error_code || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Risk Base</span><span class="dv">{{ row.risk_base || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Field</span><span class="dv">{{ row.item_code || '—' }}</span></div>
              <div class="detail-row"><span class="dk">{{ referenceLabel }}</span><span class="dv">{{ row.reference_value ?? '—' }}</span></div>
              <div class="detail-row"><span class="dk">Transkrip</span><span class="dv">{{ row.extracted_value ?? '—' }}</span></div>
              <div class="detail-row"><span class="dk">Match</span><span class="dv">{{ row.match || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Reason</span><span class="dv">{{ row.reason || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Evidence</span><span class="dv">{{ row.evidence || '—' }}</span></div>
              <div class="detail-row"><span class="dk">Ticket ID</span><span class="dv">{{ row.ticket_id || '—' }}</span></div>
            </div>
          </div>

          <!-- Manual Check Error Code (free text) -->
          <div class="section">
            <div class="section-title">Manual Check Error Code</div>
            <p class="section-hint">Semua field wajib diisi. Bila tidak ada nilai, isi dengan tanda <strong>"-"</strong>.</p>
            <div class="field">
              <label class="field-label">Jenis Banding <span class="req">*</span></label>
              <div class="kind-group">
                <label class="kind-opt"><input type="radio" value="remove" v-model="appealKind" /> Hapus Error Code</label>
                <label class="kind-opt"><input type="radio" value="change" v-model="appealKind" /> Ubah Error Code</label>
              </div>
              <p class="section-hint">{{ appealKind === 'change'
                ? 'Error tetap ada, kode diganti ke New Error Code.'
                : 'Error dihapus bila banding disetujui.' }}</p>
            </div>
            <div v-if="appealKind === 'change'" class="field">
              <label class="field-label" for="ch-new-code">New Error Code <span class="req">*</span></label>
              <select id="ch-new-code" v-model="newErrorCodeVal" class="select-input">
                <option value="" disabled>{{ row.error_code ? 'Pilih pengganti ' + row.error_code + '…' : 'Pilih Error Code…' }}</option>
                <optgroup v-for="g in errorReasonGroups" :key="g.type" :label="g.type">
                  <option v-for="o in g.items" :key="o.code" :value="o.code">{{ o.label }}</option>
                </optgroup>
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="ch-reason">Alasan perubahan QC <span class="req">*</span></label>
              <textarea
                id="ch-reason"
                v-model="reasonVal"
                class="textarea-input"
                rows="4"
                placeholder="Tuliskan alasan perubahan di sini…"
              ></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="ch-reference">{{ referenceLabel }} <span class="req">*</span></label>
              <textarea
                id="ch-reference"
                v-model="referenceVal"
                class="textarea-input"
                rows="2"
                placeholder="Nilai referensi yang benar…"
              ></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="ch-extracted">Transkrip <span class="req">*</span></label>
              <textarea
                id="ch-extracted"
                v-model="extractedVal"
                class="textarea-input"
                rows="2"
                placeholder="Nilai hasil ekstraksi yang benar…"
              ></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="ch-timestamp">Timestamp <span class="req">*</span></label>
              <input
                id="ch-timestamp"
                v-model="timestampVal"
                class="select-input"
                type="text"
                placeholder="Timestamp (mis. 00:12:34)…"
              />
            </div>
            <div class="field">
              <label class="field-label" for="ch-evidence">Evidence <span class="req">*</span></label>
              <textarea
                id="ch-evidence"
                v-model="evidenceVal"
                class="textarea-input"
                rows="3"
                placeholder="Evidence pendukung (teks saja)…"
              ></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="ch-ticket">Ticket ID <span class="req">*</span></label>
              <input
                id="ch-ticket"
                v-model="ticketVal"
                class="select-input"
                type="text"
                placeholder="Ticket ID…"
              />
            </div>
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>

        <footer class="modal-foot">
          <button class="btn-cancel" @click="close">Cancel</button>
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

const props = defineProps({
  resultId: { type: String, required: true },
  displayId: { type: String, default: null },
  // The B17 Error Code row being appealed (carries reference_value/extracted_value/match).
  row: { type: Object, required: true },
})
const emit = defineEmits(['close', 'submitted'])

// Split a combined "timestamp quote" evidence string into its two parts. Used as
// a fallback when the backend row does not carry timestamp/evidence_quote yet
// (older/cached evaluations); fresh rows already provide them split.
function splitEvidence(ev) {
  const s = String(ev ?? '').trim()
  const m = s.match(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?(?:\s*[-–]\s*\d{1,2}:\d{2}(?::\d{2})?)?/)
  const ts = m ? m[0].trim() : ''
  return { ts, text: ts ? s.slice(m[0].length).trim() : s }
}
const _ev = splitEvidence(props.row?.evidence)

// Prefill every field with the AI values so QC only tweaks them. Timestamp and
// evidence text come split from the backend (row.timestamp / row.evidence_quote),
// falling back to a client-side split of the combined evidence string.
const reasonVal = ref('')
// Banding intent: 'remove' (drop the error) or 'change' (relabel to New Error Code).
const appealKind = ref('remove')
// New Error Code proposed by QC (required only when appealKind === 'change').
const newErrorCodeVal = ref('')
// Master Error Code catalog for the dropdown, grouped by Error Type.
const errorReasonGroups = ref([])
async function loadErrorReasons() {
  try {
    const res = await apiClient.get('/error_reasons')
    const byType = {}
    for (const r of res.data || []) (byType[r.error_type] ||= []).push(r)
    errorReasonGroups.value = Object.entries(byType).map(([type, items]) => ({ type, items }))
  } catch {
    errorReasonGroups.value = []
  }
}
const referenceVal = ref(props.row?.reference_value != null ? String(props.row.reference_value) : '')
const extractedVal = ref(props.row?.extracted_value != null ? String(props.row.extracted_value) : '')
const timestampVal = ref(props.row?.timestamp != null ? String(props.row.timestamp) : _ev.ts)
const evidenceVal = ref(props.row?.evidence_quote != null ? String(props.row.evidence_quote) : _ev.text)
const ticketVal = ref(props.row?.ticket_id != null ? String(props.row.ticket_id) : '')
const errorMsg = ref('')
const submitting = ref(false)

const lastRejected = computed(() =>
  (props.row?.appeal?.effective_status || props.row?.appeal?.latest_status) === 'rejected')

// The "Reference Value" label is source-specific: "TMS" for Cashline Data
// Verification, "Ascend" for Card Holder Verification (falls back otherwise).
const referenceLabel = computed(() => {
  const s = (props.row?.sumber || '').toLowerCase()
  if (s.includes('cashline')) return 'TMS'
  if (s.includes('card holder') || s.includes('card_holder')) return 'Ascend'
  return 'Reference Value'
})

// Every text field is required (QC fills empty values with "-"). A 'change'
// banding additionally requires a New Error Code.
const canSubmit = computed(
  () =>
    !submitting.value &&
    [reasonVal, referenceVal, extractedVal, timestampVal, evidenceVal, ticketVal].every(
      (f) => f.value.trim().length > 0
    ) &&
    (appealKind.value !== 'change' || newErrorCodeVal.value.trim().length > 0)
)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const form = new FormData()
    form.append('result_id', props.resultId)
    form.append('error_code', props.row.error_code || '')
    form.append('item_code', props.row.item_code || '')
    form.append('ai_sumber', props.row.sumber || '')
    form.append('ai_risk_base', props.row.risk_base || '')
    form.append('ai_details_error', props.row.details_error || '')
    form.append('ai_reason', props.row.reason || '')
    form.append('ai_evidence', props.row.evidence || '')
    form.append('ai_ticket_id', props.row.ticket_id || '')
    form.append('qc_reason', reasonVal.value.trim())
    form.append('appeal_kind', appealKind.value)
    form.append('qc_new_error_code', appealKind.value === 'change' ? newErrorCodeVal.value.trim() : '')
    form.append('qc_reference_value', referenceVal.value.trim())
    form.append('qc_extracted_value', extractedVal.value.trim())
    // Recombine the edited timestamp + evidence text into the single evidence
    // string the backend stores (same "timestamp quote" shape as ai_evidence).
    const qcEvidence = `${timestampVal.value.trim()} ${evidenceVal.value.trim()}`.trim()
    form.append('qc_evidence', qcEvidence)
    form.append('qc_ticket_id', ticketVal.value.trim())
    const res = await apiClient.post('/error_code_appeal', form)
    emit('submitted', { resultId: props.resultId, appeal: res.data })
    close()
  } catch (e) {
    if (e.response?.status === 409) {
      errorMsg.value = 'Sudah ada banding aktif untuk error code ini.'
    } else if (e.response?.status === 422 || e.response?.status === 404) {
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

onMounted(() => {
  window.addEventListener('keydown', onKey)
  loadErrorReasons()
})
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
.note-red { background: var(--red-bg); color: var(--red); }

.section { display: flex; flex-direction: column; gap: 8px; }
.section-title { font-size: 13px; font-weight: 700; color: var(--text); }
.section-hint { font-size: 12px; color: var(--text-muted); margin: -2px 0 2px; line-height: 1.4; }
.req { color: var(--red); font-weight: 700; }
.detail-grid {
  display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; background: #f8fafc;
}
.detail-row { display: flex; gap: 10px; padding: 7px 12px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
.detail-row:last-child { border-bottom: none; }
.dk { font-weight: 700; color: var(--text-muted); min-width: 120px; flex-shrink: 0; }
.dv { color: var(--text); word-break: break-word; white-space: pre-wrap; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--text); }
.kind-group { display: flex; gap: 16px; flex-wrap: wrap; }
.kind-opt { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
.kind-opt input { accent-color: var(--blue); }
.select-input, .textarea-input {
  padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13px; color: var(--text); outline: none; background: #fff;
  transition: border-color 0.2s; font-family: inherit;
}
.select-input:focus, .textarea-input:focus { border-color: var(--blue); }
.textarea-input { resize: vertical; line-height: 1.5; }

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
</style>
