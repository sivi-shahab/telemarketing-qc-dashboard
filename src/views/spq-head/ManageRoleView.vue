<template>
  <SidebarLayout title="Manage Role">
    <div class="manage-page">
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'list' }" @click="tab = 'list'">
          Daftar Role <span class="tab-count">{{ roles.length }}</span>
        </button>
        <!-- Tab "Buat Role" disembunyikan (permintaan 10 Agustus 2026). Panel-nya
             masih dipakai untuk MENGUBAH role lewat tombol "Ubah" di daftar; cukup
             kembalikan tombol ini untuk memunculkan pembuatan role baru lagi.
        <button class="tab" :class="{ active: tab === 'create' }" @click="startCreate">
          Buat Role
        </button>
        -->
        <button class="tab" :class="{ active: tab === 'assign' }" @click="openAssign">
          Assign Role
        </button>
      </div>

      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="notice" class="alert ok">{{ notice }}</p>

      <!-- ---------- Tab: Daftar Role ---------- -->
      <div v-show="tab === 'list'" class="card">
        <h2 class="card-title">Daftar Role</h2>
        <p class="card-subtitle">
          Role <strong>bawaan sistem</strong> tidak bisa dihapus, tetapi izin &amp;
          campaign-nya boleh disesuaikan. Kolom <strong>Campaign</strong> kosong berarti
          <strong>semua campaign</strong> — kecuali untuk cakupan sales, yang mengikuti
          tag <em>Dedicated</em> tiap orang di Sales Database. Untuk role sales,
          <b>tag user</b> merangkum campaign yang benar-benar dipegang user role
          tersebut beserta jumlahnya — satu role <em>Sales Agent</em> memang melayani
          banyak campaign sekaligus.
        </p>

        <div v-if="loading" class="muted">Memuat…</div>
        <div v-else class="table-wrap">
          <table class="roles-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Cakupan Data</th>
                <th>Campaign</th>
                <th class="num">Izin</th>
                <th class="num">User</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in roles" :key="r.id">
                <td>
                  <span class="badge role" :class="badgeClass(r)">{{ r.label }}</span>
                  <div class="role-key">{{ r.key }}</div>
                  <span v-if="r.is_system" class="badge sys">bawaan</span>
                  <span v-else-if="r.base_role" class="badge tpl">dari {{ r.base_role }}</span>
                </td>
                <td>{{ scopeLabel(r.data_scope) }}</td>
                <td class="camp-cell">
                  <!-- Batas atas yang diset pada role (kalau ada). -->
                  <template v-if="r.campaigns.length">
                    <div class="camp-line">
                      <span class="camp-label">dibatasi ke</span>
                      <span v-for="c in r.campaigns" :key="c" class="pill">{{ c }}</span>
                    </div>
                  </template>

                  <!-- Role dengan sedikit user (mis. Area Manager, 5 orang): sebut
                       orangnya langsung — lebih berguna daripada tally, apalagi karena
                       satu AM memegang beberapa campaign sehingga tally berjumlah
                       lebih besar dari jumlah orangnya. -->
                  <template v-if="r.roster_people.length">
                    <div class="camp-label">tag per orang</div>
                    <ul class="camp-list">
                      <li v-for="p in r.roster_people" :key="p.username">
                        <span class="person">{{ p.name }}</span>
                        <template v-if="p.campaigns.length">
                          <span v-for="c in p.campaigns" :key="c" class="pill tag">{{ c }}</span>
                        </template>
                        <span v-else class="camp-warn-inline">tanpa tag</span>
                      </li>
                    </ul>
                  </template>

                  <!-- User banyak: rangkum per campaign. -->
                  <template v-else-if="r.roster_tags.length">
                    <div class="camp-label">tag user</div>
                    <ul class="camp-list">
                      <li v-for="t in r.roster_tags" :key="t.campaign">
                        <span class="pill tag">{{ t.campaign }}</span>
                        <span class="person-camp">{{ t.users }} user</span>
                      </li>
                    </ul>
                  </template>

                  <span v-else-if="!r.campaigns.length" class="muted">
                    {{ r.data_scope.startsWith('sales_') ? 'ikut tag roster' : 'semua campaign' }}
                  </span>

                  <div v-if="r.users_without_tag" class="camp-warn"
                       title="NIP user ini tidak ada di Sales Database — mereka tidak melihat tiket apa pun">
                    ⚠ {{ r.users_without_tag }} user tanpa tag
                  </div>
                </td>
                <td class="num">{{ r.permissions.length }}</td>
                <td class="num">{{ r.user_count }}</td>
                <td class="actions">
                  <button class="btn" @click="startEdit(r)">Ubah</button>
                  <button
                    class="btn danger"
                    :disabled="r.is_system || r.user_count > 0"
                    :title="deleteHint(r)"
                    @click="removeRole(r)"
                  >Hapus</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ---------- Tab: Buat / Ubah ---------- -->
      <div v-show="tab === 'create'" class="card">
        <h2 class="card-title">{{ editing ? `Ubah Role — ${editing.label}` : 'Buat Role Baru' }}</h2>
        <p class="card-subtitle">
          Pilih <strong>template</strong> dari role yang sudah ada untuk menyalin izinnya,
          lalu sesuaikan centangnya dan tentukan campaign yang boleh dilihat.
        </p>

        <form class="create-form" @submit.prevent="submit">
          <div class="row">
            <div class="field">
              <label>Key role <span class="required">*</span></label>
              <input
                v-model.trim="form.key"
                class="text-input"
                :disabled="!!editing"
                placeholder="mis. tl_ntb"
                required
              />
              <span class="field-hint">
                Huruf kecil, angka, dan underscore. Tidak bisa diubah setelah dibuat —
                nilainya ikut tersimpan di riwayat tiket.
              </span>
            </div>
            <div class="field">
              <label>Nama tampilan <span class="required">*</span></label>
              <input v-model.trim="form.label" class="text-input" placeholder="mis. Team Leader NTB" required />
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>Template izin</label>
              <select v-model="form.base_role" class="text-input" :disabled="!!editing" @change="applyTemplate">
                <option value="">— tanpa template (mulai kosong) —</option>
                <option v-for="r in roles" :key="r.key" :value="r.key">{{ r.label }}</option>
              </select>
              <span class="field-hint">Menyalin centang izin &amp; cakupan data dari role tersebut.</span>
            </div>
            <div class="field">
              <label>Cakupan data <span class="required">*</span></label>
              <select v-model="form.data_scope" class="text-input">
                <option v-for="sc in catalog.data_scopes" :key="sc.key" :value="sc.key">{{ sc.label }}</option>
              </select>
              <span class="field-hint">Menentukan tiket <em>siapa</em> yang terlihat, terpisah dari daftar izin.</span>
            </div>
          </div>

          <div class="field">
            <label>Campaign</label>
            <div class="checks campaigns">
              <label v-for="c in catalog.campaigns" :key="c" class="check">
                <input type="checkbox" :value="c" v-model="form.campaigns" />
                <span>{{ c }}</span>
              </label>
            </div>
            <!-- Membatasi role sisi sales ke campaign yang belum ada di roster =
                 user-nya tidak melihat tiket apa pun. Diperingatkan di sini karena
                 gejalanya (layar kosong) tidak menunjukkan sebabnya sama sekali. -->
            <p v-if="campaignsWithoutRoster.length" class="camp-warning">
              ⚠ <b>{{ campaignsWithoutRoster.join(', ') }}</b>
              belum ada di kolom <em>Dedicated</em> Sales Database. Role bercakupan sales
              yang dibatasi ke campaign ini <b>tidak akan melihat tiket apa pun</b> sampai
              roster-nya di-upload. Role tetap bisa disimpan.
            </p>
            <span v-if="isSalesScope" class="field-hint">
              Tidak ada yang dicentang = <strong>ikuti tag <em>Dedicated</em> di Sales
              Database</strong> — tiap orang otomatis melihat campaign-nya sendiri, jadi
              tidak perlu role terpisah per campaign. Mencentang di sini hanya
              <strong>mempersempit</strong>: kalau tag orangnya di luar centangan ini, dia
              tidak melihat tiket apa pun.
            </span>
            <span v-else class="field-hint">
              Tidak ada yang dicentang = <strong>semua campaign</strong>. Ini bawaan untuk
              role sisi QC, yang cakupannya ditentukan assignment tiket, bukan campaign.
            </span>
          </div>

          <div v-for="g in catalog.groups" :key="g.title" class="field">
            <label>
              {{ g.title }}
              <button type="button" class="link" @click="toggleGroup(g)">
                {{ groupAllChecked(g) ? 'kosongkan' : 'pilih semua' }}
              </button>
            </label>
            <div class="checks">
              <label v-for="it in g.items" :key="it.key" class="check">
                <input type="checkbox" :value="it.key" v-model="form.permissions" />
                <span>{{ it.label }}</span>
              </label>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn primary" type="submit" :disabled="saving">
              {{ saving ? 'Menyimpan…' : (editing ? 'Simpan Perubahan' : 'Buat Role') }}
            </button>
            <button class="btn" type="button" @click="cancel">Batal</button>
          </div>
        </form>
      </div>

      <!-- ---------- Tab: Assign Role (campaign per username) ---------- -->
      <div v-show="tab === 'assign'" class="card">
        <h2 class="card-title">Assign Role — Campaign per User</h2>
        <p class="card-subtitle">
          Centang campaign yang boleh dilihat <strong>satu orang</strong>. Tanpa centang
          sama sekali, orang itu tidak dibatasi di tingkat user — yang berlaku hanya
          batas dari role-nya (dan, untuk sisi sales, tag <em>Dedicated</em> di Sales
          Database). Assign di sini hanya bisa <strong>mempersempit</strong>: campaign
          efektif adalah irisan ketiganya, jadi mencentang campaign yang tidak dipegang
          role-nya menghasilkan irisan <strong>kosong</strong> — user itu tidak melihat
          tiket apa pun. Kolom <strong>Campaign Efektif</strong> menunjukkan hasil
          akhirnya.
        </p>

        <div class="assign-toolbar">
          <input v-model="assignSearch" class="input" placeholder="Cari NIP, nama, atau role…" />
          <span class="muted">{{ assignFiltered.length }} dari {{ assignUsers.length }} user</span>
        </div>

        <div v-if="assignLoading" class="muted">Memuat…</div>
        <div v-else class="table-wrap">
          <table class="roles-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Campaign (centang untuk membatasi)</th>
                <th>Campaign Efektif</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!assignFiltered.length">
                <td colspan="5" class="muted">Tidak ada user yang cocok.</td>
              </tr>
              <tr v-for="u in assignPage" :key="u.username">
                <td>
                  <div class="person">{{ u.name || u.username }}</div>
                  <div class="role-key">{{ u.username }}</div>
                </td>
                <td>
                  <span class="badge role">{{ u.role_label || u.role }}</span>
                  <div v-if="u.campaign_from_roster" class="camp-label">ikut tag roster</div>
                </td>
                <td class="camp-cell">
                  <div class="checks assign-checks">
                    <label v-for="c in catalog.campaigns" :key="c" class="check">
                      <input type="checkbox" :value="c" v-model="assignDraft[u.username]" />
                      <span>{{ c }}</span>
                    </label>
                  </div>
                </td>
                <td class="camp-cell">
                  <span v-if="u.effective_all" class="muted">semua campaign</span>
                  <template v-else-if="u.effective_campaigns.length">
                    <span v-for="c in u.effective_campaigns" :key="c" class="pill">{{ c }}</span>
                  </template>
                  <span v-else class="camp-warn">⚠ tidak ada — user ini tidak melihat tiket apa pun</span>
                </td>
                <td class="actions">
                  <button
                    class="btn primary"
                    :disabled="assignSaving === u.username || !assignDirty(u)"
                    @click="saveAssign(u)"
                  >{{ assignSaving === u.username ? 'Menyimpan…' : 'Simpan' }}</button>
                  <button class="btn" :disabled="!assignDirty(u)" @click="resetAssign(u)">Batal</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="assignFiltered.length > ASSIGN_PAGE" class="assign-pager">
          <button class="btn" :disabled="assignPageNo === 1" @click="assignPageNo--">‹</button>
          <span class="muted">Hal {{ assignPageNo }} / {{ assignTotalPages }}</span>
          <button class="btn" :disabled="assignPageNo >= assignTotalPages" @click="assignPageNo++">›</button>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import { useAuthStore } from '../../stores/auth.js'
