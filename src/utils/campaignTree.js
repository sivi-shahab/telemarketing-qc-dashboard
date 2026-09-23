// Hierarki campaign untuk checklist Manage Role / Assign Role.
//
// `groups` datang dari API (`campaign_groups`, mis. { Telemarketing: ['Cashline'] }):
// Cashline adalah produk telemarketing, jadi ia SUBSET Telemarketing — bukan
// pilihan setara. Mencentang grupnya sudah mencakup seluruh anggotanya, termasuk
// produk yang kelak di-upload; anggota yang dicentang sendirian berarti sengaja
// dipersempit ke satu produk. Server menormalkan hal yang sama saat menyimpan.

function memberSet(groups) {
  return new Set(Object.values(groups || {}).flat())
}

// [{ name, children }] — grup dengan anggotanya, lalu campaign yang berdiri sendiri.
export function buildCampaignTree(campaigns, groups) {
  const members = memberSet(groups)
  return (campaigns || [])
    .filter((c) => !members.has(c))
    .map((c) => ({ name: c, children: [...((groups || {})[c] || [])] }))
}

// Pilihan baru setelah `name` dicentang/dibuka. Mencentang grup membuang anggotanya
// dari pilihan: sudah tercakup, dan menyimpannya hanya membuat tag tampak ganda.
export function toggleCampaign(selected, name, checked, groups) {
  let out = (selected || []).filter((c) => c !== name)
  if (checked) {
    const children = new Set((groups || {})[name] || [])
    out = out.filter((c) => !children.has(c))
    out.push(name)
  }
  return out
}

// True bila `name` sudah tercakup grup yang dicentang.
export function isImplied(selected, name, groups) {
  return Object.entries(groups || {}).some(
    ([group, children]) => (selected || []).includes(group) && children.includes(name),
  )
}

// Campaign efektif untuk ditampilkan: grup beserta anggota yang tercakup olehnya,
// supaya "Telemarketing, Cashline" terbaca sebagai satu hierarki, bukan dua tag.
export function splitEffective(effective, groups) {
  const list = effective || []
  const covered = new Set()
  const out = []
  for (const c of list) {
    const children = (groups || {})[c]
    if (children) {
      const includes = list.filter((x) => children.includes(x))
      includes.forEach((x) => covered.add(x))
      out.push({ name: c, includes })
    }
  }
  for (const c of list) {
    if (!covered.has(c) && !(c in (groups || {}))) out.push({ name: c, includes: [] })
  }
  return out
}
