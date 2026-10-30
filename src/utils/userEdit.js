// Util murni untuk modal Edit di Manage User / Kelola QC (tanpa Vue, bisa dites node).

const LABELS = {
  username: 'Username (NIP)',
  name: 'Nama',
  email: 'Email',
  role: 'Role',
  password: 'Password',
  upload_audio: 'Upload Audio',
  upload_transcript: 'Upload Transcript',
}

export function fieldLabel(field) {
  return LABELS[field] || field
}

// Hanya field yang berubah (setelah trim). Password hanya bila diisi; role hanya
// bila pemanggil boleh mengubah role.
export function buildUserPatch(original, form, { canEditRole } = {}) {
  const patch = {}
  for (const k of ['username', 'name', 'email']) {
    const v = (form[k] ?? '').trim()
    if (v !== (original[k] ?? '')) patch[k] = v
  }
  if (canEditRole && form.role && form.role !== original.role) patch.role = form.role
  if (form.password) patch.password = form.password
  return patch
}

export function editWarnings(original, patch, { salesScope } = {}) {
  const out = []
  if ('username' in patch) {
    out.push('Tiket dan seluruh riwayat akan ikut pindah ke NIP baru.')
    if (salesScope) {
      out.push('User sales: roster Sales Database harus diupload ulang dengan NIP baru; sebelum itu user ini tidak melihat data. Data tiket lama di App C/DWH tetap memakai NIP lama.')
    }
  }
  if ('role' in patch && original.role === 'qc' && patch.role !== 'qc') {
    out.push('Tiket hari ini yang belum dikerjakan akan dibagi ulang di slot auto assign berikutnya.')
  }
  return out
}