import { roleBadgeClass } from '../../utils/roleBadge.js'

const auth = useAuthStore()

const tab = ref('list')
const roles = ref([])
const catalog = reactive({ groups: [], data_scopes: [], campaigns: [], campaigns_with_roster: [] })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const editing = ref(null)

const form = reactive({
  key: '', label: '', base_role: '', data_scope: 'all',
  permissions: [], campaigns: [],
})

// Cakupan sales mengambil campaign dari tag Dedicated di roster, bukan dari role —
// keterangan di form harus ikut berubah supaya tidak menyesatkan.
const isSalesScope = computed(() => form.data_scope.startsWith('sales_'))

// Hanya relevan untuk cakupan sales: di cakupan lain campaign role berlaku langsung
// ke results.campaign, tanpa bergantung pada roster.
const campaignsWithoutRoster = computed(() => {
  if (!isSalesScope.value) return []
  const known = (catalog.campaigns_with_roster || []).map((c) => c.toLowerCase())
  return form.campaigns.filter((c) => !known.includes(String(c).toLowerCase()))
})

// Warna badge mengikuti palette yang sama dengan halaman Hierarki Role & Menu.
// Role buatan operator mewarisi warna template-nya, lalu warna cakupan datanya.
function badgeClass(r) {
  return roleBadgeClass(r.key, { baseRole: r.base_role, dataScope: r.data_scope })
}

