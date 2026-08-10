// Display label for AI Status values.
//
// The stored/internal value stays PASS/FAIL (used by the backend, XLSX exports,
// and the QC change-request flow); only the UI label differs:
//   PASS -> APPROVE
//   FAIL -> REJECT
//
// Ganti 'REJECT' -> 'RETURN' di sini kalau istilahnya berubah: dropdown filter,
// badge di tabel, dan modal QC semuanya ikut karena membaca fungsi ini.
export function aiStatusLabel(status) {
  if (status === 'PASS') return 'APPROVE'
  if (status === 'FAIL') return 'REJECT'
  return status
}

// Nilai internal ai_status yang valid — satu sumber kebenaran untuk membangun
// opsi dropdown filter. Urutannya menentukan urutan opsi yang tampil.
// JANGAN ubah string-nya: ini yang dikirim ke /list_results?ai_status=...
export const AI_STATUS_VALUES = ['PASS', 'FAIL']