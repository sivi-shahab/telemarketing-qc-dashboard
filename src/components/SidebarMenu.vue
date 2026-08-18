<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="logo">
      <div class="logo-top">
        <img v-if="!collapsed" :src="logoFull" class="logo-img" alt="Bank Mega" />
        <img v-else :src="logoMark" class="logo-mark" alt="Bank Mega" />
        <button
          class="collapse-btn"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggle"
        >
          <svg
            class="panel-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2.5" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>
      <span v-if="!collapsed" class="logo-text">Telemarketing QC System</span>
    </div>

    <nav>
      <div class="menu-group">
        <div class="group-label">Dashboard</div>
        <RouterLink v-if="can(P.MENU_STATS)" to="/dashboard/stats" class="menu-item" active-class="active" :title="collapsed ? 'Stats' : ''">
          <span class="icon">ST</span> <span class="label">Stats</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_RESULTS)" to="/dashboard/results" class="menu-item" active-class="active" :title="collapsed ? 'Results' : ''">
          <span class="icon">RS</span> <span class="label">Results</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_TRANSCRIPTS)" to="/dashboard/transcripts" class="menu-item" active-class="active" :title="collapsed ? 'Transkrip' : ''">
          <span class="icon">TR</span> <span class="label">Transkrip</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_ASSIGN_TICKET)" to="/qc/assign" class="menu-item" active-class="active" :title="collapsed ? 'Assign Ticket' : ''">
          <span class="icon">AT</span> <span class="label">Assign Ticket</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_MANUAL_CHECK)" to="/dashboard/banding-review" class="menu-item" active-class="active" :title="collapsed ? 'Manual Check' : ''">
          <span class="icon">MC</span> <span class="label">Manual Check</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_PENDING_CHECK)" to="/dashboard/pending-check" class="menu-item" active-class="active" :title="collapsed ? 'Pending Check' : ''">
          <span class="icon">PC</span> <span class="label">Pending Check</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_CAMPAIGNS)" to="/dashboard/campaigns" class="menu-item" active-class="active" :title="collapsed ? 'Campaigns' : ''">
          <span class="icon">CP</span> <span class="label">Campaigns</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_SALES_DATABASE)" to="/dashboard/sales-database" class="menu-item" active-class="active" :title="collapsed ? 'Database Sales' : ''">
          <span class="icon">DS</span> <span class="label">Database Sales</span>
        </RouterLink>
        <!-- qc-database dinonaktifkan (route + endpoint API sudah dimatikan)
        <RouterLink v-if="can(P.MENU_QC_DATABASE)" to="/dashboard/qc-database" class="menu-item" active-class="active" :title="collapsed ? 'Database QC' : ''">
          <span class="icon">DQ</span> <span class="label">Database QC</span>
        </RouterLink>
        -->
      </div>

      <div v-if="showUploadGroup" class="menu-group">
        <div class="group-label">Upload Data</div>
        <RouterLink v-if="can(P.MENU_UPLOAD_CAMPAIGN)" to="/upload/campaign" class="menu-item" active-class="active" :title="collapsed ? 'Upload Campaign' : ''">
          <span class="icon">UC</span> <span class="label">Upload Campaign</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_UPLOAD_AUDIO)" to="/upload/audio" class="menu-item" active-class="active" :title="collapsed ? 'Upload Audio' : ''">
          <span class="icon">UA</span> <span class="label">Upload Audio</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_UPLOAD_TRANSCRIPT)" to="/upload/transcript" class="menu-item" active-class="active" :title="collapsed ? 'Upload Transcript' : ''">
          <span class="icon">UT</span> <span class="label">Upload Transcript</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_GET_RESULT)" to="/upload/result" class="menu-item" active-class="active" :title="collapsed ? 'Get Result' : ''">
          <span class="icon">GR</span> <span class="label">Get Result</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_UPLOAD_SALES_DATABASE)" to="/upload/sales-database" class="menu-item" active-class="active" :title="collapsed ? 'Upload Database Sales' : ''">
          <span class="icon">US</span> <span class="label">Upload Database Sales</span>
        </RouterLink>
        <!-- qc-database dinonaktifkan (route + endpoint API sudah dimatikan)
        <RouterLink v-if="can(P.MENU_UPLOAD_QC_DATABASE)" to="/upload/qc-database" class="menu-item" active-class="active" :title="collapsed ? 'Upload Database QC' : ''">
          <span class="icon">UQ</span> <span class="label">Upload Database QC</span>
        </RouterLink>
        -->
      </div>

      <div v-if="can(P.MENU_DELETE_CAMPAIGN)" class="menu-group">
        <div class="group-label">Delete Data</div>
        <RouterLink to="/delete/campaign" class="menu-item" active-class="active" :title="collapsed ? 'Delete Campaign' : ''">
          <span class="icon">DC</span> <span class="label">Campaign</span>
        </RouterLink>
      </div>

      <div v-if="showAdminGroup" class="menu-group">
        <div class="group-label">Administration</div>
        <RouterLink v-if="can(P.MENU_MANAGE_USER)" to="/spq-head/users" class="menu-item" active-class="active" :title="collapsed ? 'Manage User' : ''">
          <span class="icon">MU</span> <span class="label">Manage User</span>
        </RouterLink>
        <RouterLink v-if="can(P.MENU_MANAGE_ROLE)" to="/spq-head/manage-roles" class="menu-item" active-class="active" :title="collapsed ? 'Manage Role' : ''">
          <span class="icon">MR</span> <span class="label">Manage Role</span>
        </RouterLink>
        <!-- "Hierarki Role & Menu" disembunyikan dari sidebar (permintaan 10 Agustus
             2026). Halamannya sendiri masih ada dan tetap dijaga MENU_ROLE_HIERARCHY,
             jadi cukup hapus komentar ini untuk memunculkannya kembali.
        <RouterLink v-if="can(P.MENU_ROLE_HIERARCHY)" to="/spq-head/roles" class="menu-item" active-class="active" :title="collapsed ? 'Hierarki Role & Menu' : ''">
          <span class="icon">HR</span> <span class="label">Hierarki Role &amp; Menu</span>
        </RouterLink>
        -->
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useSidebar } from '../composables/useSidebar.js'
import { useAuthStore } from '../stores/auth.js'
import { P } from '../permissions.js'
import logoFull from '../assets/brand/bank-mega-logo.png'
import logoMark from '../assets/brand/bank-mega-mark.png'

