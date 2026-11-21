// ============================================================
// WRAPSTORE INVOICE PDF GENERATOR
// Spec: 4 × 4 inch Custom Thermal Continuous Roll (288 × 288 pt)
// Orientation: Landscape | Margins: Top 0.1in, Bottom 0.1in, Left/Right 0.365in
// ============================================================

import _jsPDF from 'jspdf'
import _autoTable from 'jspdf-autotable'
import { getFormattedProductName } from './productUtils.js'
import { INVOICE_LOGO_BASE64 } from '../assets/invoice_logo_base64.js'

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
  // Thermal paper print area: 3.04 inches (218.88 pt) out of 4.00 inches (288 pt)
  // The remaining 0.96 inches (69.12 pt) on the right is left completely empty for paper margins/spacing
  const PAGE_W = 288
  const PAGE_H = 288
  const MARGIN_LEFT = 3.6     // 0.050 inches * 72 pt/in (prevents thermal cut-off on left)
  const RIGHT_X = 218.88      // 3.040 inches * 72 pt/in (exact right boundary of print area)
  const MARGIN_RIGHT = PAGE_W - RIGHT_X // 69.12 pt (0.960 inches empty space on the right)
  const MARGIN_TOP = 7.2      // 0.100 inches * 72 pt/in
  const MARGIN_BOTTOM = 7.2   // 0.100 inches * 72 pt/in
  const CONTENT_W = RIGHT_X - MARGIN_LEFT // 215.28 pt (usable print area width)
  const CONTENT_CENTER_X = MARGIN_LEFT + CONTENT_W / 2 // 111.24 pt (horizontal center of print area)

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
  // 1. HEADER (Left: Brand Logo, Right: Store Address & GSTIN)
  // Target: ~15% of page height
  // ====================================================
  let logoRendered = false
  const activeLogo = logoUrl || INVOICE_LOGO_BASE64

  if (activeLogo) {
    try {
      const b64 = activeLogo.startsWith('data:') ? activeLogo : await urlToBase64(activeLogo)
      if (b64) {
        // Logo dimensions: 50 pt width, 16 pt height (aspect ratio ~3.13)
        doc.addImage(b64, 'PNG', MARGIN_LEFT, y + 1, 50, 16)
        logoRendered = true
      }
    } catch {
      logoRendered = false
    }
  }

  if (!logoRendered) {
    // Vector fallback matching user rectangular logo: [ WRAP ][ STORE ] inside outer rectangular frame
    const outerW = 50
    const outerH = 16
    const innerMargin = 1.0
    const innerW = (outerW - 2 * innerMargin) / 2
    const innerH = outerH - 2 * innerMargin

    // Outer frame
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(0.8)
    doc.rect(MARGIN_LEFT, y + 1, outerW, outerH, 'D')

    // Left block: solid black/navy
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN_LEFT + innerMargin, y + 1 + innerMargin, innerW, innerH, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8.0)
    doc.setFont('helvetica', 'bold')
    doc.text('WRAP', MARGIN_LEFT + innerMargin + innerW / 2, y + 1 + innerMargin + innerH / 2 + 2.8, { align: 'center' })

    // Right block: white background
    doc.setTextColor(...NAVY)
    doc.setFontSize(8.0)
    doc.setFont('helvetica', 'bold')
    doc.text('STORE', MARGIN_LEFT + innerMargin + innerW + innerW / 2, y + 1 + innerMargin + innerH / 2 + 2.8, { align: 'center' })
  }

  // Right-aligned Store Information (Address & Contact only — aligned to RIGHT_X)
  const storeX = RIGHT_X
  const storeName = store?.store_name || 'WRAPSTORE'
  const storeAddress = store?.address || 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701'
  const storePhoneRaw = (store?.phone && store.phone !== '+91 81227 47947') ? store.phone : '+91 63839 40534'
  const storePhone = storePhoneRaw.startsWith('Phone:') ? storePhoneRaw : `Phone: ${storePhoneRaw}`
  const storeGstin = store?.gstin ? `GSTIN: ${store.gstin}` : 'GSTIN: 33ABCDE1234F1Z5'

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.6)
  doc.setTextColor(...NAVY)
  doc.text(storeAddress, storeX, y + 7.5, { align: 'right' })

  const metaLine = [storePhone, storeGstin].filter(Boolean).join(' · ')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.4)
  doc.setTextColor(...GRAY)
  doc.text(metaLine, storeX, y + 15.5, { align: 'right' })

  y += 22

  // Subtle horizontal divider below header
  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, y, RIGHT_X, y)
  y += 4

  // ====================================================
  // 2. TAX INVOICE BANNER
  // Typography: Title 11pt/700, Number 9.5pt/600
  // ====================================================
  const bannerH = 15
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_W, bannerH, 2, 2, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TAX INVOICE', MARGIN_LEFT + 7, y + bannerH / 2 + 3.8)

  doc.setFontSize(9.5)
  doc.text(String(invoice.invoice_number || ''), RIGHT_X - 7, y + bannerH / 2 + 3.5, { align: 'right' })

  y += bannerH + 5

  // ====================================================
  // 3. INVOICE AND CUSTOMER DETAILS (Strict Two-Column Grid: 1fr 1fr)
  // Left Column: Date, Payment method & status
  // Right Column: Billed To, Customer name, Phone
  // ====================================================
  const invoiceDate = new Date(invoice.created_at || Date.now())
  const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const rawMethod = invoice.payment_method || 'Cash'
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[rawMethod] || String(rawMethod).toUpperCase()
  const paymentStatusStr = (invoice.payment_status || 'PAID').toUpperCase()

  const colWidth = (CONTENT_W - 8) / 2
  const col1X = MARGIN_LEFT
  const col2X = MARGIN_LEFT + colWidth + 8

  // Row 1: Date (Left) | Billed To / Name (Right)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Date:', col1X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text(`${dateStr}, ${timeStr}`, col1X + 24, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Billed To:', col2X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text(invoice.customer_name || 'Walk-in Customer', col2X + 38, y + 5, { maxWidth: colWidth - 38 })

  // 10px vertical gap between Date row and Payment row
  y += 15

  // Row 2: Payment Method & Status (Left) | Phone (Right)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Payment:', col1X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text(`${paymentMethodLabel} · ${paymentStatusStr}`, col1X + 38, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Phone:', col2X, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text(invoice.customer_phone || '—', col2X + 30, y + 5)

  y += 10

  // ====================================================
  // 4. PRODUCT TABLE (Controlled Widths: 5%, 48%, 10%, 17%, 20%)
  // Typography: Headers 8pt/700, Content 7.5pt/400
  // ====================================================
  const tableRows = items.map((item, idx) => {
    const rawProd = item.product || { name: item.product_name, color_variants: item.color_variants || item.color }
    const productName = getFormattedProductName(rawProd) || item.product_name || 'Product'

    const metaParts = []
    const modelToDisplay = item.billed_model || item.mobile_model
    if (modelToDisplay) metaParts.push(`Model: ${modelToDisplay}`)
    if (item.discount_pct > 0) metaParts.push(`Disc: ${item.discount_pct}%`)

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

  // Line spacing: add 5px (~4pt) vertical space between lines of wrapped text
  doc.setLineHeightFactor(1.85)

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
      fontSize: 6.0, // Reduced by 20% (from 7.5pt to 6.0pt) for compact, clean product names
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: NAVY,
      valign: 'middle',
      lineColor: BORDER_COLOR,
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 9.00, halign: 'center', fontSize: 6.2 },
      1: { cellWidth: 98.28, fontSize: 6.0 },    // Product & Description (reduced by 20%)
      2: { cellWidth: 16.00, halign: 'center', fontStyle: 'bold', fontSize: 6.5 }, // Qty
      3: { cellWidth: 45.00, halign: 'right', fontSize: 6.2, cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1.5 } }, // Price
      4: { cellWidth: 47.00, halign: 'right', fontStyle: 'bold', fontSize: 6.2, cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1.5 } }, // Total
    },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: 10, bottom: 10 },
    styles: { overflow: 'linebreak', font: 'helvetica' },
  })

  // Restore default line height factor
  doc.setLineHeightFactor(1.15)

  // Spacing between Table and Financial Summary
  y = doc.lastAutoTable.finalY + 10

  // ====================================================
  // 5. FINANCIAL SUMMARY (Two-Column Grid)
  // Typography: Summary labels 7.5pt/400, Summary values 7.5pt/600, Grand total 9.5pt/700
  // ====================================================
  const totalsW = 138
  const totalsX = RIGHT_X - totalsW

  // If totals block exceeds page boundary, paginate cleanly to next continuous 4x4 page
  if (y + 50 > PAGE_H - MARGIN_BOTTOM) {
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
      maxWidth: totalsX - MARGIN_LEFT - 6,
    })
  }

  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.4)
  doc.line(totalsX, y, RIGHT_X, y)
  y += 4

  const totalsRows = [
    ['Subtotal', INR(invoice.subtotal)],
    Number(invoice.discount_amount) > 0 ? ['Discount', '- ' + INR(invoice.discount_amount)] : null,
    ['GST (Included)', INR(invoice.gst_amount)],
  ].filter(Boolean)

  totalsRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(label, totalsX + 2, y + 4.5)
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(String(value), RIGHT_X - 2, y + 4.5, { align: 'right' })
    y += 10
  })

  // GRAND TOTAL Box
  y += 1.5
  const grandTotalH = 15
  doc.setFillColor(...NAVY)
  doc.roundedRect(totalsX, y, totalsW, grandTotalH, 1.5, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.text('GRAND TOTAL', totalsX + 5, y + grandTotalH / 2 + 2.8)
  doc.setFontSize(9.5)
  doc.text(INR(invoice.grand_total), RIGHT_X - 5, y + grandTotalH / 2 + 3.0, { align: 'right' })
  y += grandTotalH + 4.5

  // ====================================================
  // 6. PAYMENT CONFIRMATION (Inline-Flex layout with separate icon & text)
  // Typography: Payment banner 8.5pt 700
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
  doc.setFontSize(8.5)
  const textWidth = doc.getTextWidth(paymentText)

  if (isPaid) {
    // Checkmark icon width (8pt) + gap (5pt) + textWidth
    const iconW = 8
    const iconGap = 5
    const totalInlineWidth = iconW + iconGap + textWidth
    const startInlineX = MARGIN_LEFT + (CONTENT_W - totalInlineWidth) / 2

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
    doc.text(paymentText, CONTENT_CENTER_X, y + badgeH / 2 + 3.0, { align: 'center' })
  }

  y += badgeH + 4.5

  // ====================================================
  // 7. FOOTER (Flows naturally below content)
  // Typography: Footer 7pt 400
  // ====================================================
  if (y + 16 > PAGE_H - MARGIN_BOTTOM) {
    doc.addPage([288, 288], 'landscape')
    y = MARGIN_TOP + 10
  }

  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.4)
  doc.line(MARGIN_LEFT, y, RIGHT_X, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...NAVY)
  const thankYou = store?.invoice_footer || 'Thank you for shopping at WrapStore!'
  doc.text(thankYou, CONTENT_CENTER_X, y + 4, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...GRAY)
  // Clean gap between "Thank you" and "Computer-generated invoice"
  doc.text(`Computer-generated invoice · No signature required · ${storeName}`, CONTENT_CENTER_X, y + 13, { align: 'center' })

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
