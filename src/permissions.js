// Kosakata capability — cermin dari api/permissions.py.
//
// Sidebar, guard router, dan gate fitur di Results/Stats dulu memakai daftar nama
// role yang di-hardcode, sehingga role buatan operator (menu Manage Role) tidak
// pernah lolos. Sekarang semuanya membaca string di bawah, yang dikirim backend
// lewat /auth/me.
//
// Kalau menambah permission baru, tambahkan di kedua berkas.
export const P = {
  // Menu
  MENU_STATS: 'menu.stats',
  MENU_RESULTS: 'menu.results',
  MENU_TRANSCRIPTS: 'menu.transcripts',
  MENU_ASSIGN_TICKET: 'menu.assign_ticket',
  MENU_MANUAL_CHECK: 'menu.manual_check',
  MENU_PENDING_CHECK: 'menu.pending_check',
  MENU_CAMPAIGNS: 'menu.campaigns',
  MENU_SALES_DATABASE: 'menu.sales_database',
  MENU_QC_DATABASE: 'menu.qc_database',
  MENU_UPLOAD_CAMPAIGN: 'menu.upload_campaign',
  MENU_UPLOAD_AUDIO: 'menu.upload_audio',
  MENU_UPLOAD_TRANSCRIPT: 'menu.upload_transcript',
  MENU_GET_RESULT: 'menu.get_result',
  MENU_UPLOAD_SALES_DATABASE: 'menu.upload_sales_database',
  MENU_UPLOAD_QC_DATABASE: 'menu.upload_qc_database',
  MENU_DELETE_CAMPAIGN: 'menu.delete_campaign',
  MENU_MANAGE_USER: 'menu.manage_user',
  MENU_MANAGE_ROLE: 'menu.manage_role',
  MENU_ROLE_HIERARCHY: 'menu.role_hierarchy',

  // Fitur di halaman Results
  RESULTS_EVALUATION_DETAIL: 'results.evaluation_detail',
  RESULTS_CRITICAL_FAILURE: 'results.critical_failure',
  RESULTS_CATEGORY_SCORE: 'results.category_score',
  MANUAL_STATUS_COLUMN: 'results.manual_status.column',
  MANUAL_STATUS_SET: 'results.manual_status.set',
  MANUAL_STATUS_DIRECT: 'results.manual_status.direct',
  MANUAL_STATUS_REVIEW_TL: 'results.manual_status.review_tl',
  MANUAL_STATUS_REVIEW_SPQ: 'results.manual_status.review_spq',
  ERROR_CODE_APPEAL: 'results.error_code.appeal',
  ERROR_CODE_DIRECT_EDIT: 'results.error_code.direct_edit',
  ERROR_CODE_REVIEW_TL: 'results.error_code.review_tl',
  ERROR_CODE_REVIEW_SPQ: 'results.error_code.review_spq',
  DOCUMENT_UPLOAD: 'results.document.upload',
  DOCUMENT_VIEW: 'results.document.view',
  DOCUMENT_VERIFICATION_TABLE: 'results.document.verification',
  QC_MANUAL_CHECK_APPROVE: 'results.manual_check.approve',
  RESULTS_FILTER_QC_SIDE: 'results.filter.qc_side',
  RESULTS_EXPORT_VERIFICATION: 'results.export.verification',

  // Fitur di halaman Stats
  STATS_FAILURE_REASON: 'stats.failure_reason',
  STATS_QC_PERFORMANCE: 'stats.qc_performance',
  STATS_RISK_BASE: 'stats.risk_base',
  STATS_RISK_SYSTEM_NEW: 'stats.risk_system_new',

  // Administrasi
  ADMIN_ROLE_WRITE: 'admin.role.write',
  ADMIN_TICKET_DELETE: 'admin.ticket.delete',
}

// Peta path -> capability yang dibutuhkan, dipakai guard router. Path yang tidak
// terdaftar hanya butuh login.
export const ROUTE_PERMISSIONS = {
  '/dashboard/stats': P.MENU_STATS,
  '/dashboard/results': P.MENU_RESULTS,
  '/dashboard/banding-review': P.MENU_MANUAL_CHECK,
  '/dashboard/pending-check': P.MENU_PENDING_CHECK,
  '/dashboard/campaigns': P.MENU_CAMPAIGNS,
  '/dashboard/transcripts': P.MENU_TRANSCRIPTS,
  '/dashboard/sales-database': P.MENU_SALES_DATABASE,
  '/dashboard/qc-database': P.MENU_QC_DATABASE,
  '/upload/transcript': P.MENU_UPLOAD_TRANSCRIPT,
  '/upload/audio': P.MENU_UPLOAD_AUDIO,
  '/upload/result': P.MENU_GET_RESULT,
  '/upload/campaign': P.MENU_UPLOAD_CAMPAIGN,
  '/upload/sales-database': P.MENU_UPLOAD_SALES_DATABASE,
  '/upload/qc-database': P.MENU_UPLOAD_QC_DATABASE,
  '/delete/campaign': P.MENU_DELETE_CAMPAIGN,
  '/spq-head/users': P.MENU_MANAGE_USER,
  '/spq-head/manage-roles': P.MENU_MANAGE_ROLE,
  '/spq-head/roles': P.MENU_ROLE_HIERARCHY,
  '/qc/assign': P.MENU_ASSIGN_TICKET,
}

// Urutan halaman fallback saat user membuka path yang tidak diizinkan: pakai
// halaman pertama yang boleh dia buka. Tanpa ini, role tanpa Stats (mis. QC
// Support) akan terlempar ke halaman yang juga ditolak — berputar tanpa henti.
export const LANDING_ORDER = [
  ['/dashboard/stats', P.MENU_STATS],
  ['/dashboard/results', P.MENU_RESULTS],
  ['/dashboard/transcripts', P.MENU_TRANSCRIPTS],
  ['/dashboard/campaigns', P.MENU_CAMPAIGNS],
  ['/upload/transcript', P.MENU_UPLOAD_TRANSCRIPT],
]

export function landingPathFor(permissions) {
  const mine = permissions || []
  const hit = LANDING_ORDER.find(([, perm]) => mine.includes(perm))
  return hit ? hit[0] : '/login'
}