const { collapsed, toggle } = useSidebar()
const auth = useAuthStore()
const can = auth.can

// Grup hanya dirender kalau ada isinya, supaya role yang cuma punya sebagian menu
// tidak menampilkan judul grup kosong.
const showUploadGroup = computed(() => auth.canAny(
  P.MENU_UPLOAD_CAMPAIGN, P.MENU_UPLOAD_AUDIO, P.MENU_UPLOAD_TRANSCRIPT,
  P.MENU_GET_RESULT, P.MENU_UPLOAD_SALES_DATABASE, P.MENU_UPLOAD_QC_DATABASE,
))
// MENU_ROLE_HIERARCHY sengaja tidak ikut di sini: link-nya disembunyikan (lihat
// template), jadi kalau ia satu-satunya izin yang dimiliki, judul grup
// "Administration" tidak boleh muncul kosong.
const showAdminGroup = computed(() => auth.canAny(
  P.MENU_MANAGE_USER, P.MENU_MANAGE_ROLE,
))
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background: #fff;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.18s ease;
  position: sticky;
  top: 0;
  align-self: flex-start;
  overflow-y: auto;
}

.sidebar.collapsed {
  width: var(--sidebar-width-collapsed);
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 18px 18px 16px;
  border-bottom: 1px solid var(--border);
}

.logo-top {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 10px;
}

.logo-img { height: 34px; width: auto; flex-shrink: 0; }
.logo-mark { height: 26px; width: auto; flex-shrink: 0; }
.logo-text {
  min-width: 0;
  line-height: 1.25;
  word-break: break-word;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.collapse-btn {
  margin-left: auto;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}
.collapse-btn:hover { background: var(--blue-bg); color: var(--blue); }
.panel-icon { width: 16px; height: 16px; display: block; }

/* When collapsed, stack mark + toggle button centered to save space. */
.sidebar.collapsed .logo {
  padding: 18px 8px 16px;
  align-items: center;
}
.sidebar.collapsed .logo-top {
  flex-direction: column;
  gap: 10px;
}
.sidebar.collapsed .collapse-btn { margin-left: 0; }

nav { padding: 12px 0; flex: 1; }

.menu-group { margin-bottom: 8px; }

.group-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: 8px 18px 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border-radius: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.menu-item:hover { background: #f1f5f9; }

.menu-item.active {
  background: var(--blue-bg);
  color: var(--blue);
  border-left-color: var(--blue);
  font-weight: 600;
}

/* Inisial teks, bukan emoji — inilah satu-satunya isi menu saat sidebar
   di-collapse (.sidebar.collapsed .label { display: none }). */
.icon { font-size: 10px; font-weight: 800; letter-spacing: 0.02em; width: 20px;
        text-align: center; flex-shrink: 0; color: inherit; opacity: 0.85; }

.label { white-space: nowrap; overflow: hidden; }

/* Collapsed: icon-only menu, hide labels and group headers. */
.sidebar.collapsed .label { display: none; }
.sidebar.collapsed .group-label {
  height: 1px;
  padding: 0;
  margin: 8px 14px;
  overflow: hidden;
  color: transparent;
  background: var(--border);
}
.sidebar.collapsed .menu-item {
  justify-content: center;
  gap: 0;
  padding: 10px 0;
}
</style>
