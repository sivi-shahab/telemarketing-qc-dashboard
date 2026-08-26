<template>
  <SidebarLayout title="Manage User">
    <div class="manage-page">
      <!-- Create user -->
      <div class="card">
        <h2 class="card-title">Buat User Baru</h2>
        <p class="card-subtitle">Tambahkan akun baru beserta role-nya.</p>

        <form class="create-form" @submit.prevent="createUser">
          <div class="field">
            <label>Username (NIP) <span class="required">*</span></label>
            <input v-model.trim="form.username" class="text-input" type="text" autocomplete="off" required />
            <span class="field-hint">Isi dengan nomor <strong>NIP</strong>: NIP BARU untuk role Sales Agent, NIP TL untuk role Team Leader Sales, NIP TLM untuk role Area Manager.</span>
          </div>
          <div class="field">
            <label>Nama <span class="required">*</span></label>
            <input v-model.trim="form.name" class="text-input" type="text" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Email <span class="required">*</span></label>
            <input v-model.trim="form.email" class="text-input" type="email" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Password <span class="required">*</span></label>
            <input v-model="form.password" class="text-input" type="password" autocomplete="new-password" required />
          </div>
          <div class="field">
            <label>Konfirmasi Password <span class="required">*</span></label>
            <input v-model="form.confirmPassword" class="text-input" type="password" autocomplete="new-password" required />
          </div>
          <div class="field">
            <label>Role <span class="required">*</span></label>
            <select v-model="form.role" class="text-input">
              <option v-for="r in roleOptions" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
          </div>

          <button class="btn-create" type="submit" :disabled="creating">
            <span v-if="creating" class="spinner"></span>
            {{ creating ? 'Membuat...' : 'Buat User' }}
          </button>
        </form>

        <div v-if="createError" class="error-msg">{{ createError }}</div>
        <div v-if="createOk" class="success-msg">✓ User "{{ createOk }}" berhasil dibuat.</div>
      </div>

      <!-- User table -->
      <div class="card">
        <h2 class="card-title">Daftar User</h2>

        <!-- Toolbar: search + filter role/status -->
        <div class="table-toolbar">
          <input
            v-model.trim="search"
            class="text-input search-input"
            type="search"
            placeholder="Cari nama, username (NIP), atau email…"
          />
          <select v-model="roleFilter" class="text-input filter-select">
            <option value="">Semua Role</option>
            <option v-for="r in roleOptions" :key="r.key" :value="r.key">{{ r.label }}</option>
          </select>
          <select v-model="campaignFilter" class="text-input filter-select">
            <option value="">Semua Campaign</option>
            <option v-for="c in campaignOptions" :key="c" :value="c">{{ c }}</option>
            <option value="__none__">⚠ Tanpa tag campaign</option>
          </select>
          <select v-model="statusFilter" class="text-input filter-select">
            <option value="">Semua Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span class="result-count">{{ displayUsers.length }} / {{ users.length }} user</span>
        </div>

        <div v-if="listError" class="error-msg">{{ listError }}</div>
        <div class="table-wrap">
          <table class="user-table">
            <thead>
              <tr>
                <th class="sortable" @click="sortBy('name')">User <span class="sort-ind">{{ sortIndicator('name') }}</span></th>
                <th class="sortable" @click="sortBy('role')">Role <span class="sort-ind">{{ sortIndicator('role') }}</span></th>
                <th>Campaign</th>
                <th class="sortable" @click="sortBy('status')">Status <span class="sort-ind">{{ sortIndicator('status') }}</span></th>
                <th class="sortable" @click="sortBy('created')">Created <span class="sort-ind">{{ sortIndicator('created') }}</span></th>
                <th class="col-action">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="empty">Memuat...</td>
              </tr>
              <tr v-else-if="users.length === 0">
                <td colspan="6" class="empty">Tidak ada user.</td>
              </tr>
              <tr v-else-if="displayUsers.length === 0">
                <td colspan="6" class="empty">Tidak ada user yang cocok dengan pencarian/filter.</td>
              </tr>
              <tr v-for="u in displayUsers" :key="u.id">
                <td>
                  <span class="u-name">{{ u.name || u.username }}</span>
                  <span class="u-email">{{ u.name ? u.username + ' · ' : '' }}{{ u.email }}</span>
                </td>
                <td>
                  <span class="badge" :class="roleBadgeClass(u.role)">{{ roleLabel(u.role) }}</span>
                </td>
                <td class="camp-cell">
                  <template v-if="u.campaigns && u.campaigns.length">
                    <span v-for="c in u.campaigns" :key="c" class="camp-pill">{{ c }}</span>
                  </template>
                  <!-- Sisi sales TANPA tag = tidak ditemukan di roster, jadi dia tidak
                       akan melihat tiket apa pun. Ini yang perlu ketahuan. -->
                  <span v-else-if="u.campaign_from_roster" class="camp-missing" title="NIP ini tidak ditemukan di Sales Database — user tidak akan melihat tiket apa pun">
                    ⚠ tidak ada di roster
                  </span>
                  <span v-else class="camp-all">semua campaign</span>
                </td>
                <td>
                  <span class="badge" :class="u.is_active ? 'badge-green' : 'badge-gray'">
                    {{ u.is_active ? 'active' : 'inactive' }}
                  </span>
                </td>
                <td class="u-created">{{ formatDate(u.created_at) }}</td>
                <td class="col-action">
                  <button
                    class="btn-del"
                    :disabled="u.id === currentUserId || deletingId === u.id"
                    :title="u.id === currentUserId ? 'Tidak dapat menghapus akun sendiri' : 'Hapus user'"
                    @click="deleteUser(u)"
                  >
                    {{ deletingId === u.id ? '…' : 'Hapus' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import { roleBadgeClass, roleLabel as sharedRoleLabel } from '../../utils/roleBadge.js'
import { useAuthStore } from '../../stores/auth.js'

const auth = useAuthStore()
const currentUserId = computed(() => auth.user?.id)

const users = ref([])
const loading = ref(true)
const listError = ref('')

// ---- Daftar User: search / filter / sort ----
const search = ref('')
const roleFilter = ref('')       // '' = semua role
// Daftar role dinamis dari /roles — inilah yang membuat role buatan operator bisa
// langsung dipilih saat membuat user.
const roleOptions = ref([])
async function loadRoles() {
  try {
    const res = await apiClient.get('/roles')
    roleOptions.value = (res.data.roles || []).map(r => ({ key: r.key, label: r.label }))
  } catch {
    roleOptions.value = []
  }
}
const statusFilter = ref('')     // '' | 'active' | 'inactive'
// '' = semua; '__none__' = khusus menyaring user sisi sales yang tidak punya tag
// campaign (NIP-nya tidak ada di roster) — audit yang paling sering dibutuhkan.
const campaignFilter = ref('')
// Daftar campaign yang benar-benar muncul pada user, bukan daftar campaign aktif —
// supaya filternya tidak menawarkan pilihan yang pasti kosong.
const campaignOptions = computed(() => {
  const set = new Set()
  users.value.forEach((u) => (u.campaigns || []).forEach((c) => set.add(c)))
  return [...set].sort()
})
const sortKey = ref('created')   // 'name' | 'role' | 'status' | 'created'
const sortDir = ref('desc')      // 'asc' | 'desc'

function sortBy(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'created' ? 'desc' : 'asc'
  }
}
function sortIndicator(key) {
  if (sortKey.value !== key) return '⇅'
  return sortDir.value === 'asc' ? '▲' : '▼'
}

const displayUsers = computed(() => {
  const q = search.value.toLowerCase()
  let list = users.value.filter((u) => {
    if (roleFilter.value && (u.role || '').toLowerCase() !== roleFilter.value) return false
    if (statusFilter.value === 'active' && !u.is_active) return false
    if (statusFilter.value === 'inactive' && u.is_active) return false
    if (campaignFilter.value === '__none__') {
      // Hanya sisi sales yang bermasalah kalau tag-nya kosong; role lain memang
      // tidak dibatasi campaign.
      if (!u.campaign_from_roster || (u.campaigns || []).length) return false
    } else if (campaignFilter.value) {
      const want = campaignFilter.value.toLowerCase()
      if (!(u.campaigns || []).some((c) => (c || '').toLowerCase() === want)) return false
    }
    if (!q) return true
    return [u.name, u.username, u.email]
      .some((v) => (v || '').toLowerCase().includes(q))
  })
  const dir = sortDir.value === 'asc' ? 1 : -1
  const val = (u) => {
    if (sortKey.value === 'name') return (u.name || u.username || '').toLowerCase()
    if (sortKey.value === 'role') return roleLabel(u.role).toLowerCase()
    if (sortKey.value === 'status') return u.is_active ? 1 : 0
    return u.created_at || '' // 'created'
  }
  return [...list].sort((a, b) => {
    const av = val(a), bv = val(b)
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
})

const form = reactive({ username: '', name: '', email: '', password: '', confirmPassword: '', role: 'sales_agent' })
const creating = ref(false)
const createError = ref('')
const createOk = ref('')

const deletingId = ref(null)



function roleLabel(role) {
  const r = (role || 'sales_agent').toLowerCase()
  // Nama tampilan diambil dari tabel roles supaya role buatan operator ikut terbaca;
  // util bersama hanya dipakai sebelum daftar itu selesai dimuat.
  const known = roleOptions.value.find(o => o.key === r)
  return known ? known.label : sharedRoleLabel(r)
}

function formatDate(iso) {
  if (!iso) return '—'
  // Backend stores naive UTC; parse as UTC then render in WIB (Asia/Jakarta).
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

async function fetchUsers() {
  loading.value = true
  listError.value = ''
  try {
    const res = await apiClient.get('/auth/users')
    users.value = res.data
  } catch (e) {
    listError.value = e.response?.status === 403
      ? 'Akses hanya untuk SPQ Head.'
      : 'Gagal memuat daftar user.'
  } finally {
    loading.value = false
  }
}

async function createUser() {
  createError.value = ''
  createOk.value = ''
  if (form.password !== form.confirmPassword) {
    createError.value = 'Konfirmasi password tidak cocok.'
    return
  }
  creating.value = true
  try {
    const res = await apiClient.post('/auth/create_user', {
      username: form.username,
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
    })
    createOk.value = res.data.username
    form.username = ''
    form.name = ''
    form.email = ''
    form.password = ''
    form.confirmPassword = ''
    form.role = 'sales_agent'
    await fetchUsers()
  } catch (e) {
    if (e.response?.status === 409) {
      createError.value = 'Username atau email sudah digunakan.'
    } else if (e.response?.status === 403) {
      createError.value = 'Hanya SPQ Head yang dapat membuat user.'
    } else if (e.response?.status === 422) {
      createError.value = 'Data tidak valid. Periksa kembali isian.'
    } else {
      createError.value = 'Gagal membuat user. Coba lagi.'
    }
  } finally {
    creating.value = false
  }
}

async function deleteUser(u) {
  if (u.id === currentUserId.value) return
  if (!window.confirm(`Hapus user "${u.username}"? Tindakan ini permanen.`)) return
  deletingId.value = u.id
  listError.value = ''
  try {
    await apiClient.delete(`/auth/users/${u.id}`)
    await fetchUsers()
  } catch (e) {
    listError.value = e.response?.status === 400
      ? 'Tidak dapat menghapus akun sendiri.'
      : e.response?.status === 404
        ? 'User tidak ditemukan.'
        : 'Gagal menghapus user.'
  } finally {
    deletingId.value = null
  }
}

onMounted(() => { fetchUsers(); loadRoles() })
</script>

<style scoped>
.manage-page { display: flex; flex-direction: column; gap: 20px; max-width: 900px; }

.card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 28px 32px; display: flex; flex-direction: column; gap: 14px;
}

.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -10px; }

.create-form {
  display: flex; flex-direction: column; gap: 14px; max-width: 420px;
}
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 13px; font-weight: 600; }
.required { color: var(--red); }
.field-hint { font-size: 12px; color: var(--text-muted); }

.text-input {
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; background: #fff; transition: border-color 0.2s;
}
.text-input:focus { border-color: var(--blue); }

.btn-create {
  padding: 10px 16px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 14px; font-weight: 700; height: 41px; align-self: flex-start;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; margin-top: 4px;
}
.btn-create:hover:not(:disabled) { filter: brightness(0.95); }
.btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px; font-size: 13px;
}
.success-msg {
  background: var(--green-bg); color: #16a34a; border: 1px solid #bbf7d0;
  border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600;
}

