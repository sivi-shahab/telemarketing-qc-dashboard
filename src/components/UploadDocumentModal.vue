<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">Upload Document</h2>
            <p class="modal-subtitle">
              Dokumen pendukung yang diminta untuk tiket ini — unggah yang relevan
              (boleh sebagian saja, sisanya bisa menyusul).
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="docId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ docId }}</code>
          </div>
          <div class="id-row">
            <span class="id-label">Result ID</span>
            <code class="id-value">{{ resultId }}</code>
          </div>

          <!-- One picker per allowed document type (restricted to the changed fields) -->
          <p v-if="!visibleTypes.length" class="hint">Tidak ada dokumen yang perlu diunggah.</p>
          <div class="slots">
            <div v-for="d in visibleTypes" :key="d.key" class="slot">
              <div class="slot-label">{{ d.label }}</div>

              <input
                :ref="el => (inputs[d.key] = el)"
                type="file"
                accept=".pdf,application/pdf"
                class="hidden-input"
                @change="onPick(d.key, $event)"
              />

              <!-- Empty state -->
              <button v-if="!files[d.key]" class="pick-btn" @click="openPicker(d.key)">
                <span>Pilih file</span>
              </button>

              <!-- Selected state -->
              <div v-else class="file-chip">
                <span class="thumb thumb-pdf">PDF</span>
                <div class="file-meta">
                  <span class="file-name">{{ files[d.key].name }}</span>
                  <span class="file-size">{{ formatSize(files[d.key].size) }}</span>
                </div>
                <button class="file-remove" aria-label="Hapus" @click="clearSlot(d.key)">✕</button>
              </div>
            </div>
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
          <p class="hint">Format yang diterima: PDF. Hanya file yang dipilih yang akan diproses (OCR).</p>
        </div>

        <footer class="modal-foot">
          <span class="selected-count">{{ selectedCount }} dokumen dipilih</span>
          <div class="foot-actions">
            <button class="btn-cancel" @click="close">Batal</button>
            <button class="btn-submit" :disabled="!canSubmit" @click="submit">
              <span v-if="submitting" class="spinner"></span>
              {{ submitting ? 'Mengupload...' : 'Upload Document' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../api/client.js'

const props = defineProps({
  resultId: { type: String, required: true },
  docId: { type: String, default: null },
  // Document types still required for this result (TMS data changes, limit >= 50jt,
  // or a card-holder similarity band). When null, all types are shown (backward
  // compatible).
  allowedTypes: { type: Array, default: null },
})
const emit = defineEmits(['close', 'uploaded'])

const DOC_TYPES = [
  { key: 'ktp', label: 'KTP' },
  { key: 'kk', label: 'KK' },
  { key: 'npwp', label: 'NPWP' },
  { key: 'cover_buku_tabungan', label: 'Cover Buku Tabungan' },
]

// Only the slots matching the changed fields are shown.
const visibleTypes = computed(() =>
  props.allowedTypes ? DOC_TYPES.filter((d) => props.allowedTypes.includes(d.key)) : DOC_TYPES
)

const ALLOWED = ['application/pdf']
const ALLOWED_EXT = ['.pdf']

const inputs = {}
const files = reactive({})
const errorMsg = ref('')
const submitting = ref(false)

const selectedCount = computed(() => Object.values(files).filter(Boolean).length)
const canSubmit = computed(() => selectedCount.value > 0 && !submitting.value)

function isPdf(file) {
  if (ALLOWED.includes(file.type)) return true
  const name = (file.name || '').toLowerCase()
  return ALLOWED_EXT.some(ext => name.endsWith(ext))
}

function openPicker(key) {
  inputs[key]?.click()
}

function onPick(key, e) {
  const file = e.target.files?.[0]
  if (e.target) e.target.value = ''
  if (!file) return
  if (!isPdf(file)) {
    errorMsg.value = `File '${file.name}' bukan PDF. Hanya file PDF yang diterima.`
    return
  }
  errorMsg.value = ''
  files[key] = file
}

function clearSlot(key) {
  files[key] = null
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const form = new FormData()
    form.append('result_id', props.resultId)
    visibleTypes.value.forEach((d) => {
      if (files[d.key]) form.append(d.key, files[d.key])
    })
    const res = await apiClient.post('/upload_document', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    emit('uploaded', { resultId: props.resultId, documents: res.data?.documents || [] })
    close()
  } catch (e) {
    if (e.response?.status === 409) {
      errorMsg.value = 'Dokumen untuk result ini sudah pernah diunggah.'
    } else if (e.response?.status === 422 || e.response?.status === 404) {
      errorMsg.value = e.response.data?.detail || 'Input tidak valid.'
    } else {
      errorMsg.value = 'Upload gagal. Coba lagi.'
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
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 100;
}

.modal-card {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--border);
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--text); }
.modal-subtitle { font-size: 12.5px; color: var(--text-muted); margin-top: 3px; }

.close-x {
  background: #f1f5f9; border: none; color: var(--text-muted);
  width: 28px; height: 28px; border-radius: 8px; font-size: 13px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.close-x:hover { background: #e2e8f0; color: var(--text); }

.modal-body { padding: 18px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }

.id-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.id-label { font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; min-width: 64px; }
code.id-value {
  background: #f8fafc; border: 1px solid var(--border); border-radius: 6px;
  padding: 3px 8px; font-family: monospace; font-size: 12px; color: var(--text); word-break: break-all;
}

.slots { display: flex; flex-direction: column; gap: 12px; }
.slot { display: flex; flex-direction: column; gap: 6px; }
.slot-label { font-size: 13px; font-weight: 600; color: var(--text); }

.hidden-input { display: none; }

.pick-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border: 1.5px dashed var(--border); border-radius: 10px;
  background: #fafbfc; color: var(--text-muted); font-size: 13px; font-weight: 600; transition: all 0.15s;
}
.pick-btn:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-bg); }
.pick-icon { font-size: 16px; }

.file-chip {
  display: flex; align-items: center; gap: 12px;
  border: 1.5px solid var(--green); background: var(--green-bg);
  border-radius: 10px; padding: 8px 12px;
}
.thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #bbf7d0; flex-shrink: 0; background: #fff; }
.thumb-pdf { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #16a34a; background: #f0fdf4; }
.file-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.file-name { font-size: 13px; font-weight: 600; color: var(--text); word-break: break-all; }
.file-size { font-size: 11.5px; color: var(--text-muted); }
.file-remove {
  background: #fee2e2; border: none; color: var(--red); width: 24px; height: 24px;
  border-radius: 50%; font-size: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.file-remove:hover { background: #fecaca; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-weight: 500;
}
.hint { font-size: 12px; color: var(--text-muted); }

.modal-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 24px; border-top: 1px solid var(--border); background: #fafbfc;
}
.selected-count { font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
.foot-actions { display: flex; gap: 10px; }

.btn-cancel {
  padding: 9px 16px; background: #fff; border: 1.5px solid var(--border);
  border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-muted); transition: all 0.15s;
}
.btn-cancel:hover { background: #f1f5f9; color: var(--text); }

.btn-submit {
  padding: 9px 18px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 13px; font-weight: 700; transition: background 0.15s;
  display: flex; align-items: center; gap: 8px;
}
.btn-submit:hover:not(:disabled) { background: #2563eb; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
