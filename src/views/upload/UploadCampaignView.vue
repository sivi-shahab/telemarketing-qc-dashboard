<template>
  <SidebarLayout title="Upload Campaign">
    <div class="upload-page">
      <div class="upload-card">
        <h2 class="card-title">Upload Detail Campaign</h2>
        <p class="card-subtitle">
          Tiga file <strong>.txt</strong>: scorecard, knowledge base, dan prompt. Dipakai apa adanya sebagai input LLM (tidak di-parse).
        </p>

        <div class="field">
          <label>Nama Campaign <span class="required">*</span></label>
          <input v-model="campaign" type="text" class="text-input" placeholder="Contoh: Cashline" />
        </div>

        <FilePicker label="Scorecard (.txt)" :file="scorecard" @pick="f => (scorecard = f)" @clear="scorecard = null" />
        <FilePicker label="Knowledge Base (.txt)" :file="knowledgeBase" @pick="f => (knowledgeBase = f)" @clear="knowledgeBase = null" />
        <FilePicker label="Prompt (.txt)" :file="prompt" @pick="f => (prompt = f)" @clear="prompt = null" />
        <FilePicker
          label="Upload RIPLAY (.pdf)"
          accept=".pdf"
          :required="false"
          :file="riplay"
          @pick="f => (riplay = f)"
          @clear="riplay = null"
        />
        <p class="field-hint">
          RIPLAY (Ringkasan Informasi Produk dan Layanan) adalah <strong>ground truth</strong> Bank Mega.
          PDF dikirim sebagai gambar ke LLM untuk diekstraksi; nama produk pada RIPLAY harus cocok dengan
          nama campaign (min. 50%). Nilai produk pada Knowledge Base (bunga, provisi, tenor, biaya admin, limit,
          premi, dll) otomatis mengikuti RIPLAY. Kosongkan bila ingin memakai RIPLAY yang tersimpan sebelumnya.
        </p>

        <div v-if="formatError" class="error-msg">{{ formatError }}</div>

        <button class="btn-upload" :disabled="!canSubmit || uploading" @click="uploadFiles">
          <span v-if="uploading" class="spinner"></span>
          {{ uploading ? uploadingLabel : 'Upload Campaign' }}
        </button>
        <p v-if="uploading && riplay" class="field-hint">
          Ekstraksi RIPLAY memakai LLM dan bisa memakan waktu hingga beberapa menit. Jangan tutup halaman ini.
        </p>

        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>

        <div v-if="result" class="success-card">
          <div class="success-title">✓ Campaign "{{ result.campaign }}" tersimpan!</div>
          <div class="badge-list">
            <span class="badge badge-green">scorecard: {{ result.scorecard_chars }} chars</span>
            <span class="badge badge-green">kb: {{ result.kb_chars }} chars</span>
            <span class="badge badge-green">prompt: {{ result.prompt_chars }} chars</span>
          </div>

          <div v-if="result.riplay_filename" class="riplay-box">
            <div class="riplay-title">RIPLAY: {{ result.riplay_filename }}</div>
            <div class="badge-list">
              <span class="badge badge-blue">produk: {{ result.riplay_product_name || '—' }}</span>
              <span class="badge badge-blue">similarity: {{ result.riplay_similarity }}%</span>
              <span class="badge badge-blue">{{ result.riplay_pages }} halaman</span>
            </div>
            <div v-if="(result.riplay_kb_changes || []).length" class="riplay-changes">
              <div class="riplay-sub">
                Knowledge Base disesuaikan dengan RIPLAY ({{ result.riplay_kb_changes.length }} item):
              </div>
              <div v-for="ch in result.riplay_kb_changes" :key="ch.kb_code" class="riplay-change">
                <span class="kb-chip">{{ ch.kb_code }}</span>
                <span class="kb-aspect">{{ ch.aspect }}</span>
                <span class="kb-diff">{{ shortDetails(ch.details_before) }} → {{ shortDetails(ch.details_after) }}</span>
              </div>
            </div>
            <div v-else class="riplay-sub">
              Knowledge Base sudah sesuai RIPLAY — tidak ada perubahan.
            </div>
          </div>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, h } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const campaign = ref('')
const scorecard = ref(null)
const knowledgeBase = ref(null)
const prompt = ref(null)
const riplay = ref(null)
const uploading = ref(false)
const formatError = ref('')
const uploadError = ref('')
const result = ref(null)

const canSubmit = computed(
  () => !!campaign.value.trim() && scorecard.value && knowledgeBase.value && prompt.value
)

// The RIPLAY pass renders the PDF and runs a vision LLM call, so the button says
// what it is waiting on instead of a generic "Mengupload...".
const uploadingLabel = computed(() =>
  riplay.value ? 'Mengekstraksi RIPLAY...' : 'Mengupload...'
)

function shortDetails(details) {
  if (!details) return '(belum ada)'
  return Object.values(details)
    .map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
    .join('; ')
    .slice(0, 120)
}

