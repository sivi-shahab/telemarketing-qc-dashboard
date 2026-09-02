import { createRouter, createWebHistory } from 'vue-router'
import { ROUTE_PERMISSIONS } from '../permissions.js'

const routes = [
  { path: '/', redirect: '/dashboard/stats' },
  { path: '/login', component: () => import('../views/LoginView.vue') },
  {
    path: '/dashboard/stats',
    component: () => import('../views/dashboard/StatsView.vue'),
  },
  {
    path: '/dashboard/results',
    component: () => import('../views/dashboard/ResultsView.vue'),
  },
  {
    // Manual Check: ResultsView difilter ke tiket banding yang menunggu review tier pemanggil.
    path: '/dashboard/banding-review',
    component: () => import('../views/dashboard/ResultsView.vue'),
    meta: { bandingReview: true },
  },
  {
    // Pending Check: ResultsView difilter ke antrean Manual Status yang masih pending.
    path: '/dashboard/pending-check',
    component: () => import('../views/dashboard/ResultsView.vue'),
    meta: { pendingCheck: true },
  },
  {
    path: '/dashboard/campaigns',
    component: () => import('../views/dashboard/CampaignsView.vue'),
  },
  {
    path: '/dashboard/transcripts',
    component: () => import('../views/dashboard/TranscriptsView.vue'),
  },
  {
    path: '/dashboard/transcripts/:tiketId',
    component: () => import('../views/dashboard/TranscriptDetailView.vue'),
  },
  {
    path: '/dashboard/sales-database',
    component: () => import('../views/dashboard/SalesDatabaseView.vue'),
  },
  // qc-database dinonaktifkan (endpoint /list_qc_databases sudah dimatikan di API).
  // {
  //   path: '/dashboard/qc-database',
  //   component: () => import('../views/dashboard/QcDatabaseView.vue'),
  // },
  {
    path: '/upload/transcript',
    component: () => import('../views/upload/UploadTranscriptView.vue'),
  },
  {
    path: '/upload/audio',
    component: () => import('../views/upload/UploadAudioView.vue'),
  },
  {
    path: '/upload/result',
    component: () => import('../views/upload/GetResultView.vue'),
  },
  {
    path: '/upload/campaign',
    component: () => import('../views/upload/UploadCampaignView.vue'),
  },
  {
    path: '/upload/sales-database',
    component: () => import('../views/upload/UploadSalesDatabaseView.vue'),
  },
  // qc-database dinonaktifkan (endpoint /upload_qc_database sudah dimatikan di API).
  // {
  //   path: '/upload/qc-database',
  //   component: () => import('../views/upload/UploadQcDatabaseView.vue'),
  // },
  {
    // Reprocess All Ticket (menu Upload Data). Route ini TIDAK ikut ter-commit:
    // berkas router ada di .gitignore sejak 12 Agustus 2026, sedangkan fiturnya
    // lahir 21 Agustus — jadi pendaftarannya harus disalin manual ke tiap environment.
    path: '/upload/reprocess',
    component: () => import('../views/upload/ReprocessTicketsView.vue'),
  },
  {
    path: '/delete/campaign',
    component: () => import('../views/delete/DeleteCampaignView.vue'),
  },
  {
    path: '/spq-head/users',
    component: () => import('../views/spq-head/ManageUserView.vue'),
  },
  {
    path: '/spq-head/manage-roles',
    component: () => import('../views/spq-head/ManageRoleView.vue'),
  },
  {
    path: '/spq-head/roles',
    component: () => import('../views/spq-head/RoleHierarchyView.vue'),
  },
  {
    path: '/qc/assign',
    component: () => import('../views/qc/AssignTicketView.vue'),
  },
  {
    // Catch-all: harus tetap paling akhir agar tidak menaungi route di atasnya.
    path: '/:pathMatch(.*)*',
    component: () => import('../views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Capability yang dibutuhkan sebuah path. Route detail mewarisi izin induknya
// (mis. `/dashboard/transcripts/221111rBUk` -> `/dashboard/transcripts`): dicari
// prefix TERDAFTAR yang paling panjang, dan hanya pada batas segmen '/' supaya
// `/dashboard/results-lain` tidak ikut terwarisi. `null` = cukup login.
function requiredPermission(path) {
  const direct = ROUTE_PERMISSIONS[path]
  if (direct) return direct
  let best = null
  for (const key of Object.keys(ROUTE_PERMISSIONS)) {
    if (path.startsWith(`${key}/`) && (!best || key.length > best.length)) best = key
  }
  return best ? ROUTE_PERMISSIONS[best] : null
}

// Halaman pendaratan saat sebuah route ditolak: yang PERTAMA boleh dibuka pemanggil.
// Menolak ke '/' saja tidak cukup — '/' me-redirect ke /dashboard/stats, yang justru
// tertutup bagi role tanpa MENU_STATS (mis. qc_support), sehingga akan memantul.
const LANDING_ORDER = [
  '/dashboard/stats',
  '/dashboard/results',
  '/dashboard/transcripts',
  '/upload/result',
]

function landingFor(perms) {
  for (const path of LANDING_ORDER) {
    const need = ROUTE_PERMISSIONS[path]
    if (!need || perms.includes(need)) return path
  }
  return '/login'
}

// Guard berbasis CAPABILITY, bukan daftar nama role.
//
// Versi lama mencocokkan `user.role` ke literal (`['spq_head','admin']` dst). Bentuk
// itu menolak SEMUA role buatan operator lewat menu Manage Role — namanya tidak
// pernah ada di daftar mana pun — dan daftarnya juga tertinggal dari kebijakan
// 14 Agustus 2026 yang memindahkan pengurusan data ke `admin`. Sekarang sumber
// kebenarannya satu: ROUTE_PERMISSIONS, peta yang sama yang dipakai SidebarMenu
// untuk memutuskan link mana yang dirender.
router.beforeEach(to => {
  const token = localStorage.getItem('access_token')
  if (to.path !== '/login' && !token) return '/login'
  if (to.path === '/login') return true

  const user = JSON.parse(localStorage.getItem('user') || 'null')
  // Sesi lama (localStorage dari build sebelum capability) belum menyimpan
  // `permissions`. Jangan kunci mereka di luar: App.vue memanggil reloadMe() saat
  // dimuat sehingga datanya sembuh sendiri, dan endpoint tetap menegakkan izin.
  if (!Array.isArray(user?.permissions)) return true

  const need = requiredPermission(to.path)
  if (need && !user.permissions.includes(need)) return landingFor(user.permissions)
  return true
})

export default router