function scopeLabel(key) {
  return catalog.data_scopes.find(s => s.key === key)?.label || key
}

function deleteHint(r) {
  if (r.is_system) return 'Role bawaan sistem tidak dapat dihapus'
  if (r.user_count > 0) return `Masih dipakai ${r.user_count} user — pindahkan dulu`
  return 'Hapus role ini'
}

function groupAllChecked(g) {
  return g.items.every(it => form.permissions.includes(it.key))
}

function toggleGroup(g) {
  const keys = g.items.map(it => it.key)
  if (groupAllChecked(g)) {
    form.permissions = form.permissions.filter(p => !keys.includes(p))
  } else {
    form.permissions = [...new Set([...form.permissions, ...keys])]
  }
}

function applyTemplate() {
  const src = roles.value.find(r => r.key === form.base_role)
  if (!src) return
  form.permissions = [...src.permissions]
  form.data_scope = src.data_scope
  form.campaigns = [...src.campaigns]
}

function resetForm() {
  form.key = ''
  form.label = ''
  form.base_role = ''
  form.data_scope = 'all'
  form.permissions = []
  form.campaigns = []
}

function startCreate() {
  editing.value = null
  resetForm()
  tab.value = 'create'
}

function startEdit(r) {
  editing.value = r
  form.key = r.key
  form.label = r.label
  form.base_role = r.base_role || ''
  form.data_scope = r.data_scope
  form.permissions = [...r.permissions]
  form.campaigns = [...r.campaigns]
  tab.value = 'create'
}

