import React, { useEffect, useState } from 'react'
import {
  Search, ChevronLeft, ChevronRight, FileText, Printer,
  Download, Eye, X, ArrowUpDown, RefreshCw, AlertCircle,
  MessageCircle, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { downloadInvoicePDF, printInvoicePDF } from '../lib/invoicePdf'

const INR = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAGE_SIZE = 15

const PAYMENT_LABELS = { Cash: 'Cash', UPI: 'UPI', Card: 'Card', Other: 'Other' }
const PAYMENT_COLORS = {
  Cash: 'badge-success',
  UPI: 'badge-info',
  Card: 'badge-primary',
  Other: 'badge-secondary',
}

// ---- Invoice Detail Modal ----
const InvoiceModal = ({ invoice, onClose, onInvoiceUpdated }) => {
  const [items, setItems] = useState([])
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)
  const [currentInv, setCurrentInv] = useState(invoice)

  useEffect(() => {
    const load = async () => {
      const [{ data: itemsData }, { data: storeData }] = await Promise.all([
        supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('created_at'),
        supabase.from('store_settings').select('*').limit(1).single(),
      ])
      setItems(itemsData || [])
      setStore(storeData)
      setLoading(false)
    }
    load()
  }, [invoice.id])

  const handleDownload = async () => {
    setActioning('download')
    try {
      await downloadInvoicePDF({ invoice: currentInv, items, store, logoUrl: store?.logo_url || null })
      toast.success('PDF downloaded!')
    } catch (e) { toast.error('PDF failed: ' + e.message) }
    setActioning(null)
  }

  const handlePrint = async () => {
    setActioning('print')
    try {
      await printInvoicePDF({ invoice: currentInv, items, store, logoUrl: store?.logo_url || null })
    } catch (e) { toast.error('PDF failed: ' + e.message) }
    setActioning(null)
  }

  const invoiceDate = new Date(currentInv.created_at)
  const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 700, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="modal-title">{currentInv.invoice_number}</span>
              <span className={`badge ${currentInv.payment_status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                {currentInv.payment_status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {dateStr} at {timeStr} · {currentInv.payment_method}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className="modal-body" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="modal-body">
            {/* Customer + Invoice Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: '#f9fafb', borderRadius: 'var(--radius)', padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{currentInv.customer_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{currentInv.customer_phone}</div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 'var(--radius)', padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Payment & Date</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{currentInv.payment_method} · <span style={{ color: 'var(--success)' }}>{currentInv.payment_status}</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{dateStr} {timeStr}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="table-container" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Model</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'center' }}>GST%</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.product_name}</div>
                        <code style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{item.product_id_code}</code>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.mobile_model || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{INR(item.unit_price)}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{item.gst_pct}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 270 }}>
                {[
                  ['Subtotal', INR(currentInv.subtotal)],
                  currentInv.discount_amount > 0 ? ['Discount', '- ' + INR(currentInv.discount_amount)] : null,
                  ['GST', INR(currentInv.gst_amount)],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 15, fontWeight: 800 }}>
                  <span>Grand Total</span>
                  <span>{INR(currentInv.grand_total)}</span>
                </div>
              </div>
            </div>

            {currentInv.notes && (
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Note: {currentInv.notes}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-secondary" onClick={handleDownload} disabled={actioning === 'download' || loading}>
              {actioning === 'download' ? <><div className="btn-spinner" /> Generating...</> : <><Download size={13} /> Download PDF</>}
            </button>
            <button className="btn btn-primary" onClick={handlePrint} disabled={actioning === 'print' || loading}>
              {actioning === 'print' ? <><div className="btn-spinner" /> Generating...</> : <><Printer size={13} /> Print / View PDF</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main Invoices Page ----
const Invoices = () => {
  const [invoices, setInvoices] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [actioning, setActioning] = useState(null)
  const [store, setStore] = useState(null)

  useEffect(() => {
    supabase.from('store_settings').select('*').limit(1).single().then(({ data }) => setStore(data))
  }, [])

  const fetchInvoices = async () => {
    setLoading(true)
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('payment_status', 'PAID')

    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
    }
    if (paymentFilter) query = query.eq('payment_method', paymentFilter)

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query
    setInvoices(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { fetchInvoices() }, [search, paymentFilter, sortField, sortDir, page])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const handleQuickPDF = async (invoice, type) => {
    setActioning(invoice.id + '-' + type)
    try {
      const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id)
      const params = { invoice, items: items || [], store, logoUrl: store?.logo_url || null }
      if (type === 'print') await printInvoicePDF(params)
      else await downloadInvoicePDF(params)
      if (type === 'download') toast.success('PDF downloaded!')
    } catch (e) {
      toast.error('PDF failed: ' + e.message)
    }
    setActioning(null)
  }

  const handleInvoiceUpdated = (updatedInv) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInv.id ? updatedInv : inv))
    setSelectedInvoice(updatedInv)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Invoice History</div>
          <div className="section-subtitle">{total} invoices total</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchInvoices}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search invoice number, customer name or phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            id="invoice-search"
          />
        </div>
        <select className="filter-select" value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1) }}>
          <option value="">All Payments</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Card">Card</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={24} /></div>
            <h3>No invoices found</h3>
            <p>Complete a sale from the Billing page to see invoices here.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('invoice_number')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Invoice # <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Date <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('customer_name')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Customer <ArrowUpDown size={11} /></span>
                    </th>
                    <th>Phone</th>
                    <th onClick={() => handleSort('grand_total')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Total <ArrowUpDown size={11} /></span>
                    </th>
                    <th>Payment</th>
                    <th>Invoice Status</th>
                    <th style={{ width: 130 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                          {inv.invoice_number}
                        </code>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {formatDate(inv.created_at)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.customer_name}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.customer_phone}</td>
                      <td style={{ fontWeight: 800, fontSize: 14 }}>{INR(inv.grand_total)}</td>
                      <td>
                        <span className={`badge ${PAYMENT_COLORS[inv.payment_method] || 'badge-secondary'}`}>
                          {PAYMENT_LABELS[inv.payment_method] || inv.payment_method}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${inv.payment_status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          {inv.payment_status === 'PAID' ? 'Completed' : inv.payment_status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setSelectedInvoice(inv)}
                            title="View invoice details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleQuickPDF(inv, 'print')}
                            disabled={actioning === inv.id + '-print'}
                            title="Print / View PDF"
                          >
                            {actioning === inv.id + '-print' ? <div className="spinner-sm" /> : <Printer size={13} />}
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleQuickPDF(inv, 'download')}
                            disabled={actioning === inv.id + '-download'}
                            title="Download PDF"
                          >
                            {actioning === inv.id + '-download' ? <div className="spinner-sm" /> : <Download size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </div>
                <div className="pagination-buttons">
                  <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = i + Math.max(1, page - 2)
                    if (pg > totalPages) return null
                    return <button key={pg} className={`pagination-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
                  })}
                  <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onInvoiceUpdated={handleInvoiceUpdated}
        />
      )}
    </div>
  )
}

export default Invoices
