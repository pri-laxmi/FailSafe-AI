import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    useCORS: true,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 24

  const usableWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * usableWidth) / canvas.width

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, imgHeight)
  } else {
    const pageCanvas = document.createElement('canvas')
    const ctx = pageCanvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context for PDF export')

    const pxPerPdfUnit = canvas.width / usableWidth
    const pageHeightPx = (pageHeight - margin * 2) * pxPerPdfUnit

    pageCanvas.width = canvas.width
    let renderedHeightPx = 0
    let firstPage = true

    while (renderedHeightPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx)
      pageCanvas.height = sliceHeightPx
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(
        canvas,
        0,
        renderedHeightPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      )

      const sliceData = pageCanvas.toDataURL('image/jpeg', 0.92)
      const sliceHeightPdf = sliceHeightPx / pxPerPdfUnit

      if (!firstPage) pdf.addPage()
      pdf.addImage(sliceData, 'JPEG', margin, margin, usableWidth, sliceHeightPdf)

      renderedHeightPx += sliceHeightPx
      firstPage = false
    }
  }

  pdf.save(filename)
}