function cancel() {
  editing.value = null
  resetForm()
  tab.value = 'list'
}

// ---------- Tab Assign Role: campaign per username ----------
// Daftar user bisa ratusan, jadi dicari + dipaginasi di klien; datanya sendiri satu
// kali ambil karena tiap baris butuh campaign efektifnya (hasil irisan di server).
const ASSIGN_PAGE = 25
const assignUsers = ref([])
const assignDraft = reactive({})   // username -> [campaign] yang sedang diedit
const assignLoading = ref(false)
const assignSaving = ref('')
const assignSearch = ref('')
const assignPageNo = ref(1)

const assignFiltered = computed(() => {
  const q = assignSearch.value.trim().toLowerCase()
  if (!q) return assignUsers.value
  return assignUsers.value.filter((u) => (
    (u.username || '').toLowerCase().includes(q)
    || (u.name || '').toLowerCase().includes(q)
    || (u.role_label || u.role || '').toLowerCase().includes(q)
  ))
})
const assignTotalPages = computed(() => Math.max(1, Math.ceil(assignFiltered.value.length / ASSIGN_PAGE)))
const assignPage = computed(() => {
  const start = (assignPageNo.value - 1) * ASSIGN_PAGE
  return assignFiltered.value.slice(start, start + ASSIGN_PAGE)
})
watch(assignSearch, () => { assignPageNo.value = 1 })

