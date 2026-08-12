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
        <RouterLink v-if="!isQcSupport" to="/dashboard/stats" class="menu-item" active-class="active" :title="collapsed ? 'Stats' : ''">
          <span class="icon">📊</span> <span class="label">Stats</span>
        </RouterLink>
        <RouterLink to="/dashboard/results" class="menu-item" active-class="active" :title="collapsed ? 'Results' : ''">
          <span class="icon">📄</span> <span class="label">Results</span>
        </RouterLink>
        <RouterLink v-if="isQcOrSpqHead" to="/dashboard/transcripts" class="menu-item" active-class="active" :title="collapsed ? 'Transkrip' : ''">
          <span class="icon">🎙</span> <span class="label">Transkrip</span>
        </RouterLink>
        <RouterLink v-if="canAssignTickets" to="/qc/assign" class="menu-item" active-class="active" :title="collapsed ? 'Assign Ticket' : ''">
          <span class="icon">🧑‍⚖️</span> <span class="label">Assign Ticket</span>
        </RouterLink>
        <RouterLink v-if="canReviewBanding" to="/dashboard/banding-review" class="menu-item" active-class="active" :title="collapsed ? 'Manual Check' : ''">
          <span class="icon">⚖️</span> <span class="label">Manual Check</span>
        </RouterLink>
        <RouterLink v-if="canPendingCheck" to="/dashboard/pending-check" class="menu-item" active-class="active" :title="collapsed ? 'Pending Check' : ''">
          <span class="icon">⏳</span> <span class="label">Pending Check</span>
        </RouterLink>
        <RouterLink v-if="(!isStatsResultsOnly && !isQcSupport) || isDemo" to="/dashboard/campaigns" class="menu-item" active-class="active" :title="collapsed ? 'Campaigns' : ''">
          <span class="icon">📋</span> <span class="label">Campaigns</span>
        </RouterLink>
        <RouterLink v-if="isSpqHead" to="/dashboard/sales-database" class="menu-item" active-class="active" :title="collapsed ? 'Database Sales' : ''">
          <span class="icon">🗃</span> <span class="label">Database Sales</span>
        </RouterLink>
        <!-- qc-database dinonaktifkan (route + endpoint API sudah dimatikan)
        <RouterLink v-if="isSpqHead" to="/dashboard/qc-database" class="menu-item" active-class="active" :title="collapsed ? 'Database QC' : ''">
          <span class="icon">🗂</span> <span class="label">Database QC</span>
        </RouterLink>
        -->
      </div>

      <div v-if="!isStatsResultsOnly || isQcSupport || isTlQc || isDemo" class="menu-group">
        <div class="group-label">Upload Data</div>
        <RouterLink v-if="!isQcSupport && !isTlQc && !isDemo" to="/upload/campaign" class="menu-item" active-class="active" :title="collapsed ? 'Upload Campaign' : ''">
          <span class="icon">📤</span> <span class="label">Upload Campaign</span>
        </RouterLink>
        <RouterLink v-if="isSpqHeadOrSalesAgent || isTlQc" to="/upload/audio" class="menu-item" active-class="active" :title="collapsed ? 'Upload Audio' : ''">
          <span class="icon">🎵</span> <span class="label">Upload Audio</span>
        </RouterLink>
        <RouterLink to="/upload/transcript" class="menu-item" active-class="active" :title="collapsed ? 'Upload Transcript' : ''">
          <span class="icon">⬆</span> <span class="label">Upload Transcript</span>
        </RouterLink>
        <RouterLink v-if="!isQcSupport && !isTlQc && !isDemo" to="/upload/result" class="menu-item" active-class="active" :title="collapsed ? 'Get Result' : ''">
          <span class="icon">🔍</span> <span class="label">Get Result</span>
        </RouterLink>
        <RouterLink v-if="isSpqHead" to="/upload/sales-database" class="menu-item" active-class="active" :title="collapsed ? 'Upload Database Sales' : ''">
          <span class="icon">📥</span> <span class="label">Upload Database Sales</span>
        </RouterLink>
        <!-- qc-database dinonaktifkan (route + endpoint API sudah dimatikan)
        <RouterLink v-if="isSpqHead" to="/upload/qc-database" class="menu-item" active-class="active" :title="collapsed ? 'Upload Database QC' : ''">
          <span class="icon">📥</span> <span class="label">Upload Database QC</span>
        </RouterLink>
        -->
      </div>

      <div v-if="!isStatsResultsOnly && !isQcSupport" class="menu-group">
        <div class="group-label">Delete Data</div>
        <RouterLink to="/delete/campaign" class="menu-item" active-class="active" :title="collapsed ? 'Delete Campaign' : ''">
          <span class="icon">🗑</span> <span class="label">Campaign</span>
        </RouterLink>
      </div>

      <div v-if="isSpqHead" class="menu-group">
        <div class="group-label">Administration</div>
        <RouterLink to="/spq-head/users" class="menu-item" active-class="active" :title="collapsed ? 'Manage User' : ''">
          <span class="icon">👥</span> <span class="label">Manage User</span>
        </RouterLink>
        <RouterLink to="/spq-head/roles" class="menu-item" active-class="active" :title="collapsed ? 'Hierarki Role & Menu' : ''">
          <span class="icon">🗂</span> <span class="label">Hierarki Role &amp; Menu</span>
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useSidebar } from '../composables/useSidebar.js'
import { useAuthStore } from '../stores/auth.js'
import logoFull from '../assets/brand/bank-mega-logo.png'
import logoMark from '../assets/brand/bank-mega-mark.png'

