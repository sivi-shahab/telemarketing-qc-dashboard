<template>
  <SidebarLayout title="Delete Campaign">
    <div class="delete-page">
      <div class="delete-card">
        <h2 class="card-title">Hapus Campaign</h2>
        <p class="card-subtitle">
          Menghapus config campaign (prompt, scorecard, KB) dari database & arsip MinIO.
          <strong>Tindakan ini permanen.</strong> Result yang sudah ada tidak terpengaruh.
        </p>

        <div class="field">
          <label>Nama Campaign <span class="required">*</span></label>
          <select v-model="selected" class="text-input" @change="resetMsgs">
            <option value="" disabled>Pilih campaign...</option>
            <option v-for="c in campaigns" :key="c.id" :value="c.name">
              {{ c.name }}{{ c.is_active ? '' : ' (nonaktif)' }}
            </option>
          </select>
          <span v-if="!loadingList && campaigns.length === 0" class="hint">Tidak ada campaign.</span>
        </div>

        <button class="btn-delete" :disabled="!selected || deleting" @click="confirmDelete">
          <span v-if="deleting" class="spinner"></span>
          {{ deleting ? 'Menghapus...' : 'Hapus Campaign' }}
        </button>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <div v-if="result" class="success-card">
          <div class="success-title">✓ Campaign "{{ result.campaign }}" dihapus.</div>
          <div class="badge-list">
            <span class="badge badge-red">arsip MinIO dihapus: {{ result.archive_objects_removed }} objek</span>
          </div>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const campaigns = ref([])
const selected = ref('')
const loadingList = ref(true)
const deleting = ref(false)
const errorMsg = ref('')
const result = ref(null)

function resetMsgs() {
  errorMsg.value = ''
  result.value = null
}

async function fetchCampaigns() {
  loadingList.value = true
  try {
    const res = await apiClient.get('/list_campaigns')
    campaigns.value = res.data.campaigns
  } catch {
    errorMsg.value = 'Gagal memuat daftar campaign.'
  } finally {
    loadingList.value = false
  }
}

async function confirmDelete() {
  if (!selected.value) return
  if (!window.confirm(`Hapus campaign "${selected.value}"? Tindakan ini permanen.`)) return
  resetMsgs()
  deleting.value = true
  const name = selected.value
  try {
    const res = await apiClient.delete('/delete_campaign', { params: { campaign: name } })
    result.value = res.data
    selected.value = ''
    await fetchCampaigns()
  } catch (e) {
    if (e.response?.status === 404) {
      errorMsg.value = `Campaign "${name}" tidak ditemukan.`
    } else if (e.response?.status === 403) {
      errorMsg.value = 'Hanya SPQ Head yang dapat menghapus campaign.'
    } else {
      errorMsg.value = 'Gagal menghapus campaign. Coba lagi.'
    }
  } finally {
    deleting.value = false
  }
}

onMounted(fetchCampaigns)
</script>

<style scoped>
.delete-page { display: flex; justify-content: center; }

.delete-card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 32px 36px; width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 16px;
}

.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -8px; }

.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 13px; font-weight: 600; }
.required { color: var(--red); }
.hint { font-size: 12px; color: var(--text-muted); }

.text-input {
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; background: #fff; transition: border-color 0.2s;
}
.text-input:focus { border-color: var(--red); }

.btn-delete {
  padding: 12px; background: var(--red); color: #fff; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 700; margin-top: 4px;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;
}
.btn-delete:hover:not(:disabled) { background: #dc2626; }
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

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
.badge-red { background: #fee2e2; color: var(--red); }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