// Dibandingkan sebagai himpunan: urutan centang tidak menandakan perubahan.
function assignDirty(u) {
  const draft = [...(assignDraft[u.username] || [])].sort()
  const saved = [...(u.campaigns || [])].sort()
  return draft.length !== saved.length || draft.some((c, i) => c !== saved[i])
}
function resetAssign(u) {
  assignDraft[u.username] = [...(u.campaigns || [])]
}

async function openAssign() {
  tab.value = 'assign'
  if (assignUsers.value.length || assignLoading.value) return
  assignLoading.value = true
  try {
    const res = await apiClient.get('/roles/user_campaigns')
    assignUsers.value = res.data?.users || []
    if (res.data?.campaigns?.length) catalog.campaigns = res.data.campaigns
    assignUsers.value.forEach((u) => { assignDraft[u.username] = [...(u.campaigns || [])] })
  } catch (e) {
    error.value = e.response?.data?.detail || 'Gagal memuat daftar user.'
  } finally {
    assignLoading.value = false
  }
}

async function saveAssign(u) {
  assignSaving.value = u.username
  error.value = ''
  try {
    const res = await apiClient.put(`/roles/user_campaigns/${encodeURIComponent(u.username)}`, {
      campaigns: assignDraft[u.username] || [],
    })
    // Ganti barisnya dengan balasan server: campaign efektif dihitung di sana
    // (irisan role ∩ roster ∩ assign), jadi tidak boleh ditebak di klien.
    const i = assignUsers.value.findIndex((x) => x.username === u.username)
    if (i >= 0) assignUsers.value[i] = res.data
    assignDraft[u.username] = [...(res.data.campaigns || [])]
    flash(`Campaign untuk ${u.name || u.username} disimpan.`)
  } catch (e) {
    error.value = e.response?.data?.detail || 'Gagal menyimpan campaign user.'
  } finally {
    assignSaving.value = ''
  }
}

function flash(msg) {
  notice.value = msg
  error.value = ''
  setTimeout(() => { notice.value = '' }, 4000)
}

async function load() {
  loading.value = true
  try {
    const [listRes, catRes] = await Promise.all([
      apiClient.get('/roles'),
      apiClient.get('/roles/catalog'),
    ])
    roles.value = listRes.data.roles || []
    catalog.groups = catRes.data.groups || []
    catalog.data_scopes = catRes.data.data_scopes || []
    catalog.campaigns = catRes.data.campaigns || []
    catalog.campaigns_with_roster = catRes.data.campaigns_with_roster || []
  } catch (e) {
    error.value = e.response?.data?.detail || 'Gagal memuat daftar role'
  } finally {
    loading.value = false
  }
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      label: form.label,
      data_scope: form.data_scope,
      permissions: form.permissions,
      campaigns: form.campaigns,
    }
    if (editing.value) {
      await apiClient.put(`/roles/${editing.value.id}`, payload)
      flash(`Role "${form.label}" diperbarui.`)
    } else {
      await apiClient.post('/roles', { ...payload, key: form.key, base_role: form.base_role || null })
      flash(`Role "${form.label}" dibuat.`)
    }
    await load()
    // Izin milik role SENDIRI bisa saja ikut berubah — segarkan supaya menu di
    // sidebar langsung mencerminkan keadaan terbaru tanpa login ulang.
    await auth.reloadMe().catch(() => {})
    cancel()
  } catch (e) {
    error.value = e.response?.data?.detail || 'Gagal menyimpan role'
  } finally {
    saving.value = false
  }
}

async function removeRole(r) {
  if (!confirm(`Hapus role "${r.label}" (${r.key})?`)) return
  try {
    await apiClient.delete(`/roles/${r.id}`)
    flash(`Role "${r.label}" dihapus.`)
    await load()
  } catch (e) {
    error.value = e.response?.data?.detail || 'Gagal menghapus role'
  }
}

onMounted(load)
</script>

<style scoped>
.manage-page { display: flex; flex-direction: column; gap: 20px; max-width: 1060px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px; }
.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.muted { color: var(--text-muted); font-size: 13px; }

