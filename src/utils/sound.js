// Pemutar efek suara pendek untuk kejadian di UI (halaman login & masuk dashboard).
//
// Dipusatkan di sini karena aturannya sama di setiap pemakaian: suara bersifat
// PELENGKAP, jadi kegagalannya tidak boleh menghentikan alur yang menyertainya —
// pengguna tetap harus bisa masuk dashboard walau audionya bisu.

/** Putar satu berkas. Mengembalikan objek Audio (atau null bila gagal dibuat). */
export function playSound(src, volume = 0.6) {
  try {
    const audio = new Audio(src)
    audio.volume = volume
    // Chrome/Safari mengembalikan Promise yang REJECT (bukan throw) saat ditolak
    // kebijakan autoplay; tanpa .catch() itu muncul sebagai unhandled rejection.
    const p = audio.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
    return audio
  } catch (e) {
    return null
  }
}

/** Hentikan audio dan lepaskan sumbernya. Aman dipanggil dengan null. */
export function stopSound(audio) {
  if (!audio) return
  try {
    audio.pause()
    audio.currentTime = 0
  } catch (e) {
    /* audio sudah dilepas browser — tidak ada yang perlu dihentikan */
  }
}

/**
 * Putar beberapa berkas BERURUTAN — berkas berikutnya mulai setelah yang
 * sebelumnya selesai (event ``ended``), bukan bersamaan. Dipakai halaman login
 * untuk memutar First lalu Second sebagai satu rangkaian.
 *
 * Rantainya bertahan melewati perpindahan rute: ``router.push`` hanya menukar
 * komponen di dalam SPA tanpa memuat ulang halaman, jadi objek Audio-nya tetap
 * hidup dan berkas berikutnya tetap terdengar walau layar sudah pindah.
 *
 * ``retryOnGesture``: Chrome, Safari, dan Firefox menolak memutar audio bersuara
 * sebelum pengguna berinteraksi dengan halaman, sehingga rangkaian yang dimulai
 * saat komponen dipasang PASTI ditolak di kunjungan pertama. Bila opsi ini aktif
 * dan pemutaran pertama ditolak, rangkaian diulang DARI AWAL pada interaksi
 * pertama pengguna — biasanya klik ke kolom Username.
 *
 * Mengembalikan handle dengan ``stop()`` yang memutus rantai sekaligus mencabut
 * pendengar cadangan, supaya tidak ada suara menyusul setelah komponen ditinggalkan.
 */
export function playSequence(sources, { volume = 0.6, retryOnGesture = false } = {}) {
  const list = (sources || []).filter(Boolean)
  const EVENTS = ['pointerdown', 'keydown', 'touchstart']
  let index = 0
  let current = null
  let cancelled = false
  let armed = false

  function detach() {
    if (!armed) return
    armed = false
    for (const ev of EVENTS) window.removeEventListener(ev, retry)
  }
  function retry() {
    detach()
    if (cancelled) return
    index = 0            // ulang dari berkas pertama, bukan lanjut di tengah
    next()
  }
  function arm() {
    if (armed || cancelled || !retryOnGesture) return
    armed = true
    for (const ev of EVENTS) window.addEventListener(ev, retry, { once: true })
  }

  function next() {
    if (cancelled || index >= list.length) {
      current = null
      return
    }
    const isFirst = index === 0
    let audio
    try {
      audio = new Audio(list[index++])
    } catch (e) {
      return
    }
    audio.volume = volume
    audio.addEventListener('ended', next, { once: true })
    // Berkas gagal dimuat -> lanjut ke berikutnya, jangan biarkan rantainya
    // berhenti diam-diam di tengah.
    audio.addEventListener('error', next, { once: true })
    const p = audio.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Ditolak kebijakan autoplay. Pada berkas PERTAMA itu wajar (belum ada
        // interaksi) — pasang pendengar dan ulangi nanti. Pada berkas lanjutan
        // penolakan berarti hal lain; hentikan saja daripada mencoba berulang.
        if (isFirst && retryOnGesture) arm()
        else cancelled = true
      })
    }
    current = audio
  }

  next()
  return {
    stop() {
      cancelled = true
      detach()
      stopSound(current)
      current = null
    },
  }
}
