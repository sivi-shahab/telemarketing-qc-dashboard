// Shared PDF-to-canvas page renderer (page-width fit, retina-aware). A render
// call is versioned with an internal token so a stale in-flight render (e.g.
// triggered by a resize) is discarded if a newer one starts first.
//
// Tiap halaman dirender DUA lapis: canvas untuk gambarnya, lalu lapisan teks
// pdf.js di atasnya. Lapisan kedua itu yang membuat ctrl+F bekerja — canvas
// hanya piksel, dan find-in-page Chrome cuma menelusuri DOM. Lihat
// `src/assets/pdf-text-layer.css` untuk duduk perkaranya.
//
// `renderAll(pdfDoc, container, options)` — argumen ketiga OPSIONAL:
//   - Tidak diberikan sama sekali (pemakai lama: PdfViewer.vue,
//     TranscriptDetailView.vue) → perilaku persis seperti sebelumnya. Lebar
//     halaman mengikuti `width: 100%` dari CSS pemakainya sendiri.
//   - Diberikan sebagai objek `{ zoom, fitWidth }` (CollectionPdfPanel.vue)
//     → lebar dasar dikalikan `zoom` (default 1), dan lebar `.pdf-page`
//     ditulis eksplisit lewat inline style (piksel), BUKAN diserahkan ke CSS
//     `width: 100%`. Ini dites dengan `options !== undefined`, bukan dengan
//     `zoom !== 1`, supaya "Pas lebar" (zoom = 1) di panel itu juga
//     menghasilkan lebar piksel eksplisit — perlu karena `.cpdf-pages` di
//     panel itu adalah wadah `width: max-content` (supaya bisa lebih lebar
//     dari viewport saat zoom > 100%), dan `width: 100%` pada elemen anak di
//     dalam wadah max-content akan melingkar balik ke kontennya sendiri.
//   - `fitWidth`: lebar dasar (sebelum dikalikan zoom) yang DIPAKSAKAN
//     pemanggil, dipakai bukannya `contentWidth(container)`. Lihat komentar
//     di `contentWidth` di bawah untuk alasannya.
import { TextLayer } from 'pdfjs-dist'
import '../assets/pdf-text-layer.css'

// Di bawah angka ini yang terukur hampir pasti bukan lebar tampilan: wadah yang
// ukurannya mengikuti isi (shrink-to-fit) menyisakan padding saja begitu isinya
// dikosongkan tepat sebelum render. Merendernya apa adanya menghasilkan halaman
// selebar 1px — tidak melempar galat, layarnya sekadar kosong.
const MIN_SANE_WIDTH = 80

function boxWidth(el) {
  if (!el) return 0
  const style = getComputedStyle(el)
  const pad = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0')
  return (el.clientWidth || 0) - pad
}

// Lebar KOTAK ISI wadahnya. `clientWidth` sudah termasuk padding, sedangkan
// halaman ditampilkan selebar 100% kotak isi; memakai clientWidth mentah bikin
// canvas dirender lebih lebar dari tampilannya, dan lapisan teks — yang
// diposisikan dari skala, bukan dari CSS — jadi meleset dari glifnya.
//
// PERINGATAN untuk wadah `width: max-content` (seperti `.cpdf-pages` di
// CollectionPdfPanel.vue): `clientWidth`-nya BUKAN lebar tampilan yang stabil,
// melainkan lebar konten TERLEBAR yang sedang ada di dalamnya saat ini — yaitu
// halaman dari render SEBELUMNYA (karena `container.innerHTML` baru dikosongkan
// beberapa baris di bawah `renderAll`, sesudah lebar ini diukur). Memanggil
// `contentWidth` pada wadah begitu jadi melingkar balik: lebar render
// berikutnya dihitung dari lebar render sebelumnya (yang sudah dikalikan zoom
// lama), bukan dari lebar "pas" yang sesungguhnya — dan menyusut/melebar
// menumpuk tiap kali zoom berubah. Pemanggil dengan wadah semacam ini WAJIB
// mengoper `options.fitWidth` (diukur dari elemen scroll `overflow: auto`
// milik pemanggil, bukan dari `container` ini) alih-alih mengandalkan fungsi
// ini.
function contentWidth(container) {
  const own = boxWidth(container)
  if (own >= MIN_SANE_WIDTH) return own
  // Wadahnya belum punya lebar sendiri: pakai kotak isi induknya, yang lebarnya
  // ditentukan tata letak halaman dan bukan oleh isi wadah ini.
  const parent = boxWidth(container.parentElement)
  return parent >= MIN_SANE_WIDTH ? parent : 800
}

export function createPdfPageRenderer() {
  let renderToken = 0

  async function renderAll(pdfDoc, container, options) {
    if (!pdfDoc || !container) return
    // Sengaja dites lewat `options !== undefined`, bukan lewat nilai `zoom`
    // di dalamnya: pemanggil lama tidak pernah mengoper argumen ketiga sama
    // sekali, jadi keduanya tetap bisa dibedakan walau zoom-nya sama-sama 1.
    const hasOptions = options !== undefined
    const { zoom = 1, fitWidth } = options || {}
    const token = ++renderToken
    const width = (fitWidth != null ? fitWidth : contentWidth(container)) * zoom
    container.innerHTML = ''
    const dpr = window.devicePixelRatio || 1

    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
      if (token !== renderToken) return
      const base = page.getViewport({ scale: 1 })
      const scale = width / base.width // fit page width to container (page-width zoom)
      const viewport = page.getViewport({ scale })

      // Wadah per halaman: canvas + lapisan teks bertumpuk di dalamnya.
      const pageEl = document.createElement('div')
      pageEl.className = 'pdf-page'
      // Dibaca aturan .textLayer pdf.js untuk menempatkan setiap span; harus sama
      // dengan skala tampilan halaman, kalau tidak teksnya bergeser dari glifnya.
      pageEl.style.setProperty('--scale-factor', String(scale))
      // Hanya saat pemanggil mengoper opsi (lihat catatan `hasOptions` di atas):
      // lebar halaman ditulis eksplisit dalam piksel, bukan diserahkan ke CSS
      // `width: 100%` milik pemanggil. Pemanggil lama TIDAK pernah masuk sini,
      // jadi perilakunya identik dengan sebelum opsi ini ada.
      if (hasOptions) pageEl.style.width = `${Math.floor(viewport.width)}px`

      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-page-canvas'
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      pageEl.appendChild(canvas)
      container.appendChild(pageEl)

      const ctx = canvas.getContext('2d')
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise
      if (token !== renderToken) return

      const textEl = document.createElement('div')
      textEl.className = 'textLayer'
      pageEl.appendChild(textEl)
      await new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textEl,
        viewport,
      }).render()
      if (token !== renderToken) return
    }
  }

  return { renderAll }
}
