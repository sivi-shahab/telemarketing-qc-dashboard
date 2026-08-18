// Warna badge role — SATU sumber untuk seluruh dashboard.
//
// Peta ini sebelumnya disalin di AccountPanel.vue, ManageUserView.vue, dan
// TranscriptsView.vue. Salinannya sempat berbeda: TranscriptsView tidak punya baris
// `demo`, sehingga role Demo tampil biru di sana dan abu-abu di tempat lain.
//
// Kelas yang dihasilkan (badge-red / badge-yellow / badge-green / badge-blue /
// badge-gray) sudah didefinisikan di style masing-masing halaman, memakai token
// warna global di App.vue.

const BY_KEY = {
  spq_head: 'badge-red',
  admin: 'badge-red',
  telesales_head: 'badge-red',
  qc: 'badge-yellow',
  team_leader_qc: 'badge-yellow',
  qc_support: 'badge-yellow',
  team_leader: 'badge-green',
  area_manager: 'badge-green',
  sales_agent: 'badge-blue',
  demo: 'badge-gray',
}

// Cadangan untuk role buatan operator yang tidak punya template: warnai menurut
// cakupan datanya, supaya tetap sewarna dengan role bawaan yang setingkat.
const BY_SCOPE = {
  all: 'badge-red',
  qc_assigned: 'badge-yellow',
  qc_support_own: 'badge-yellow',
  sales_am: 'badge-green',
  sales_tl: 'badge-green',
  sales_agent: 'badge-blue',
}

/**
 * Kelas warna badge untuk sebuah role.
 *
 * @param {string} roleKey   key role (mis. 'spq_head', 'tl_ntb')
 * @param {object} [opts]    { baseRole, dataScope } — dipakai untuk role buatan
 *                           operator: role turunan mewarisi warna template-nya,
 *                           lalu jatuh ke warna cakupan datanya.
 */
export function roleBadgeClass(roleKey, opts = {}) {
  const key = (roleKey || 'sales_agent').toLowerCase()
  if (BY_KEY[key]) return BY_KEY[key]

  const base = (opts.baseRole || '').toLowerCase()
  if (BY_KEY[base]) return BY_KEY[base]

  return BY_SCOPE[opts.dataScope] || 'badge-blue'
}

const LABELS = {
  spq_head: 'SPQ Head',
  admin: 'Admin',
  telesales_head: 'Telesales Head',
  team_leader_qc: 'Team Leader QC',
  qc: 'QC',
  qc_support: 'QC Support',
  area_manager: 'Area Manager',
  team_leader: 'Team Leader Sales',
  sales_agent: 'Sales Agent',
  demo: 'Demo',
}

/** Nama tampilan role bawaan. Role buatan operator memakai `label` dari /roles. */
export function roleLabel(roleKey) {
  const key = (roleKey || '').toLowerCase()
  return LABELS[key] || key
}
