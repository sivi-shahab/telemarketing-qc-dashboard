<template>
  <div v-if="documents.length || loading" class="block docs-block">
    <div class="block-title">📎 Documents ({{ documents.length }})</div>

    <div v-if="loading && !documents.length" class="docs-loading">
      <span class="spinner"></span> Memuat dokumen...
    </div>

    <div class="docs-grid">
      <div v-for="d in documents" :key="d.id" class="doc-card">
        <div class="doc-head">
          <span class="doc-label">{{ d.label || d.doc_type }}</span>
          <div class="doc-head-right">
            <button class="toggle-btn" @click="toggleOpen(d.id)">
              {{ openDocs[d.id] ? 'Hide' : 'Open' }}
            </button>
            <span :class="['badge', statusBadge(d.status)]">{{ d.status }}</span>
          </div>
        </div>

        <div class="doc-body">
          <!-- PDF preview (multi-page; browser's built-in viewer). Hidden by
               default; only loaded/rendered once the user opens it. -->
          <div v-if="openDocs[d.id]" class="doc-image">
            <iframe v-if="fileUrls[d.id]" :src="fileUrls[d.id]" class="doc-pdf" :title="d.label"></iframe>
            <div v-else class="img-placeholder"><span class="spinner"></span></div>
          </div>

          <!-- OCR + verification result -->
          <div class="doc-ocr">
            <div v-if="d.status === 'done' && verifications(d).length">
              <table class="verif-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>{{ acuanSourceLabel(d.doc_type) }}</th>
                    <th>Transkrip</th>
                    <th>Dokumen</th>
                    <th>Similarity</th>
                    <th>Match</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(v, i) in verifications(d)" :key="i">
                    <td class="vt-field">{{ v.field }}</td>
                    <td>{{ formatVal(v.acuan) }}</td>
                    <td>{{ formatVal(transkripFor(v)) }}</td>
                    <td>{{ formatVal(v.document) }}</td>
                    <td>{{ v.similarity != null ? v.similarity + '%' : '—' }}</td>
                    <td>
                      <span :class="['badge', v.match ? 'badge-green' : 'badge-red']">
                        {{ v.match ? 'Match' : 'No Match' }}
                      </span>
                    </td>
                    <td class="vt-reason">{{ formatVal(v.reason) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else-if="d.status === 'done' && d.ocr_json" class="ocr-raw">
              <pre>{{ JSON.stringify(d.ocr_json, null, 2) }}</pre>
            </div>
            <div v-else-if="d.status === 'failed'" class="ocr-failed">
              ✗ OCR gagal: {{ d.error_message || 'Unknown error' }}
            </div>
            <div v-else class="ocr-pending">
              <span class="spinner"></span> Memproses OCR...
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../api/client.js'

const props = defineProps({
  resultId: { type: String, required: true },
  // Hasil evaluasi QC utama (result.evaluation) — sumber nilai kolom "Transkrip".
  // null saat hasil belum tersedia; kolom Transkrip lalu menampilkan "—".
  evaluation: { type: Object, default: null },
})

// Sumber data acuan per jenis dokumen: KK dari ascend_custp (Ascend), sisanya
// (ktp/npwp/cover_buku_tabungan) dari tms_cashline (TMS).
function acuanSourceLabel(docType) {
  return docType === 'kk' ? 'Ascend' : 'TMS'
}

// Label field OCR dokumen -> field pada verifikasi transkrip QC. Field yang tidak
// terdaftar (Nama, NIK, Nomor NPWP) tidak diverifikasi lewat transkrip -> "—".
const FIELD_TO_QC = {
  'alamat rumah': 'alamat_rumah',
  'nama ibu kandung': 'nama_ibu_kandung',
  'nama bank': 'nama_bank',
  'nama pemilik rekening': 'nama_pemilik_rekening',
  'nomor rekening': 'nomor_rekening',
}

// Ambil nilai transkrip (extracted_value) untuk satu baris verifikasi dokumen,
// dicari di Card Holder + Cashline Data verification pada hasil QC utama.
function transkripFor(v) {
  const key = FIELD_TO_QC[String(v?.field || '').trim().toLowerCase()]
  if (!key || !props.evaluation) return null
  const arr = [
    ...(props.evaluation.card_holder_verification || []),
    ...(props.evaluation.cashline_data_verification || []),
  ]
  const hit = arr.find((x) => x.field === key)
  return hit ? hit.extracted_value : null
}

const documents = ref([])
const loading = ref(false)
const fileUrls = reactive({})
const openDocs = reactive({}) // doc.id -> bool; PDF preview hidden by default
let pollTimer = null

function toggleOpen(id) {
  openDocs[id] = !openDocs[id]
  if (openDocs[id]) {
    const doc = documents.value.find((d) => d.id === id)
    if (doc) loadFile(doc) // lazy-load the PDF only when first opened
  }
}

function statusBadge(status) {
  return {
    pending: 'badge-gray',
    processing: 'badge-blue',
    done: 'badge-green',
    failed: 'badge-red',
  }[status] || 'badge-gray'
}

function verifications(d) {
  const list = d?.ocr_json?.verifications
  return Array.isArray(list) ? list : []
}

function formatVal(val) {
  if (val == null || val === '') return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

async function loadFile(doc) {
  if (fileUrls[doc.id]) return
  try {
    const res = await apiClient.get(`/document_file/${doc.id}`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    fileUrls[doc.id] = URL.createObjectURL(blob)
  } catch {
    /* leave placeholder */
  }
}

async function fetchDocuments() {
  loading.value = true
  try {
    const res = await apiClient.get(`/documents/${props.resultId}`)
    documents.value = res.data?.documents || []
    schedulePollIfNeeded()
  } catch {
    documents.value = []
  } finally {
    loading.value = false
  }
}

function schedulePollIfNeeded() {
  clearTimeout(pollTimer)
  const stillRunning = documents.value.some(
    (d) => d.status === 'pending' || d.status === 'processing'
  )
  if (stillRunning) {
    pollTimer = setTimeout(fetchDocuments, 5000)
  }
}

onMounted(fetchDocuments)
onBeforeUnmount(() => {
  clearTimeout(pollTimer)
  Object.values(fileUrls).forEach((url) => URL.revokeObjectURL(url))
})
</script>

<style scoped>
.block { margin-top: 16px; }
.block-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 10px; }

.docs-loading { display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 13px; }

.docs-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }

.doc-card { border: 1px solid var(--border); border-radius: 10px; background: #fff; overflow: hidden; }
.doc-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-bottom: 1px solid var(--border); background: #f8fafc;
}
.doc-label { font-size: 13px; font-weight: 700; color: var(--text); }
.doc-head-right { display: flex; align-items: center; gap: 8px; }
.toggle-btn {
  font-size: 12px; font-weight: 600; color: var(--blue);
  background: var(--blue-bg); border: 1px solid var(--blue);
  border-radius: 6px; padding: 3px 12px; cursor: pointer;
}
.toggle-btn:hover { filter: brightness(0.97); }

.doc-body { display: flex; flex-direction: column; gap: 10px; padding: 12px; }

.doc-image { background: #f1f5f9; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 140px; }
.doc-pdf { width: 100%; height: 85vh; min-height: 600px; border: 0; display: block; }
.img-placeholder { padding: 30px; }

.verif-table { width: 100%; border-collapse: collapse; }
.verif-table th {
  text-align: left; padding: 7px 8px; font-size: 11.5px; font-weight: 700;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;
  border-bottom: 2px solid #e2e8f0; background: #f8fafc; white-space: nowrap;
}
.verif-table td {
  padding: 7px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px;
  vertical-align: top; color: var(--text); word-break: break-word;
}
.vt-field { font-weight: 600; color: var(--text); white-space: nowrap; }
.vt-reason { color: var(--text-muted); }

.ocr-raw pre {
  margin: 0; padding: 10px; background: #f8fafc; border-radius: 8px;
  font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
}

.ocr-failed { color: var(--red); font-size: 12.5px; }
.ocr-pending { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 12.5px; }

.badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: capitalize; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }

.spinner {
  width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: var(--blue);
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
