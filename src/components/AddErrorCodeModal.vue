<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">Tambah Error Code</h2>
            <p class="modal-subtitle">
              Usulkan error code baru untuk ditinjau berjenjang (Team Leader QC → SPQ Head).
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="displayId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ displayId }}</code>
          </div>

          <div class="section">
            <div class="section-title">Error Code Baru</div>
            <p class="section-hint">Semua field wajib diisi. Bila tidak ada nilai, isi dengan tanda <strong>"-"</strong>.</p>

            <!-- Sumber -->
            <div class="field">
              <label class="field-label" for="add-source">Sumber Error <span class="req">*</span></label>
              <select id="add-source" v-model="source" class="select-input">
                <option value="" disabled>Pilih sumber…</option>
                <option v-for="s in SOURCES" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
              <p class="section-hint">{{ sourceHint }}</p>
            </div>

            <!-- Target item/field (khusus 3 sumber terstruktur) -->
            <div v-if="source === 'scorecard'" class="field">
              <label class="field-label" for="add-sc">Item Scorecard (SESUAI) <span class="req">*</span></label>
              <select id="add-sc" v-model="targetItemCode" class="select-input">
                <option value="" disabled>Pilih item yang ditandai error…</option>
                <option v-for="it in scorecardOptions" :key="it.item_code" :value="it.item_code">
                  {{ it.item_code }} — {{ it.requirement || it.category || '' }} (bobot {{ it.weight }})
                </option>
              </select>
              <p v-if="!scorecardOptions.length" class="section-hint">Tidak ada item scorecard berstatus SESUAI untuk ditandai.</p>
            </div>

            <div v-else-if="source === 'cashline_data' || source === 'card_holder'" class="field">
              <label class="field-label" for="add-vf">Field Verifikasi (MATCH) <span class="req">*</span></label>
              <select id="add-vf" v-model="targetField" class="select-input">
                <option value="" disabled>Pilih field yang ditandai error…</option>
                <option v-for="f in verificationOptions" :key="f.field" :value="f.field">{{ titleize(f.field) }}</option>
              </select>
              <p v-if="!verificationOptions.length" class="section-hint">Tidak ada field MATCH untuk ditandai pada sumber ini.</p>
            </div>

            <!-- Error code dari katalog master -->
            <div class="field">
              <label class="field-label" for="add-code">Error Code <span class="req">*</span></label>
              <select id="add-code" v-model="errorCode" class="select-input">
                <option value="" disabled>Pilih Error Code…</option>
                <optgroup v-for="g in errorReasonGroups" :key="g.type" :label="g.type">
                  <option v-for="o in g.items" :key="o.code" :value="o.code">{{ o.label }}</option>
                </optgroup>
              </select>
            </div>

            <!-- Risk Base — editable; default from the error code shown as placeholder -->
            <div v-if="errorCode" class="field">
              <label class="field-label" for="add-rb">Risk Base</label>
              <input
                id="add-rb"
                v-model="riskBaseVal"
                class="select-input"
                type="text"
                maxlength="10"
                :placeholder="selectedRiskBase ? `Default: ${selectedRiskBase}` : 'mis. H / M / L'"
              />
              <p class="section-hint">
                Kosongkan untuk memakai default error code{{ selectedRiskBase ? ` (${selectedRiskBase})` : '' }}.
              </p>
            </div>

            <!-- Reference/Extracted (khusus verifikasi) -->
            <template v-if="isVerification">
              <div class="field">
                <label class="field-label" for="add-ref">Nilai Referensi ({{ referenceLabel }}) <span class="req">*</span></label>
                <input id="add-ref" v-model="referenceVal" class="select-input" type="text" placeholder="Nilai acuan…" />
              </div>
              <div class="field">
                <label class="field-label" for="add-ext">Nilai Ekstraksi (transkrip) <span class="req">*</span></label>
                <input id="add-ext" v-model="extractedVal" class="select-input" type="text" placeholder="Nilai yang terdeteksi…" />
              </div>
            </template>

            <div class="field">
              <label class="field-label" for="add-reason">Alasan <span class="req">*</span></label>
              <textarea id="add-reason" v-model="reasonVal" class="textarea-input" rows="4" placeholder="Alasan penambahan error…"></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="add-ts">Timestamp <span class="req">*</span></label>
              <input id="add-ts" v-model="timestampVal" class="select-input" type="text" placeholder="Timestamp (mis. 00:12:34)…" />
            </div>
            <div class="field">
              <label class="field-label" for="add-ev">Evidence <span class="req">*</span></label>
              <textarea id="add-ev" v-model="evidenceVal" class="textarea-input" rows="3" placeholder="Evidence pendukung (teks saja)…"></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="add-ticket">Ticket ID <span class="req">*</span></label>
              <input id="add-ticket" v-model="ticketVal" class="select-input" type="text" placeholder="Ticket ID…" />
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../api/client.js'

const props = defineProps({
  resultId: { type: String, required: true },
  displayId: { type: String, default: null },
  // The (appeal-adjusted) evaluation object — provides the attach targets.
  evaluation: { type: Object, default: null },
})
const emit = defineEmits(['close', 'submitted'])

