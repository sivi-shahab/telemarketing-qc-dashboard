import { createRouter, createWebHistory } from 'vue-router'

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
  {
    path: '/dashboard/qc-database',
    component: () => import('../views/dashboard/QcDatabaseView.vue'),
  },
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
  {
    path: '/upload/qc-database',
    component: () => import('../views/upload/UploadQcDatabaseView.vue'),
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
    path: '/spq-head/roles',
    component: () => import('../views/spq-head/RoleHierarchyView.vue'),
  },
  {
    path: '/qc/assign',
    component: () => import('../views/qc/AssignTicketView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(to => {
  const token = localStorage.getItem('access_token')
  if (to.path !== '/login' && !token) {
    return '/login'
  }
  // Role "qc" is restricted to the Dashboard menu (Stats / Results / Campaigns).
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (user?.role === 'qc' && !to.path.startsWith('/dashboard')) {
    return '/dashboard/stats'
  }

  // QC Support has NO Statistics menu — send them to Results instead.
  if (user?.role === 'qc_support' && to.path === '/dashboard/stats') {
    return '/dashboard/results'
  }

  // "Upload Audio" is limited to SPQ Head / Admin, Sales Agent, QC Support, and Team Leader QC.
  if (to.path === '/upload/audio' && !['spq_head', 'admin', 'sales_agent', 'qc_support', 'team_leader_qc'].includes(user?.role)) {
    return '/'
  }

  // Transkrip (list + detail): QC / Team Leader QC / QC Support / SPQ Head / Admin.
  if (to.path.startsWith('/dashboard/transcripts') && !['qc', 'spq_head', 'admin', 'team_leader_qc', 'qc_support'].includes(user?.role)) {
    return '/'
  }

  // Manual Check (banding) & Pending Check (antrean Manual Status):
  // QC / Team Leader QC / SPQ Head / Admin — sejalan dengan menu di SidebarMenu.
  if (
    ['/dashboard/banding-review', '/dashboard/pending-check'].includes(to.path) &&
    !['qc', 'team_leader_qc', 'spq_head', 'admin'].includes(user?.role)
  ) {
    return '/'
  }

  // Assign Ticket (QC ticket assignment) is Team Leader QC / SPQ Head / Admin.
  if (to.path.startsWith('/qc/') && !['team_leader_qc', 'spq_head', 'admin'].includes(user?.role)) {
    return '/'
  }

  // SPQ Head area ("Manage User", "Hierarki Role") is SPQ Head / Admin only.
  if (to.path.startsWith('/spq-head') && !['spq_head', 'admin'].includes(user?.role)) {
    return '/'
  }

  // Sales/QC database (upload + list) is SPQ Head / Admin only.
  if (
    ['/upload/sales-database', '/dashboard/sales-database',
     '/upload/qc-database', '/dashboard/qc-database'].includes(to.path) &&
    !['spq_head', 'admin'].includes(user?.role)
  ) {
    return '/'
  }
})

export default router