const { collapsed, toggle } = useSidebar()
const auth = useAuthStore()
const isQc = computed(() => auth.user?.role === 'qc')
// "admin" mirrors SPQ Head permissions everywhere.
const isSpqHeadOrSalesAgent = computed(() => ['spq_head', 'admin', 'sales_agent', 'qc_support'].includes(auth.user?.role))
const isSpqHead = computed(() => ['spq_head', 'admin'].includes(auth.user?.role))
const isSalesAgent = computed(() => auth.user?.role === 'sales_agent')
const isQcSupport = computed(() => auth.user?.role === 'qc_support')
// Team Leader QC is otherwise a Stats/Results-only role, but is allowed to upload
// audio & transcript (only those two entries of the Upload Data group).
const isTlQc = computed(() => auth.user?.role === 'team_leader_qc')
// "demo" = read-only showcase role. Its menu is curated explicitly (Stats, Results,
// Campaigns, Upload Transcript) rather than via the coarse group flags below.
const isDemo = computed(() => auth.user?.role === 'demo')
// Transkrip access: QC, Team Leader QC, QC Support, SPQ Head / Admin.
const isQcOrSpqHead = computed(() => ['qc', 'spq_head', 'admin', 'team_leader_qc', 'qc_support'].includes(auth.user?.role))
// Team Leader QC & SPQ Head / Admin manage QC ticket assignments.
const canAssignTickets = computed(() => ['team_leader_qc', 'spq_head', 'admin'].includes(auth.user?.role))
// Manual Check (banding) menu: QC melihat status banding-nya sendiri; TL QC / SPQ Head me-review.
const canReviewBanding = computed(() => ['qc', 'team_leader_qc', 'spq_head', 'admin'].includes(auth.user?.role))
// Pending Check menu (Manual Status pending queue): QC (tiket assigned-nya) + TL QC / SPQ Head.
const canPendingCheck = computed(() => ['qc', 'team_leader_qc', 'spq_head', 'admin'].includes(auth.user?.role))
// These roles only see Stats and Results (+ role-specific extras); everything else is SPQ-Head-only.
// "demo" is here too: it hides Campaigns / Upload / Delete, leaving Stats + Results
// (+ Transkrip via isQcOrSpqHead) — a read-only showcase menu.
const isStatsResultsOnly = computed(() => ['qc', 'sales_agent', 'team_leader', 'area_manager', 'telesales_head', 'team_leader_qc', 'demo'].includes(auth.user?.role))
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

.icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; }

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
