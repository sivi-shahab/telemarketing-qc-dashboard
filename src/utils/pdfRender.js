// Shared PDF-to-canvas page renderer (page-width fit, retina-aware). A render
// call is versioned with an internal token so a stale in-flight render (e.g.
// triggered by a resize) is discarded if a newer one starts first.
//
// Tiap halaman dirender DUA lapis: canvas untuk gambarnya, lalu lapisan teks
// pdf.js di atasnya. Lapisan kedua itu yang membuat ctrl+F bekerja — canvas
// hanya piksel, dan find-in-page Chrome cuma menelusuri DOM. Lihat
// `src/assets/pdf-text-layer.css` untuk duduk perkaranya.
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

  async function renderAll(pdfDoc, container) {
    if (!pdfDoc || !container) return
    const token = ++renderToken
    const width = contentWidth(container)
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