async function uploadFiles() {
  if (!canSubmit.value) return
  for (const [f, label] of [[scorecard.value, 'scorecard'], [knowledgeBase.value, 'knowledge base'], [prompt.value, 'prompt']]) {
    if (!f.name.toLowerCase().endsWith('.txt')) {
      formatError.value = `File ${label} harus .txt`
      return
    }
  }
  if (riplay.value && !riplay.value.name.toLowerCase().endsWith('.pdf')) {
    formatError.value = 'File RIPLAY harus .pdf'
    return
  }
  formatError.value = ''
  uploading.value = true
  uploadError.value = ''
  result.value = null
  try {
    const form = new FormData()
    form.append('scorecard', scorecard.value)
    form.append('knowledge_base', knowledgeBase.value)
    form.append('prompt', prompt.value)
    form.append('campaign', campaign.value.trim())
    if (riplay.value) form.append('riplay', riplay.value)
    const res = await apiClient.post('/upload_detail_campaign', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // RIPLAY extraction can take minutes
    })
    result.value = res.data
    scorecard.value = null
    knowledgeBase.value = null
    prompt.value = null
    riplay.value = null
  } catch (e) {
    if (e.response?.status === 422 || e.response?.status === 502) {
      uploadError.value = e.response.data?.detail || 'Input tidak valid.'
    } else {
      uploadError.value = 'Upload gagal. Coba lagi.'
    }
  } finally {
    uploading.value = false
  }
}

// Small inline single-file picker component
const FilePicker = {
  props: {
    label: String,
    file: Object,
    accept: { type: String, default: '.txt' },
    required: { type: Boolean, default: true },
  },
  emits: ['pick', 'clear'],
  setup(p, { emit }) {
    const inputRef = ref(null)
    function onChange(e) {
      const f = e.target.files?.[0]
      if (f) emit('pick', f)
      if (inputRef.value) inputRef.value.value = ''
    }
    return () =>
      h('div', { class: 'field' }, [
        h('label', [
          p.label,
          ' ',
          p.required
            ? h('span', { class: 'required' }, '*')
            : h('span', { class: 'optional' }, '(opsional)'),
        ]),
        h('input', { ref: inputRef, type: 'file', accept: p.accept, class: 'hidden-input', onChange }),
        p.file
          ? h('div', { class: 'picked' }, [
              h('span', { class: 'file-name' }, p.file.name),
              h('button', { class: 'remove-btn', onClick: () => emit('clear') }, '✕'),
            ])
          : h('button', { class: 'pick-btn', onClick: () => inputRef.value.click() }, ['Pilih file...']),
      ])
  },
}
</script>

<style scoped>
.upload-page { display: flex; justify-content: center; }

.upload-card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 32px 36px; width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 16px;
}

.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -8px; }

.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 13px; font-weight: 600; }
.required { color: var(--red); }
.optional { color: var(--text-muted); font-weight: 500; font-size: 12px; }

.field-hint { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-top: -8px; }

.text-input {
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; transition: border-color 0.2s;
}
.text-input:focus { border-color: var(--blue); }

.hidden-input { display: none; }

.pick-btn {
  padding: 10px 14px; border: 1.5px dashed var(--border); border-radius: 8px;
  background: #fafbfc; font-size: 13px; font-weight: 600; color: var(--text-muted);
  text-align: left; transition: all 0.15s;
}
.pick-btn:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-bg); }

.picked {
  display: flex; align-items: center; gap: 10px;
  border: 1.5px solid var(--green); background: var(--green-bg);
  border-radius: 8px; padding: 9px 12px;
}
.file-name { flex: 1; font-weight: 600; font-size: 13px; word-break: break-all; }
.remove-btn {
  background: #fee2e2; border: none; color: var(--red); width: 24px; height: 24px;
  border-radius: 50%; font-size: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.remove-btn:hover { background: #fecaca; }

.btn-upload {
  padding: 12px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 700; margin-top: 4px;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;
}
.btn-upload:hover:not(:disabled) { background: #2563eb; }
.btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px; font-size: 13px;
}

.success-card {
  background: var(--green-bg); border: 1px solid #bbf7d0;
  border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;
}
.success-title { font-weight: 700; color: #16a34a; font-size: 15px; }

.badge-list { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
.badge-green { background: #dcfce7; color: #16a34a; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }

.riplay-box {
  background: #fff; border: 1px solid #bbf7d0; border-radius: 10px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
}
.riplay-title { font-size: 13px; font-weight: 700; word-break: break-all; }
.riplay-sub { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.riplay-changes { display: flex; flex-direction: column; gap: 6px; }
.riplay-change {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px;
  font-size: 12px; border-top: 1px dashed var(--border); padding-top: 6px;
}
.kb-chip {
  background: #eef2ff; color: #4338ca; font-weight: 700;
  padding: 2px 8px; border-radius: 999px; font-size: 11px;
}
.kb-aspect { font-weight: 600; }
.kb-diff { color: var(--text-muted); word-break: break-word; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
