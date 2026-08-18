<template>
  <div class="account-panel" @click.stop>
    <button class="account-btn" @click="open = !open">
      <span class="account-info">
        <span class="username">{{ user?.username || 'User' }}</span>
        <span class="fullname">{{ user?.name || '—' }}</span>
        <span class="badge" :class="roleBadgeClass">{{ roleLabel }}</span>
        <!-- Tag campaign milik user. Untuk sisi sales nilainya datang dari kolom
             Dedicated di Sales Database — kolom itu menentukan tiket siapa yang
             terlihat, jadi harus bisa diperiksa tanpa membuka berkas roster. -->
        <span v-if="campaigns.length" class="campaign-tags">
          <span v-for="c in campaigns" :key="c" class="campaign-pill">{{ c }}</span>
        </span>
      </span>
      <span class="chevron" :class="{ rotated: open }">▾</span>
    </button>

    <div v-if="open" class="dropdown">
      <div class="dropdown-item" @click="handleLogout">
        Logout
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { storeToRefs } from 'pinia'
import { roleBadgeClass as sharedBadgeClass, roleLabel as sharedRoleLabel } from '../utils/roleBadge.js'

const router = useRouter()
const authStore = useAuthStore()
const { user } = storeToRefs(authStore)
const open = ref(false)

const roleBadgeClass = computed(() => sharedBadgeClass(user.value?.role))

// Daftar kosong = tidak dibatasi campaign (sisi QC & role bercakupan penuh), jadi
// tidak perlu ditampilkan apa pun.
const campaigns = computed(() => user.value?.campaigns || [])

// Role buatan operator memakai label dari /auth/me; util bersama menangani role bawaan.
const roleLabel = computed(
  () => user.value?.role_label || sharedRoleLabel(user.value?.role || 'sales_agent'))

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

// Close dropdown on outside click
window.addEventListener('click', () => { open.value = false })
</script>

<style scoped>
.account-panel { position: relative; }

.account-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  transition: background 0.15s;
}

.account-btn:hover { background: #f8f9fa; }

.avatar { font-size: 15px; }

/* Stacked identity: Username (NIP) / Nama / Role — NIP di atas karena rata-rata angka. */
.account-info { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; line-height: 1.2; }
.username { font-weight: 700; }
.fullname { font-size: 12px; font-weight: 500; color: var(--text-muted); }

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  align-self: flex-start;
  margin-top: 1px;
}

.badge-red { background: var(--red-bg); color: var(--red); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.chevron { font-size: 12px; transition: transform 0.2s; }
.chevron.rotated { transform: rotate(180deg); }

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover { background: #f8f9fa; }

.campaign-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
.campaign-pill {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
  background: #f1f5f9;
  color: var(--text-muted);
  border: 1px solid var(--border);
}
</style>