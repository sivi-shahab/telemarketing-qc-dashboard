// Display label + badge styling for AI Status values.
//
// The stored/internal value stays PASS/FAIL/PENDING (used by the backend, XLSX
// exports, and the QC change-request flow); only the UI label differs:
//   PASS    -> QUALIFIED
//   FAIL    -> NOT QUALIFIED
//   PENDING -> PENDING   (butuh unggah dokumen, masih dalam tenggat H+2)
export function aiStatusLabel(status) {
  if (status === 'PASS') return 'QUALIFIED'
  if (status === 'FAIL') return 'NOT QUALIFIED'
  if (status === 'PENDING') return 'PENDING'
  return status
}

// Badge CSS class per status: green (Qualified) / red (Not Qualified) /
// yellow "wait" (Pending). Shared by Results, Stats, and the QC modals.
export function aiStatusBadgeClass(status) {
  if (status === 'PASS') return 'badge-green'
  if (status === 'FAIL') return 'badge-red'
  if (status === 'PENDING') return 'badge-wait'
  return 'badge-gray'
}
