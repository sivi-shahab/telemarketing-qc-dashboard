// Shared PDF-to-canvas page renderer (page-width fit, retina-aware). A render
// call is versioned with an internal token so a stale in-flight render (e.g.
// triggered by a resize) is discarded if a newer one starts first.
export function createPdfPageRenderer() {
  let renderToken = 0

  async function renderAll(pdfDoc, container) {
    if (!pdfDoc || !container) return
    const token = ++renderToken
    const width = container.clientWidth || 800
    container.innerHTML = ''
    const dpr = window.devicePixelRatio || 1

    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
      if (token !== renderToken) return
      const base = page.getViewport({ scale: 1 })
      const scale = width / base.width // fit page width to container (page-width zoom)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-page'
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      container.appendChild(canvas)

      const ctx = canvas.getContext('2d')
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise
      if (token !== renderToken) return
    }
  }

  return { renderAll }
}
