<template>
  <SidebarLayout title="Generate PPT Error Rate">
    <div class="ppt-page">
      <div class="ppt-card">
        <h2 class="card-title">Generate PPT Error Rate Update</h2>
        <p class="card-subtitle">
          Membuat deck <strong>.pptx</strong> mengikuti struktur "Error Rate Update" bulanan,
          diisi otomatis dari data Stats untuk dua periode di bawah.
        </p>

        <div class="period-row">
          <label class="field">
            <span class="field-label">Bulan Berjalan</span>
            <input type="month" v-model="periodCurrent" class="field-input" />
          </label>
          <label class="field">
            <span class="field-label">Bulan Pembanding</span>
            <input type="month" v-model="periodPrevious" class="field-input" />
          </label>
        </div>

        <div v-if="rangeError" class="error-msg">{{ rangeError }}</div>

        <button class="btn-generate" :disabled="!canGenerate || generating" @click="generate">
          <span v-if="generating" class="spinner"></span>
          {{ generating ? 'Membuat PPT...' : 'Generate PPT' }}
        </button>

        <div v-if="generateError" class="error-msg">{{ generateError }}</div>
        <div v-if="doneMsg" class="success-msg">{{ doneMsg }}</div>

        <div class="info-banner">
          <div class="info-title">Bagian yang tetap kosong (isi manual setelah unduh)</div>
          <ul class="info-list">
            <li>Kolom <strong>Sampling (%)</strong> dan volume Submission ASLI sebelum sampling — sistem QC hanya melihat tiket yang sudah masuk ke QC.</li>
            <li>Kolom <strong>%KPI</strong> dan status pencapaian (U/A/S/E1-E3) — data KPI sales tidak ada di sistem ini.</li>
            <li>Seluruh section <strong>Complaint</strong> (Type of Customer Commentary, Fault Category) — tidak ada model data untuk ini.</li>
            <li>Baris campaign <strong>Credit Shield</strong> dan <strong>Personal Loan</strong> — belum terdaftar di sistem QC.</li>
          </ul>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { computed, ref } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

function defaultMonth(offset) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const periodCurrent = ref(defaultMonth(0))
const periodPrevious = ref(defaultMonth(-1))
const generating = ref(false)
const generateError = ref('')
const doneMsg = ref('')

const rangeError = computed(() => {
  if (!periodCurrent.value || !periodPrevious.value) return ''
  if (periodCurrent.value === periodPrevious.value) {
    return 'Bulan Berjalan dan Bulan Pembanding harus berbeda.'
  }
  return ''
})

const canGenerate = computed(
  () => !!periodCurrent.value && !!periodPrevious.value && !rangeError.value
)

async function generate() {
  if (!canGenerate.value || generating.value) return
  generating.value = true
  generateError.value = ''
  doneMsg.value = ''
  try {
    const res = await apiClient.get('/stats/export_error_rate_pptx', {
      params: { period_current: periodCurrent.value, period_previous: periodPrevious.value },
      responseType: 'blob',
    })
    downloadBlob(res, `Error Rate Update ${periodCurrent.value}.pptx`)
    doneMsg.value = 'PPT berhasil dibuat dan diunduh.'
  } catch (e) {
    if (e.response?.status === 403) {
      generateError.value = 'Role Anda tidak memiliki akses Generate PPT Error Rate.'
    } else if (e.response?.status === 422) {
      generateError.value = 'Periode tidak valid.'
    } else {
      generateError.value = 'Gagal membuat PPT. Coba lagi.'
    }
  } finally {
    generating.value = false
  }
}

// Simpan respons blob sebagai unduhan, memakai nama file dari Content-Disposition
// bila ada (backend mengirim "Error Rate Update <periode>.pptx").
function downloadBlob(res, fallbackName) {
  const url = URL.createObjectURL(
    new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
  )
  const disposition = res.headers['content-disposition'] || ''
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  const a = document.createElement('a')
  a.href = url
  a.download = match ? decodeURIComponent(match[1]) : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.ppt-page { display: flex; justify-content: center; }

.ppt-card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 32px 36px; width: 100%; max-width: 620px; display: flex; flex-direction: column; gap: 18px;
}

.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -10px; }

.period-row { display: flex; gap: 16px; }
.field { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.field-input {
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;
}

.btn-generate {
  padding: 12px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;
}
.btn-generate:hover:not(:disabled) { background: #2563eb; }
.btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 500;
}
.success-msg {
  background: var(--green-bg); color: #16a34a; border: 1px solid #bbf7d0;
  border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600;
}

.info-banner {
  background: #fafbfc; border: 1px solid var(--border); border-radius: 12px;
  padding: 16px 18px; display: flex; flex-direction: column; gap: 8px;
}
.info-title { font-size: 13px; font-weight: 700; color: var(--text); }
.info-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.info-list li { font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
