<template>
  <SidebarLayout title="Campaigns">
    <div v-if="loading" class="skeleton-list">
      <div class="skeleton-row" v-for="i in 3" :key="i"></div>
    </div>

    <div v-else class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Status</th>
            <th>Kesiapan</th>
            <th>Dibuat</th>
            <th>Diperbarui</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="campaigns.length === 0">
            <td colspan="5" class="empty">Belum ada campaign yang diupload.</td>
          </tr>
          <template v-for="c in campaigns" :key="c.id">
            <tr
              :class="['data-row', { 'row-active': c.is_active, expanded: expandedName === c.name }]"
              @click="toggleRow(c)"
            >
              <td class="cell-strong">
                <span class="expand-icon">{{ expandedName === c.name ? '▼' : '▶' }}</span>
                <span v-if="c.is_active" class="active-dot" title="Active"></span>
                {{ c.name }}
              </td>
              <td>
                <span :class="['status-badge', c.is_active ? 'badge-green' : 'badge-gray']">
                  {{ c.is_active ? '✓ Active' : 'Inactive' }}
                </span>
              </td>
              <!-- Kesiapan: campaign yang baru dibuat langsung bisa dipilih di filter
                   & saat membuat role, tapi itu belum berarti tiketnya akan muncul.
                   Syarat yang kurang di bawah ini gagal secara DIAM-DIAM. -->
              <td class="cell-ready" @click.stop>
                <template v-if="ready[c.name]">
                  <span class="rd" :class="ready[c.name].has_config ? 'ok' : 'bad'"
                        :title="ready[c.name].has_config
                          ? 'Prompt, scorecard, dan KB sudah terisi'
                          : 'Kosong: ' + ready[c.name].missing_config.join(', ') + ' — transkrip campaign ini akan DITOLAK saat diproses'">
                    {{ ready[c.name].has_config ? '✓' : '⚠' }} Config
                  </span>
                  <span class="rd" :class="ready[c.name].roster_people ? 'ok' : 'bad'"
                        :title="ready[c.name].roster_people
                          ? ready[c.name].roster_people + ' orang di Sales Database (kolom Dedicated), ' + ready[c.name].accounts + ' punya akun aktif'
                          : 'Belum ada baris di kolom Dedicated Sales Database — role sisi sales yang dibatasi ke campaign ini tidak akan melihat tiket apa pun'">
                    {{ ready[c.name].roster_people ? '✓' : '⚠' }} Roster
                    <b v-if="ready[c.name].roster_people">{{ ready[c.name].accounts }}/{{ ready[c.name].roster_people }}</b>
                  </span>
                  <span class="rd" :class="ready[c.name].tickets_done ? 'ok' : 'idle'"
                        :title="ready[c.name].tickets + ' tiket, ' + ready[c.name].tickets_done + ' selesai dinilai'">
                    {{ ready[c.name].tickets_done ? '✓' : '·' }} Tiket
                    <b>{{ ready[c.name].tickets_done }}</b>
                  </span>
                  <span v-if="ready[c.name].tickets_unmapped" class="rd bad"
                        :title="'Customer id tiket ini tidak ada di data TMS, sehingga tidak bisa dipetakan ke agent dan masuk ke node (Tidak diketahui)'">
                    ⚠ Tanpa TMS <b>{{ ready[c.name].tickets_unmapped }}</b>
                  </span>
                  <div v-if="readyHint(c.name)" class="rd-hint">{{ readyHint(c.name) }}</div>
                </template>
                <span v-else class="rd idle">—</span>
              </td>
              <td class="cell-date">{{ formatDate(c.created_at) }}</td>
              <td class="cell-date">{{ formatDate(c.updated_at) }}</td>
            </tr>
            <tr v-if="expandedName === c.name" class="expand-row">
              <td colspan="5">
                <div class="expand-content">
                  <div v-if="loadingDetail[c.name]" class="detail-loading">
                    <span class="spinner"></span> Memuat file...
                  </div>
                  <div v-else-if="details[c.name]?.error" class="detail-failed">
                    ✗ {{ details[c.name].error }}
                  </div>
                  <div v-else-if="details[c.name]" class="file-list">
                    <FileBlock
                      v-for="f in fileBlocks(details[c.name])"
                      :key="f.key"
                      :icon="f.icon"
                      :label="f.label"
                      :filename="f.filename"
                      :content="f.content"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, onMounted, h } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const campaigns = ref([])
const loading = ref(true)
const expandedName = ref(null)
const details = ref({})
const loadingDetail = ref({})

