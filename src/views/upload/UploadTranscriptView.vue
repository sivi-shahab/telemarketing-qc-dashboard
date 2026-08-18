<template>
  <SidebarLayout title="Upload Transcript">
    <div class="upload-page">
      <div class="upload-card">
        <h2 class="card-title">Upload Transkrip (PDF)</h2>
        <p class="card-subtitle">Bisa banyak file <strong>.pdf</strong> sekaligus (multi-panggilan satu sesi).</p>

        <!-- Drop zone -->
        <div
          class="drop-zone"
          :class="{ dragging: isDragging, 'has-file': files.length }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="fileInput.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".pdf"
            multiple
            class="hidden-input"
            @change="handleFileSelect"
          />
          <div v-if="!files.length" class="drop-placeholder">
            <p>Drag & drop file PDF di sini</p>
            <p class="drop-hint">atau klik untuk browse (multi-file)</p>
          </div>
          <div v-else class="file-list">
            <div v-for="(f, i) in files" :key="i" class="file-row">
              <span class="file-name">{{ f.name }}</span>
              <span class="file-size">{{ formatSize(f.size) }}</span>
              <button class="remove-btn" @click.stop="removeFile(i)">✕</button>
            </div>
          </div>
        </div>

        <div v-if="formatError" class="error-msg">{{ formatError }}</div>

        <!-- Campaign dropdown -->
        <div class="field">
          <label>Campaign <span class="required">*</span></label>
          <select v-model="campaign" class="text-input">
            <option value="" disabled>Pilih campaign...</option>
            <option v-for="c in campaigns" :key="c.id" :value="c.name">{{ c.name }}</option>
          </select>
          <span v-if="!campaigns.length" class="field-hint">
            <template v-if="campaignScoped">
              Tidak ada campaign aktif dalam cakupan role Anda.
            </template>
            <template v-else>
              Belum ada campaign. Upload dulu di <RouterLink to="/upload/campaign">Upload Campaign</RouterLink>.
            </template>
          </span>
        </div>

        <!-- Mode pemrosesan: reuse hasil lama vs proses ulang lewat LLM -->
        <div class="field">
          <label>Mode Pemrosesan</label>
          <div class="mode-toggle">
            <button
              type="button"
              class="mode-option"
              :class="{ active: reuseMode }"
              @click="reuseMode = true"
            >Reuse hasil sebelumnya</button>
            <button
              type="button"
              class="mode-option"
              :class="{ active: !reuseMode }"
              @click="reuseMode = false"
            >⟳ Proses ulang (LLM)</button>
          </div>
          <span class="field-hint">
            <template v-if="reuseMode">
              Jika ID ini sudah punya hasil sebelumnya, hasil itu dipakai ulang tanpa proses ulang. Bila belum ada, otomatis diproses via LLM.
            </template>
            <template v-else>
              Selalu proses ulang lewat LLM dan buat hasil baru — banding/approval dari hasil lama tidak ikut.
            </template>
          </span>
        </div>

        <button
          class="btn-upload"
          :disabled="!canSubmit || uploading"
          @click="uploadFiles"
        >
          <span v-if="uploading" class="spinner"></span>
          {{ uploading ? 'Mengupload...' : 'Upload Transcript' }}
        </button>

        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>

        <!-- Success -->
        <div v-if="result" class="success-card">
          <div class="success-title">✓ Upload berhasil!</div>
          <div class="job-id-row">
            <span class="job-id-label">Result ID:</span>
            <code class="job-id">{{ result.result_id }}</code>
            <button class="copy-btn" @click="copyId" :class="{ copied }">
              {{ copied ? '✓ Copied' : 'Copy' }}
            </button>
          </div>
          <div class="status-row">
            Status: <span class="status-badge" :class="result.status === 'done' ? 'badge-green' : 'badge-yellow'">{{ result.status }}</span>
            <span class="mode-badge" :class="result.reused ? 'badge-green' : 'badge-blue'">
              {{ result.reused ? 'Di-reuse dari hasil sebelumnya' : '⟳ Diproses via LLM' }}
            </span>
          </div>
          <p class="success-hint">
            <template v-if="reuseMode && !result.reused">
              Belum ada hasil sebelumnya untuk ID ini, jadi diproses via LLM.
            </template>
            Cek hasil di <RouterLink to="/upload/result">Get Result</RouterLink>.
          </p>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import { campaignObjectsInScope, isCampaignScoped } from '../../utils/campaignScope.js'

const fileInput = ref(null)
const files = ref([])
const campaigns = ref([])
const campaignScoped = computed(() => isCampaignScoped())
const campaign = ref('')
const isDragging = ref(false)
const uploading = ref(false)
const formatError = ref('')
const uploadError = ref('')
const result = ref(null)
const copied = ref(false)
const reuseMode = ref(true)  // true = reuse hasil lama; false = paksa proses ulang (LLM)

const canSubmit = computed(
  () => files.value.length > 0 && !!campaign.value
)

