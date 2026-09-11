// ============================================================
// WRAPSTORE INVOICE PDF GENERATOR
// Uses jsPDF + jspdf-autotable
// Generates professional A4 invoices with WrapStore branding
// ============================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Format currency reliably for jsPDF standard fonts
const INR = (val) =>
  'Rs. ' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAYMENT_METHOD_LABELS = {
  Cash: 'Cash',
  UPI: 'UPI / Online Transfer',
  Card: 'Debit / Credit Card',
  Other: 'Other',
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
 * Generate a WrapStore PDF invoice
 * @param {Object} invoice - Invoice record
 * @param {Array}  items   - invoice_items array
 * @param {Object} store   - store_settings record
 * @param {String} logoUrl - URL to WrapStore logo image
 * @returns {jsPDF} - jsPDF document instance
 */
export const generateInvoicePDF = async ({ invoice, items, store, logoUrl }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const W = 210   // page width mm
  const MARGIN = 14
  const CONTENT_W = W - MARGIN * 2 // 182 mm
  let y = MARGIN

  // ---- COLORS ----
  const BLACK = [15, 23, 42]
  const GRAY = [100, 116, 139]
  const WHITE = [255, 255, 255]
  const GREEN = [16, 185, 129]

  // ---- FONTS ----
  doc.setFont('helvetica')

  // ====================================================
  // HEADER: Logo + Store Info
  // ====================================================

  let logoLoaded = false
  if (logoUrl) {
    try {
      const b64 = await urlToBase64(logoUrl)
      if (b64) {
        doc.addImage(b64, 'JPEG', MARGIN, y, 45, 14)
        logoLoaded = true
      }
    } catch { /* skip */ }
  }

  if (!logoLoaded) {
    // Clean dual-box logo: [ WRAP ][ STORE ]
    const boxH = 10
    const boxW = 23

    // Left box: Black filled
    doc.setFillColor(...BLACK)
    doc.rect(MARGIN, y, boxW, boxH, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.text('WRAP', MARGIN + (boxW / 2), y + 6.8, { align: 'center' })

    // Right box: Outlined
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.4)
    doc.rect(MARGIN + boxW, y, boxW, boxH, 'D')
    doc.setTextColor(...BLACK)
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.text('STORE', MARGIN + boxW + (boxW / 2), y + 6.8, { align: 'center' })
  }

  // Store info (right side, clean formatting without duplicate lines)
  doc.setTextColor(...BLACK)
  const storeInfoX = W - MARGIN
  
  const storeName = store?.store_name || 'WRAPSTORE'
  const storeAddress = store?.address || 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701'
  const storePhone = store?.phone ? `Ph: ${store.phone}` : 'Ph: +91 81227 47947'
  const storeGstin = store?.gstin ? `GSTIN: ${store.gstin}` : ''

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(storeName, storeInfoX, y + 3.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  
  // Wrap address into lines
  const addressLines = doc.splitTextToSize(storeAddress, 90)
  let storeY = y + 8
  addressLines.forEach(line => {
    doc.text(line, storeInfoX, storeY, { align: 'right' })
    storeY += 3.8
  })

  doc.text(storePhone, storeInfoX, storeY, { align: 'right' })
  if (storeGstin) {
    storeY += 3.8
    doc.text(storeGstin, storeInfoX, storeY, { align: 'right' })
  }

  y = Math.max(y + 16, storeY + 4)

  // ---- DIVIDER ----
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 5

  // ====================================================
  // INVOICE TITLE + NUMBER BAR
  // ====================================================
  doc.setFillColor(...BLACK)
  doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('TAX INVOICE', MARGIN + 5, y + 6)
  doc.setFontSize(9.5)
  doc.text(invoice.invoice_number || '', W - MARGIN - 5, y + 6, { align: 'right' })
  y += 14

  // ====================================================
  // INVOICE DETAILS + CUSTOMER DETAILS
  // ====================================================
  const invoiceDate = new Date(invoice.created_at || Date.now())
  const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  const leftColX = MARGIN
  const rightColX = MARGIN + CONTENT_W / 2 + 10

  let ly = y
  // Left: Invoice info
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text('INVOICE DETAILS', leftColX, ly)
  ly += 4.5

  const invoiceInfo = [
    ['Invoice No.', invoice.invoice_number],
    ['Date', dateStr],
    ['Time', timeStr],
    ['Payment', PAYMENT_METHOD_LABELS[invoice.payment_method] || invoice.payment_method || 'Cash'],
    ['Status', (invoice.payment_status || 'PAID').toUpperCase()],
  ]

  invoiceInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(label + ':', leftColX, ly)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLACK)
    doc.text(String(value || ''), leftColX + 24, ly)
    ly += 4.5
  })

  // Right: Customer info
  let ry = y
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text('BILLED TO', rightColX, ry)
  ry += 4.5

  const customerInfo = [
    ['Name', invoice.customer_name || 'Walk-in Customer'],
    ['Phone', invoice.customer_phone || '—'],
  ]

  customerInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(label + ':', rightColX, ry)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLACK)
    doc.text(String(value || ''), rightColX + 16, ry)
    ry += 4.5
  })

  y = Math.max(ly, ry) + 3

  // ---- DIVIDER ----
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 5

  // ====================================================
  // ITEMS TABLE
  // Exact column width budget = 182 mm
  // ====================================================
  const tableColumns = [
    { header: '#', dataKey: 'no' },
    { header: 'Product', dataKey: 'name' },
    { header: 'ID', dataKey: 'code' },
    { header: 'Model', dataKey: 'model' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Unit Price', dataKey: 'price' },
    { header: 'Disc%', dataKey: 'disc' },
    { header: 'GST%', dataKey: 'gst' },
    { header: 'Total', dataKey: 'total' },
  ]

  const tableRows = items.map((item, idx) => ({
    no: idx + 1,
    name: item.product_name || 'Product',
    code: item.product_id_code || '—',
    model: item.mobile_model || '—',
    qty: item.quantity,
    price: INR(item.unit_price),
    disc: (item.discount_pct || 0) + '%',
    gst: (item.gst_pct || 0) + '%',
    total: INR(item.line_total),
  }))

  autoTable(doc, {
    startY: y,
    head: [tableColumns.map(c => c.header)],
    body: tableRows.map(row => tableColumns.map(c => row[c.dataKey])),
    theme: 'striped',
    headStyles: {
      fillColor: BLACK,
      textColor: WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      valign: 'middle',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: BLACK,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },   // #
      1: { cellWidth: 46 },                     // Product
      2: { cellWidth: 20 },                     // ID
      3: { cellWidth: 24 },                     // Model
      4: { cellWidth: 12, halign: 'center' },   // Qty
      5: { cellWidth: 22, halign: 'right' },    // Unit Price
      6: { cellWidth: 13, halign: 'center' },   // Disc%
      7: { cellWidth: 13, halign: 'center' },   // GST%
      8: { cellWidth: 24, halign: 'right' },    // Total
    },
    margin: { left: MARGIN, right: MARGIN },
    styles: { overflow: 'linebreak', font: 'helvetica' },
  })

  y = doc.lastAutoTable.finalY + 6

  // ====================================================
  // TOTALS SECTION
  // ====================================================
  const totalsW = 74
  const totalsX = W - MARGIN - totalsW

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(totalsX, y, W - MARGIN, y)
  y += 3.5

  const totalsRows = [
    ['Subtotal', INR(invoice.subtotal)],
    Number(invoice.discount_amount) > 0 ? ['Discount', '- ' + INR(invoice.discount_amount)] : null,
    ['Taxable Amount', INR(invoice.taxable_amount)],
    ['GST', INR(invoice.gst_amount)],
  ].filter(Boolean)

  totalsRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(label, totalsX + 2, y)
    doc.setTextColor(...BLACK)
    doc.text(String(value), W - MARGIN - 2, y, { align: 'right' })
    y += 5
  })

  // Grand total box
  y += 1
  const boxHeight = 8.5
  doc.setFillColor(...BLACK)
  doc.roundedRect(totalsX, y, totalsW, boxHeight, 1.2, 1.2, 'F')
  
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('GRAND TOTAL', totalsX + 4, y + 5.5)
  
  doc.setFontSize(10)
  doc.text(INR(invoice.grand_total), W - MARGIN - 4, y + 5.5, { align: 'right' })
  y += boxHeight + 4

  // Payment method badge
  const badgeMethod = PAYMENT_METHOD_LABELS[invoice.payment_method] || invoice.payment_method || 'Cash'
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.3)
  doc.roundedRect(totalsX, y, totalsW, 6.5, 1, 1, 'FD')
  
  doc.setTextColor(22, 101, 52)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Paid via ' + badgeMethod, totalsX + (totalsW / 2), y + 4.2, { align: 'center' })
  y += 12

  // ====================================================
  // NOTES
  // ====================================================
  if (invoice.notes) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Note: ' + invoice.notes, MARGIN, y)
    y += 6
  }

  // ====================================================
  // FOOTER
  // ====================================================
  const footerY = 282
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, footerY - 5, W - MARGIN, footerY - 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLACK)
  const thankYou = store?.invoice_footer || 'Thank you for shopping at WrapStore!'
  doc.text(thankYou, W / 2, footerY, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('This is a computer-generated invoice and does not require a physical signature.', W / 2, footerY + 4.5, { align: 'center' })
  doc.text(`${storeName} · ${storePhone}`, W / 2, footerY + 8.5, { align: 'center' })

  return doc
}

/**
 * Download the invoice as a PDF file
 */
export const downloadInvoicePDF = async (params) => {
  const doc = await generateInvoicePDF(params)
  doc.save(`${params.invoice.invoice_number}.pdf`)
}

/**
 * Open the invoice PDF in a new browser tab (for printing)
 */
export const printInvoicePDF = async (params) => {
  const doc = await generateInvoicePDF(params)
  const blobUrl = doc.output('bloburl')
  window.open(blobUrl, '_blank')
}

/**
 * Get the PDF as a Blob for uploading to Supabase Storage
 */
export const getInvoicePDFBlob = async (params) => {
  const doc = await generateInvoicePDF(params)
  return doc.output('blob')
}