.tabs { display: flex; gap: 8px; }
.tab { padding: 9px 18px; border-radius: 10px; border: 1px solid var(--border); background: #fff; font-size: 13.5px; font-weight: 600; color: var(--text-muted); }
.tab.active { background: var(--blue-bg); color: var(--blue); border-color: var(--blue); }
.tab-count { font-size: 11px; opacity: 0.75; margin-left: 4px; }

/* Tab Assign Role */
.assign-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.assign-toolbar .input {
  flex: 1; max-width: 340px; padding: 8px 12px; border: 1.5px solid var(--border);
  border-radius: 8px; font-size: 13px; outline: none;
}
.assign-toolbar .input:focus { border-color: var(--blue); }
/* Checklist campaign dibuat mengalir menyamping supaya satu baris user tetap pendek. */
.assign-checks { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.assign-pager { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 12px; }

.alert { font-size: 13px; padding: 10px 14px; border-radius: 10px; }
.alert.error { background: var(--red-bg); color: var(--red); }
.alert.ok { background: var(--green-bg); color: #16a34a; }

.table-wrap { overflow-x: auto; }
.roles-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.roles-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 2px solid var(--border); white-space: nowrap; }
.roles-table td { padding: 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.roles-table th.num, .roles-table td.num { text-align: right; }
.role-key { font-size: 11.5px; color: var(--text-muted); font-family: ui-monospace, monospace; margin-top: 4px; }
.badge { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; margin-top: 4px; }
.badge.sys { background: #f1f5f9; color: var(--text-muted); }
.badge.tpl { background: var(--blue-bg); color: var(--blue); }

/* Badge nama role — palette sama persis dengan halaman Hierarki Role & Menu. */
.badge.role { font-size: 11px; padding: 3px 9px; margin-top: 0; white-space: nowrap; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.pill { display: inline-block; background: #f1f5f9; border-radius: 6px; padding: 2px 8px; font-size: 12px; margin: 1px 4px 1px 0; }

.actions { display: flex; gap: 6px; }
.btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: #fff; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.btn:hover:not(:disabled) { background: #f1f5f9; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.primary { background: var(--blue); color: #fff; border-color: var(--blue); }
.btn.danger { color: var(--red); border-color: var(--red-bg); }
.link { background: none; border: none; color: var(--blue); font-size: 11.5px; font-weight: 600; margin-left: 8px; text-decoration: underline; }

.create-form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 16px; flex-wrap: wrap; }
.row .field { flex: 1 1 260px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12.5px; font-weight: 700; }
.required { color: var(--red); }
.field-hint { font-size: 11.5px; color: var(--text-muted); line-height: 1.45; }
.text-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: 9px; font-size: 13.5px; font-family: inherit; background: #fff; }
.text-input:disabled { background: #f8fafc; color: var(--text-muted); }

.checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 6px 14px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; }
.checks.campaigns { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; }
.form-actions { display: flex; gap: 10px; }

.camp-cell { min-width: 240px; }
.camp-line { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; margin-bottom: 4px; }
.camp-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted); margin-right: 2px;
}
.pill.tag { background: var(--blue-bg); color: var(--blue); }
.camp-warn { font-size: 11.5px; font-weight: 700; color: var(--red); margin-top: 2px; }

.camp-list { list-style: none; margin: 3px 0 0; padding: 0; }
.camp-list li {
  position: relative; padding-left: 12px; font-size: 12.5px; line-height: 1.5;
  display: flex; flex-wrap: wrap; align-items: center; gap: 3px 4px;
  margin-bottom: 3px;
}
.camp-list li::before {
  content: "•"; position: absolute; left: 0; top: 1px; color: var(--text-muted);
}
.camp-list .pill { margin: 0; }
.person { font-weight: 600; margin-right: 2px; }
.person-camp { color: var(--text-muted); }
.camp-warn-inline { color: var(--red); font-weight: 700; font-size: 11.5px; }
.camp-warning {
  font-size: 12px; line-height: 1.5; color: var(--red);
  background: var(--red-bg); border-radius: 8px; padding: 8px 11px; margin-top: 2px;
}
</style>
