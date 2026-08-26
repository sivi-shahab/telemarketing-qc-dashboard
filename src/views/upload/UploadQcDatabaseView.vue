<template>
  <SidebarLayout title="Upload Database QC">
    <div class="upload-page">
      <div class="upload-card">
        <h2 class="card-title">Upload Database QC</h2>
        <p class="card-subtitle">
          Satu file <strong>.xlsx</strong>. Database QC terbaru menjadi <strong>active</strong>;
          database sebelumnya otomatis menjadi <strong>inactive</strong>.
        </p>

        <div
          class="drop-zone"
          :class="{ dragging: isDragging, 'has-file': !!file }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="fileInput.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            class="hidden-input"
            @change="handleFileSelect"
          />
          <div v-if="!file" class="drop-placeholder">
            <p>Drag &amp; drop file .xlsx di sini</p>
            <p class="drop-hint">atau klik untuk browse</p>
          </div>
          <div v-else class="file-row">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
            <button class="remove-btn" @click.stop="clearFile">✕</button>
          </div>
        </div>

        <div v-if="formatError" class="error-msg">{{ formatError }}</div>

        <button class="btn-upload" :disabled="!file || uploading" @click="uploadFile">
          <span v-if="uploading" class="spinner"></span>
          {{ uploading ? 'Mengupload...' : 'Upload Database QC' }}
        </button>

        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>

        <div v-if="result" class="success-card">
          <div class="success-title">✓ Database QC "{{ result.filename }}" tersimpan!</div>
          <div class="status-row">
            Status: <span class="status-badge badge-green">✓ Active</span>
          </div>
          <p class="success-hint">
            Lihat di <RouterLink to="/dashboard/qc-database">Database QC</RouterLink>.
          </p>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const formatError = ref('')
const uploadError = ref('')
const result = ref(null)

function isXlsx(name) {
  return (name || '').toLowerCase().endsWith('.xlsx')
}

function setFile(f) {
  if (!isXlsx(f.name)) {
    formatError.value = `File '${f.name}' bukan .xlsx. Hanya file .xlsx yang diterima.`
    return
  }
  formatError.value = ''
  file.value = f
  result.value = null
}

function handleFileSelect(e) {
  const f = e.target.files?.[0]
  if (f) setFile(f)
  if (fileInput.value) fileInput.value.value = ''
}

function handleDrop(e) {
  isDragging.value = false
  const f = e.dataTransfer.files?.[0]
  if (f) setFile(f)
}

function clearFile() {
  file.value = null
}

async function uploadFile() {
  if (!file.value) return
  uploading.value = true
  uploadError.value = ''
  result.value = null
  try {
    const form = new FormData()
    form.append('file', file.value)
    const res = await apiClient.post('/upload_qc_database', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    result.value = res.data
    file.value = null
  } catch (e) {
    if (e.response?.status === 422) {
      uploadError.value = e.response.data?.detail || 'Input tidak valid.'
    } else if (e.response?.status === 403) {
      uploadError.value = 'Akses hanya untuk SPQ Head / Admin.'
    } else {
      uploadError.value = 'Upload gagal. Coba lagi.'
    }
  } finally {
    uploading.value = false
  }
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
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
.file-row { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; width: 100%; }
.file-icon { font-size: 18px; }
.file-name { flex: 1; font-weight: 600; font-size: 13px; word-break: break-all; }
.file-size { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.remove-btn {
  background: #fee2e2; border: none; color: var(--red); width: 24px; height: 24px;
  border-radius: 50%; font-size: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.remove-btn:hover { background: #fecaca; }
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
.status-row { font-size: 13px; color: var(--text); }
.status-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.success-hint { font-size: 12px; color: var(--text-muted); }
.success-hint a { color: var(--blue); font-weight: 600; }
.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
