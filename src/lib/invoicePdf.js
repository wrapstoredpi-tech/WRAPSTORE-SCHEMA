// ============================================================
// WRAPSTORE INVOICE PDF GENERATOR
// Spec: 4 × 4 inch Custom Thermal Continuous Roll (288 × 288 pt)
// Orientation: Landscape | Margins: Top 0.1in, Bottom 0.1in, Left/Right 0.365in
// ============================================================

import _jsPDF from 'jspdf'
import _autoTable from 'jspdf-autotable'
import { getFormattedProductName } from './productUtils.js'

const jsPDF = _jsPDF?.jsPDF || _jsPDF
const autoTable = _autoTable?.default || _autoTable

// Format currency reliably for jsPDF standard fonts with non-breaking space
const INR = (val) =>
  'Rs.\u00A0' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAYMENT_METHOD_LABELS = {
  Cash: 'CASH',
  UPI: 'UPI',
  Card: 'DEBIT / CREDIT CARD',
  Other: 'OTHER',
}

// Convert an image URL to base64 for embedding in PDF
const urlToBase64 = async (url) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Generate a WrapStore 4 × 4 inch (288 × 288 pt) thermal PDF invoice
 * Strict adherence to the typography and layout specifications.
 *
 * @param {Object} invoice   - Invoice record
 * @param {Array}  items     - invoice_items array
 * @param {Object} store     - store_settings record
 * @param {String} logoUrl   - URL to WrapStore logo image
 * @param {Boolean} autoPrint - Whether to attach open-action print trigger
 * @returns {jsPDF} - jsPDF document instance
 */