const SOURCES = [
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'cashline_data', label: 'Cashline Data Verification' },
  { value: 'card_holder', label: 'Card Holder Verification' },
  { value: 'others', label: 'Others' },
]

const source = ref('')
const targetItemCode = ref('')  // scorecard item_code
const targetField = ref('')     // verification raw field name
const errorCode = ref('')
const riskBaseVal = ref('')  // QC-edited Risk Base override ('' => use catalog default)
const referenceVal = ref('')
const extractedVal = ref('')
const reasonVal = ref('')
const timestampVal = ref('')
const evidenceVal = ref('')
const ticketVal = ref('')
const errorMsg = ref('')
const submitting = ref(false)

const isVerification = computed(() => ['cashline_data', 'card_holder'].includes(source.value))
const referenceLabel = computed(() => (source.value === 'cashline_data' ? 'TMS' : 'Ascend'))
const sourceHint = computed(() => {
  if (source.value === 'others') return 'Error di luar sumber terstruktur — tampil di tabel, tidak mengubah skor.'
  if (source.value === 'scorecard') return 'Menandai item scorecard SESUAI menjadi error (skor turun sebesar bobot item).'
  if (isVerification.value) return 'Menandai field MATCH menjadi MISMATCH (skor turun sesuai penalti field).'
  return 'Pilih sumber error terlebih dahulu.'
})

// Title-case a snake_case field to match the backend titleize_field (item_code key).
function titleize(f) {
  return String(f || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

const scorecardOptions = computed(() =>
  (props.evaluation?.scorecard_result || []).filter((it) => (it || {}).status === 'SESUAI'))
const verificationOptions = computed(() => {
  const key = source.value === 'cashline_data' ? 'cashline_data_verification' : 'card_holder_verification'
  return (props.evaluation?.[key] || []).filter((v) => (v || {}).match === 'MATCH')
})

// Prefill reference/extracted from the chosen field's current (matching) values.
watch(targetField, (f) => {
  const hit = verificationOptions.value.find((v) => v.field === f)
  if (hit) {
    referenceVal.value = hit.reference_value != null ? String(hit.reference_value) : ''
    extractedVal.value = hit.extracted_value != null ? String(hit.extracted_value) : ''
  }
})
// Reset target when the source changes.
watch(source, () => {
  targetItemCode.value = ''
  targetField.value = ''
})
// Clear the Risk Base override when the error code changes, so the placeholder
// always reflects the newly-selected code's default.
watch(errorCode, () => { riskBaseVal.value = '' })

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
// Risk Base of the selected Error Code — derived automatically from the master
// catalog, updating as the dropdown changes.
const selectedRiskBase = computed(() => {
  const code = errorCode.value
  if (!code) return ''
  for (const g of errorReasonGroups.value) {
    const o = (g.items || []).find((it) => it.code === code)
    if (o) return o.risk_base || ''
  }
  return ''
})

const itemCode = computed(() => {
  if (source.value === 'scorecard') return targetItemCode.value
  if (isVerification.value) return targetField.value ? titleize(targetField.value) : ''
  return ''
})

const canSubmit = computed(() => {
  if (submitting.value || !source.value || !errorCode.value) return false
  if (![reasonVal, timestampVal, evidenceVal, ticketVal].every((f) => f.value.trim().length > 0)) return false
  if (source.value === 'scorecard' && !targetItemCode.value) return false
  if (isVerification.value && (!targetField.value || !referenceVal.value.trim() || !extractedVal.value.trim())) return false
  return true
})

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const form = new FormData()
    form.append('result_id', props.resultId)
    form.append('appeal_kind', 'add')
    form.append('add_source', source.value)
    form.append('error_code', errorCode.value)
    form.append('item_code', itemCode.value)
    form.append('qc_risk_base', riskBaseVal.value.trim())
    form.append('qc_reason', reasonVal.value.trim())
    form.append('qc_evidence', `${timestampVal.value.trim()} ${evidenceVal.value.trim()}`.trim())
    form.append('qc_ticket_id', ticketVal.value.trim())
    if (isVerification.value) {
      form.append('qc_reference_value', referenceVal.value.trim())
      form.append('qc_extracted_value', extractedVal.value.trim())
    }
    const res = await apiClient.post('/error_code_appeal', form)
    emit('submitted', { resultId: props.resultId, appeal: res.data })
    close()
  } catch (e) {
    if (e.response?.status === 409) {
      errorMsg.value = 'Sudah ada banding aktif untuk error code + item ini.'
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

.section { display: flex; flex-direction: column; gap: 8px; }
.section-title { font-size: 13px; font-weight: 700; color: var(--text); }
.section-hint { font-size: 12px; color: var(--text-muted); margin: -2px 0 2px; line-height: 1.4; }
.req { color: var(--red); font-weight: 700; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--text); }
.rb-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 6px 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; }
.rb-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.rb-val { font-size: 13px; color: var(--text); }
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