function addFiles(fileList) {
  const incoming = Array.from(fileList)
  const bad = incoming.find(f => !f.name.toLowerCase().endsWith('.pdf'))
  if (bad) {
    formatError.value = `File '${bad.name}' bukan PDF. Hanya .pdf yang diterima.`
    return
  }
  formatError.value = ''
  files.value.push(...incoming)
  result.value = null
}

function handleFileSelect(e) {
  if (e.target.files?.length) addFiles(e.target.files)
  if (fileInput.value) fileInput.value.value = ''
}

function handleDrop(e) {
  isDragging.value = false
  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
}

function removeFile(i) {
  files.value.splice(i, 1)
}

async function uploadFiles() {
  if (!canSubmit.value) return
  uploading.value = true
  uploadError.value = ''
  result.value = null
  try {
    const form = new FormData()
    files.value.forEach(f => form.append('files', f))
    form.append('campaign', campaign.value)
    form.append('reuse', reuseMode.value ? 'true' : 'false')
    const res = await apiClient.post('/upload_transcript', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    result.value = res.data
    files.value = []
  } catch (e) {
    if (e.response?.status === 422) {
      uploadError.value = e.response.data?.detail || 'Input tidak valid.'
    } else {
      uploadError.value = 'Upload gagal. Coba lagi.'
    }
  } finally {
    uploading.value = false
  }
}

async function copyId() {
  if (!result.value?.result_id) return
  await navigator.clipboard.writeText(result.value.result_id)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Campaign aktif yang boleh diunggah login ini — lihat catatan yang sama di
// UploadAudioView.
onMounted(async () => {
  try {
    const res = await apiClient.get('/list_campaigns')
    campaigns.value = campaignObjectsInScope(
      (res.data.campaigns || []).filter(c => c.is_active)
    )
  } catch {
    campaigns.value = []
  }
})
</script>

<style scoped>
.upload-page { display: flex; justify-content: center; }

.upload-card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 32px 36px; width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 18px;
}

.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -10px; }

.drop-zone {
  border: 2px dashed var(--border); border-radius: 12px;
  padding: 24px; cursor: pointer; transition: all 0.2s; background: #fafbfc; min-height: 120px;
  display: flex; align-items: center; justify-content: center;
}
.drop-zone:hover, .drop-zone.dragging { border-color: var(--blue); background: var(--blue-bg); }
.drop-zone.has-file { border-color: var(--green); background: var(--green-bg); }

.hidden-input { display: none; }

.drop-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.drop-icon { font-size: 32px; }
.drop-placeholder p { font-size: 14px; font-weight: 500; color: var(--text); }
.drop-hint { font-size: 12px; color: var(--text-muted) !important; }

.file-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.file-row { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
.file-icon { font-size: 18px; }
.file-name { flex: 1; font-weight: 600; font-size: 13px; word-break: break-all; }
.file-size { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

.remove-btn {
  background: #fee2e2; border: none; color: var(--red); width: 24px; height: 24px;
  border-radius: 50%; font-size: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.remove-btn:hover { background: #fecaca; }

.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 13px; font-weight: 600; }
.required { color: var(--red); }
.field-hint { font-size: 12px; color: var(--text-muted); }
.field-hint a { color: var(--blue); font-weight: 600; }

.text-input {
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; transition: border-color 0.2s; background: #fff;
}
.text-input:focus { border-color: var(--blue); }

.btn-upload {
  padding: 12px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;
}
.btn-upload:hover:not(:disabled) { background: #2563eb; }
.btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 500;
}

.success-card {
  background: var(--green-bg); border: 1px solid #bbf7d0;
  border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;
}
.success-title { font-weight: 700; color: #16a34a; font-size: 15px; }

.job-id-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.job-id-label { font-size: 13px; font-weight: 600; color: var(--text); }
code.job-id {
  background: #fff; border: 1px solid #bbf7d0; border-radius: 6px;
  padding: 4px 10px; font-family: monospace; font-size: 13px; word-break: break-all;
}

.copy-btn {
  background: var(--green); color: #fff; border: none; border-radius: 6px;
  padding: 4px 12px; font-size: 12px; font-weight: 700; transition: background 0.2s;
}
.copy-btn:hover { background: #16a34a; }
.copy-btn.copied { background: #15803d; }

.status-row { font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.status-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.badge-yellow { background: var(--yellow-bg); color: #b45309; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.mode-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }

/* Mode toggle (Reuse vs Proses ulang) */
.mode-toggle { display: flex; gap: 6px; background: #f1f5f9; border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
.mode-option {
  flex: 1; padding: 8px 10px; border: none; background: transparent; border-radius: 7px;
  font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.mode-option:hover { color: var(--text); }
.mode-option.active { background: #fff; color: var(--blue); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

.success-hint { font-size: 12px; color: var(--text-muted); }
.success-hint a { color: var(--blue); font-weight: 600; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