export const generateInvoicePDF = async ({ invoice = {}, items = [], store = {}, logoUrl, autoPrint = false }) => {
  // Page setup: Custom 4 × 4 inches = 288 × 288 pt in landscape orientation
  const doc = new jsPDF({
    unit: 'pt',
    format: [288, 288],
    orientation: 'landscape',
  })

  // Dimensions & Margins
  const PAGE_W = 288
  const PAGE_H = 288
  const MARGIN_LEFT = 26.28   // 0.365 inches * 72 pt/in
  const MARGIN_RIGHT = 26.28  // 0.365 inches * 72 pt/in
  const MARGIN_TOP = 7.2      // 0.100 inches * 72 pt/in
  const MARGIN_BOTTOM = 7.2   // 0.100 inches * 72 pt/in
  const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT // 235.44 pt

  // Color palette matching WrapStore brand
  const NAVY = [15, 23, 42]        // #0F172A
  const GRAY = [100, 116, 139]     // #64748B
  const BORDER_COLOR = [226, 232, 240] // #E2E8F0
  const WHITE = [255, 255, 255]
  const GREEN_TEXT = [22, 101, 52] // #166534
  const GREEN_BG = [240, 253, 244] // #F0FDF4
  const GREEN_BORDER = [187, 247, 208] // #BBF7D0
  const AMBER_TEXT = [180, 83, 9]  // #B45309
  const AMBER_BG = [254, 243, 199] // #FEF3C7
  const AMBER_BORDER = [253, 230, 138] // #FDE68A

  let y = MARGIN_TOP + 1 // ~8.2 pt

  // ====================================================
  // 1. HEADER (Typography: Store name 10pt/700, Tagline 6pt/400)
  // Target: ~15% of page height
  // ====================================================
  let logoRendered = false
  if (logoUrl) {
    try {
      const b64 = await urlToBase64(logoUrl)
      if (b64) {
        doc.addImage(b64, 'JPEG', MARGIN_LEFT, y + 1, 46, 17)
        logoRendered = true
      }
    } catch {
      logoRendered = false
    }
  }

  if (!logoRendered) {
    // Dual-box WrapStore branding: [ WRAP ][ STORE ]
    const boxH = 12
    const boxW1 = 25
    const boxW2 = 30

    // Left box: Navy filled
    doc.setFillColor(...NAVY)
    doc.roundedRect(MARGIN_LEFT, y + 1, boxW1, boxH, 1.2, 1.2, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text('WRAP', MARGIN_LEFT + boxW1 / 2, y + 1 + boxH / 2 + 3, { align: 'center' })

    // Right box: Navy outlined
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(0.8)
    doc.roundedRect(MARGIN_LEFT + boxW1, y + 1, boxW2, boxH, 1.2, 1.2, 'D')
    doc.setTextColor(...NAVY)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text('STORE', MARGIN_LEFT + boxW1 + boxW2 / 2, y + 1 + boxH / 2 + 3, { align: 'center' })

    // Tagline below logo
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text('PREMIUM CASES & SKINS', MARGIN_LEFT, y + 21)
  }

  // Right-aligned Store Information
  const storeX = PAGE_W - MARGIN_RIGHT
  const storeName = store?.store_name || 'WRAPSTORE'
  const storeAddress = store?.address || 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701'
  const storePhone = store?.phone ? `Phone: ${store.phone}` : 'Phone: +91 81227 47947'
  const storeGstin = store?.gstin ? `GSTIN: ${store.gstin}` : 'GSTIN: 33ABCDE1234F1Z5'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10) // Frozen spec: Store name 10pt 700
  doc.setTextColor(...NAVY)
  doc.text(storeName, storeX, y + 7.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...GRAY)
  doc.text(storeAddress, storeX, y + 15, { align: 'right' })
  const metaLine = [storePhone, storeGstin].filter(Boolean).join(' · ')
  doc.setFontSize(5.5)
  doc.text(metaLine, storeX, y + 21.5, { align: 'right' })

  y += 26

  // Subtle horizontal divider below header
  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, y, PAGE_W - MARGIN_RIGHT, y)
  y += 4

  // ====================================================
  // 2. TAX INVOICE BANNER
  // Typography: Title 12pt/700, Number 10pt/600
  // Target: ~9% of page height
  // ====================================================
  const bannerH = 16
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_W, bannerH, 2, 2, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12) // Frozen spec: Invoice title 12pt 700
  doc.text('TAX INVOICE', MARGIN_LEFT + 8, y + bannerH / 2 + 4)

  doc.setFontSize(10) // Frozen spec: Invoice number 10pt 600
  doc.text(String(invoice.invoice_number || ''), PAGE_W - MARGIN_RIGHT - 8, y + bannerH / 2 + 3.5, { align: 'right' })

  y += bannerH + 6

  // ====================================================
  // 3. INVOICE AND CUSTOMER DETAILS (Strict Two-Column Grid: 1fr 1fr)
  // Left Column: Date, Payment method & status
  // Right Column: Billed To, Customer name, Phone
  // Typography: Labels 8pt/400, Values 8pt/600
  // ====================================================
  const invoiceDate = new Date(invoice.created_at || Date.now())
  const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const rawMethod = invoice.payment_method || 'Cash'
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[rawMethod] || String(rawMethod).toUpperCase()
  const paymentStatusStr = (invoice.payment_status || 'PAID').toUpperCase()

  const colWidth = (CONTENT_W - 12) / 2 // 111.72 pt per column
  const col1X = MARGIN_LEFT
  const col2X = MARGIN_LEFT + colWidth + 12 // 150 pt

  // Row 1: Date (Left) | Billed To / Name (Right)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8) // Frozen spec: Details labels 8pt 400
  doc.setTextColor(...GRAY)
  doc.text('Date:', col1X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8) // Frozen spec: Details values 8pt 600
  doc.setTextColor(...NAVY)
  doc.text(`${dateStr}, ${timeStr}`, col1X + 26, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Billed To:', col2X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text(invoice.customer_name || 'Walk-in Customer', col2X + 40, y + 5, { maxWidth: colWidth - 40 })

  y += 10.5

  // Row 2: Payment Method & Status (Left) | Phone (Right)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Payment:', col1X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text(`${paymentMethodLabel} · ${paymentStatusStr}`, col1X + 40, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Phone:', col2X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text(invoice.customer_phone || '—', col2X + 32, y + 5)

  y += 12

  // ====================================================
  // 4. PRODUCT TABLE (Controlled Widths: 5%, 48%, 10%, 17%, 20%)
  // Typography: Headers 8pt/700, Content 7.5pt/400
  // ====================================================
  const tableRows = items.map((item, idx) => {
    const rawProd = item.product || { name: item.product_name, color_variants: item.color_variants || item.color }
    const productName = getFormattedProductName(rawProd) || item.product_name || 'Product'

    const metaParts = []
    if (item.mobile_model) metaParts.push(`Model: ${item.mobile_model}`)
    if (item.product_id_code) metaParts.push(`ID: ${item.product_id_code}`)
    if (item.discount_pct > 0) metaParts.push(`Disc: ${item.discount_pct}%`)
    if (item.gst_pct > 0) metaParts.push(`GST: ${item.gst_pct}%`)

    const lines = [productName]
    if (metaParts.length > 0) lines.push(metaParts.join(' · '))

    // Format combo items if present
    if (item.combo_items && Array.isArray(item.combo_items) && item.combo_items.length > 0) {
      lines.push('Includes: ' + item.combo_items.join(', '))
    }

    return [
      idx + 1,
      lines.join('\n'),
      item.quantity,
      INR(item.unit_price),
      INR(item.line_total),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product & Description', 'Qty', 'Price', 'Total']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontSize: 8, // Frozen spec: Table header 8pt 700
      fontStyle: 'bold',
      cellPadding: { top: 2.8, bottom: 2.8, left: 1.5, right: 1.5 },
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.5, // Frozen spec: Table content 7.5pt 400
      cellPadding: { top: 2.8, bottom: 2.8, left: 2, right: 2 },
      textColor: NAVY,
      valign: 'middle',
      lineColor: BORDER_COLOR,
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 11.77, halign: 'center' },  // 5%
      1: { cellWidth: 113.01 },                    // 48%
      2: { cellWidth: 23.54, halign: 'center', fontStyle: 'bold' }, // 10%
      3: { cellWidth: 40.02, halign: 'right', cellPadding: { top: 2.8, bottom: 2.8, left: 1, right: 1.5 } }, // 17%
      4: { cellWidth: 47.09, halign: 'right', fontStyle: 'bold', cellPadding: { top: 2.8, bottom: 2.8, left: 1, right: 1.5 } }, // 20%
    },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: 10, bottom: 10 },
    styles: { overflow: 'linebreak', font: 'helvetica' },
  })

  y = doc.lastAutoTable.finalY + 4

  // ====================================================
  // 5. FINANCIAL SUMMARY (Two-Column Grid)
  // Typography: Summary labels 8pt/400, Summary values 8pt/600, Grand total 11pt/700
  // ====================================================
  const totalsW = 142
  const totalsX = PAGE_W - MARGIN_RIGHT - totalsW

  // If totals block exceeds page boundary, paginate cleanly to next continuous 4x4 page
  if (y + 54 > PAGE_H - MARGIN_BOTTOM) {
    doc.addPage([288, 288], 'landscape')
    y = MARGIN_TOP + 8
  }

  // Customer notes on left
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text('Notes / Instructions:', MARGIN_LEFT, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.text(String(invoice.notes).slice(0, 100), MARGIN_LEFT, y + 10, {
      maxWidth: totalsX - MARGIN_LEFT - 8,
    })
  }

  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.4)
  doc.line(totalsX, y, PAGE_W - MARGIN_RIGHT, y)
  y += 3

  const totalsRows = [
    ['Subtotal', INR(invoice.subtotal)],
    Number(invoice.discount_amount) > 0 ? ['Discount', '- ' + INR(invoice.discount_amount)] : null,
    ['GST (Included)', INR(invoice.gst_amount)],
  ].filter(Boolean)

  totalsRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8) // Frozen spec: Summary labels 8pt 400
    doc.setTextColor(...GRAY)
    doc.text(label, totalsX + 2, y + 4.5)
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8) // Frozen spec: Summary values 8pt 600
    doc.text(String(value), PAGE_W - MARGIN_RIGHT - 2, y + 4.5, { align: 'right' })
    y += 6.5
  })

  // GRAND TOTAL Box
  y += 1.5
  const grandTotalH = 15
  doc.setFillColor(...NAVY)
  doc.roundedRect(totalsX, y, totalsW, grandTotalH, 1.5, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('GRAND TOTAL', totalsX + 6, y + grandTotalH / 2 + 2.8)
  doc.setFontSize(11) // Frozen spec: Grand total 11pt 700
  doc.text(INR(invoice.grand_total), PAGE_W - MARGIN_RIGHT - 6, y + grandTotalH / 2 + 3.2, { align: 'right' })
  y += grandTotalH + 4.5

  // ====================================================
  // 6. PAYMENT CONFIRMATION (Inline-Flex layout with separate icon & text)
  // Typography: Payment banner 9pt 700
  // ====================================================
  const isPaid = paymentStatusStr === 'PAID' || paymentStatusStr === 'COMPLETED'
  const bgCol = isPaid ? GREEN_BG : AMBER_BG
  const borderCol = isPaid ? GREEN_BORDER : AMBER_BORDER
  const textCol = isPaid ? GREEN_TEXT : AMBER_TEXT

  const badgeH = 13.5
  doc.setFillColor(...bgCol)
  doc.setDrawColor(...borderCol)
  doc.setLineWidth(0.6)
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_W, badgeH, 1.5, 1.5, 'FD')

  const paymentText = isPaid
    ? `PAID VIA ${paymentMethodLabel}`
    : `${paymentStatusStr} · ${paymentMethodLabel}`

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9) // Frozen spec: Payment banner 9pt 700
  const textWidth = doc.getTextWidth(paymentText)

  if (isPaid) {
    // Checkmark icon width (8pt) + gap (5pt) + textWidth
    const iconW = 8
    const iconGap = 5
    const totalInlineWidth = iconW + iconGap + textWidth
    const startInlineX = (PAGE_W - totalInlineWidth) / 2

    // Draw checkmark icon in its own container area
    const checkCenterX = startInlineX + 3.5
    const checkCenterY = y + badgeH / 2
    doc.setDrawColor(...GREEN_TEXT)
    doc.setLineWidth(1.1)
    doc.line(checkCenterX - 2.5, checkCenterY, checkCenterX - 0.5, checkCenterY + 2.5)
    doc.line(checkCenterX - 0.5, checkCenterY + 2.5, checkCenterX + 4, checkCenterY - 2.5)

    // Draw text cleanly beside the icon without any overlap
    doc.setTextColor(...GREEN_TEXT)
    doc.text(paymentText, startInlineX + iconW + iconGap, y + badgeH / 2 + 3.0)
  } else {
    doc.setTextColor(...textCol)
    doc.text(paymentText, PAGE_W / 2, y + badgeH / 2 + 3.0, { align: 'center' })
  }

  y += badgeH + 5

  // ====================================================
  // 7. FOOTER (Flows naturally below content)
  // Typography: Footer 7pt 400
  // ====================================================
  if (y + 18 > PAGE_H - MARGIN_BOTTOM) {
    doc.addPage([288, 288], 'landscape')
    y = MARGIN_TOP + 10
  }

  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.4)
  doc.line(MARGIN_LEFT, y, PAGE_W - MARGIN_RIGHT, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7) // Frozen spec: Footer 7pt
  doc.setTextColor(...NAVY)
  const thankYou = store?.invoice_footer || 'Thank you for shopping at WrapStore!'
  doc.text(thankYou, PAGE_W / 2, y + 4, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...GRAY)
  doc.text(`Computer-generated invoice · No signature required · ${storeName}`, PAGE_W / 2, y + 10.5, { align: 'center' })

  // Trigger print dialog if autoPrint requested
  if (autoPrint && typeof doc.autoPrint === 'function') {
    doc.autoPrint()
  }

  return doc
}

/**
 * Download the invoice as a PDF file with exact 4 × 4 in dimensions
 */
export const downloadInvoicePDF = async (params) => {
  const doc = await generateInvoicePDF({ ...params, autoPrint: false })
  doc.save(`${params?.invoice?.invoice_number || 'invoice'}.pdf`)
}

/**
 * Open the 4 × 4 inch invoice PDF in browser print preview
 */
export const printInvoicePDF = async (params) => {
  const doc = await generateInvoicePDF({ ...params, autoPrint: true })
  const blob = doc.output('blob')
  const blobUrl = URL.createObjectURL(blob)

  // Open PDF directly in a new tab with autoPrint trigger
  const printWindow = window.open(blobUrl, '_blank')
  if (!printWindow) {
    // Fallback: If popup is blocked, print via hidden iframe
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = blobUrl
    document.body.appendChild(iframe)
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (e) {
        console.warn('Iframe print fallback note:', e)
      }
    }
  }
}

/**
 * Get the PDF as a Blob for uploading to Supabase Storage
 */
export const getInvoicePDFBlob = async (params) => {
  const doc = await generateInvoicePDF({ ...params, autoPrint: false })
  return doc.output('blob')
}
