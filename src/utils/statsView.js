// Resolusi mode menu Stats (Cashline | Collection) dari `stats_views` server.
// Server yang memutuskan hak akses (api/rbac.py stats_views); di sini hanya
// memilih mana yang tampil bila login berhak keduanya.
export const STATS_VIEW_KEY = 'stats.view'

export function resolveStatsView(views, stored) {
  const list = Array.isArray(views) ? views : []
  if (!list.length) return null
  if (list.includes(stored)) return stored
  return list[0]
}