.table-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 4px;
}
.search-input { flex: 1 1 240px; min-width: 200px; }
.filter-select { flex: 0 0 auto; min-width: 140px; cursor: pointer; }
.result-count { margin-left: auto; font-size: 12px; color: var(--text-muted); white-space: nowrap; }

.table-wrap { overflow-x: auto; }
.user-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.user-table th.sortable { cursor: pointer; user-select: none; }
.user-table th.sortable:hover { color: var(--text); }
.sort-ind { font-size: 10px; opacity: 0.7; margin-left: 2px; }
.user-table th {
  text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted);
  border-bottom: 2px solid var(--border); white-space: nowrap;
}
.user-table td { padding: 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.user-table tr:last-child td { border-bottom: none; }

.u-name { display: block; font-weight: 600; color: var(--text); }
.u-email { display: block; font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.u-created { white-space: nowrap; color: var(--text-muted); font-size: 13px; }

.badge {
  display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px;
  border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;
}
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.col-action { text-align: right; white-space: nowrap; }
.btn-del {
  padding: 6px 14px; background: #fff; color: var(--red); border: 1.5px solid #fecaca;
  border-radius: 7px; font-size: 13px; font-weight: 600; transition: background 0.15s, color 0.15s;
}
.btn-del:hover:not(:disabled) { background: var(--red); color: #fff; }
.btn-del:disabled { opacity: 0.4; cursor: not-allowed; }

.empty { text-align: center; color: var(--text-muted); padding: 24px; }

.spinner {
  width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }


.camp-cell { white-space: normal; }
.camp-pill {
  display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.03em; padding: 2px 7px; border-radius: 999px;
  background: #f1f5f9; color: var(--text-muted); margin: 1px 3px 1px 0;
}
.camp-all { font-size: 11.5px; color: var(--text-muted); font-style: italic; }
.camp-missing { font-size: 11.5px; font-weight: 700; color: var(--red); }
</style>