function formatDate(iso) {
  if (!iso) return '—'
  // Backend stores naive UTC; parse as UTC then render in WIB (Asia/Jakarta).
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

function fileBlocks(d) {
  const kbLabel = d.riplay_filename ? 'Knowledge Base (RIPLAY applied)' : 'Knowledge Base'
  const blocks = [
    { key: 'prompt', label: 'Prompt', filename: d.prompt_filename || 'prompt.txt', content: d.prompt_text || '' },
    { key: 'scorecard', label: 'Scorecard', filename: d.scorecard_filename || 'scorecard.txt', content: d.scorecard_text || '' },
    { key: 'kb', label: kbLabel, filename: d.kb_filename || 'knowledge_base.txt', content: d.kb_text || '' },
  ]
  if (d.riplay_filename) {
    // Hanya EMPAT blok yang ditampilkan: KB (RIPLAY applied), RIPLAY, Scorecard, Prompt.
    // `kb_text_raw` (KB sebelum overlay) dan `riplay_applied` (daftar KB yang mengikuti
    // RIPLAY) sengaja TIDAK ditampilkan — keduanya tetap tersimpan di DB & arsip MinIO
    // untuk audit, hanya tidak lagi dimunculkan di dashboard.
    blocks.push({
      key: 'riplay', label: `RIPLAY — ${d.riplay_product_name || '?'} (match ${d.riplay_similarity ?? '?'}%)`,
      filename: d.riplay_filename,
      content: JSON.stringify(d.riplay_extraction || {}, null, 2),
    })
  }
  return blocks
}

async function fetchDetail(name) {
  if (details.value[name]) return
  loadingDetail.value[name] = true
  try {
    const res = await apiClient.get('/get_campaign', { params: { campaign: name } })
    details.value[name] = res.data
  } catch {
    details.value[name] = { error: 'Gagal memuat detail campaign.' }
  } finally {
    loadingDetail.value[name] = false
  }
}

async function toggleRow(c) {
  if (expandedName.value === c.name) {
    expandedName.value = null
    return
  }
  expandedName.value = c.name
  await fetchDetail(c.name)
}

// Collapsible per-file viewer: filename header + on-demand <pre> content.
const FileBlock = {
  props: { label: String, filename: String, content: String },
  setup(p) {
    const open = ref(false)
    return () =>
      h('div', { class: 'file-block' }, [
        h('div', { class: 'file-head', onClick: () => (open.value = !open.value) }, [
          // Single inline line — literal spaces between parts are always
          // preserved (flex gap between separate items was unreliable here).
          h('span', { class: 'file-line' }, [
            h('span', { class: 'file-label' }, `${p.label} :`),
            ' ',
            h('span', { class: 'file-name' }, p.filename),
            ' ',
            h('span', { class: 'file-toggle' }, open.value ? '▲' : '▼'),
          ]),
        ]),
        open.value ? h('pre', { class: 'txt-viewer' }, p.content || '(kosong)') : null,
      ])
  },
}

// Kesiapan per campaign, dipetakan berdasarkan nama.
const ready = ref({})

// Keterangan singkat untuk penghalang yang PALING menghambat, satu saja — daftar
// panjang di dalam sel tabel justru tidak terbaca.
function readyHint(name) {
  const r = ready.value[name]
  if (!r) return ''
  if (!r.has_config) {
    return `${r.missing_config.join(', ')} masih kosong — transkrip campaign ini akan ditolak saat diproses.`
  }
  if (!r.roster_people) {
    return 'Belum ada orang di kolom Dedicated Sales Database — role sisi sales tidak akan melihat tiket apa pun.'
  }
  if (r.tickets_unmapped) {
    return `${r.tickets_unmapped} tiket tidak ada di data TMS — masuk ke "(Tidak diketahui)" dan tidak terlihat oleh user sisi sales.`
  }
  return ''
}

onMounted(async () => {
  try {
    const [listRes, readyRes] = await Promise.all([
      apiClient.get('/list_campaigns'),
      // Gagal/ditolak (role tanpa izin) tidak boleh menjatuhkan daftar campaign-nya.
      apiClient.get('/campaign_readiness').catch(() => ({ data: null })),
    ])
    campaigns.value = listRes.data.campaigns || []
    if (readyRes.data) {
      ready.value = Object.fromEntries((readyRes.data.items || []).map((i) => [i.name, i]))
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.table-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  background: #f8fafc; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); text-align: left;
}

.data-row { cursor: pointer; }
.data-row td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.row-active td { background: var(--green-bg); }
.row-active:hover td { background: #dcfce7; }
.data-row:hover td { background: #f8fafc; }
.data-row.expanded td { background: var(--blue-bg); }

.expand-icon { margin-right: 6px; color: var(--text-muted); font-size: 10px; }
.active-dot { display: inline-block; width: 8px; height: 8px; background: var(--green); border-radius: 50%; margin-right: 8px; }
.cell-strong { font-weight: 700; }
.cell-date { white-space: nowrap; color: var(--text-muted); font-size: 12px; }

.status-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.empty { text-align: center; padding: 40px; color: var(--text-muted); }

.expand-row td { padding: 0; background: #fafbfc; }
.expand-content { padding: 18px 20px; border-bottom: 1px solid var(--border); }

.detail-loading { display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 13px; }
.detail-failed { color: var(--red); font-size: 13px; }

.file-list { display: flex; flex-direction: column; gap: 10px; }

.file-block { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; }
.file-head {
  display: flex; align-items: center; padding: 10px 14px; cursor: pointer;
  font-size: 13px; transition: background 0.15s;
}
.file-line { word-break: break-all; }
.file-head:hover { background: #f1f5f9; }
.file-icon { font-size: 15px; }
.file-label { font-weight: 700; }
.file-name { font-family: monospace; color: var(--blue); word-break: break-all; }
.file-size { color: var(--text-muted); font-size: 12px; }
.file-toggle { font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }

.txt-viewer {
  margin: 0; padding: 14px; background: #0f172a; color: #e2e8f0;
  font-family: monospace; font-size: 12px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; max-height: 420px; overflow: auto;
  border-top: 1px solid var(--border);
}

.spinner {
  width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: var(--blue);
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-row {
  height: 56px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200%; border-radius: 8px; animation: shimmer 1.2s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.cell-ready { white-space: normal; }
.rd {
  display: inline-block; font-size: 10.5px; font-weight: 700; white-space: nowrap;
  padding: 2px 7px; border-radius: 999px; margin: 1px 4px 1px 0; cursor: help;
}
.rd b { font-weight: 800; margin-left: 3px; }
.rd.ok { background: var(--green-bg); color: #16a34a; }
.rd.bad { background: var(--red-bg); color: var(--red); }
.rd.idle { background: #f1f5f9; color: var(--text-muted); }
.rd-hint { font-size: 11px; color: var(--text-muted); line-height: 1.4; margin-top: 4px; max-width: 340px; }
</style>
