import React, { useEffect, useState } from 'react'
import {
  Search, Users, ChevronLeft, ChevronRight, ArrowUpDown,
  Eye, X, FileText, RefreshCw, Printer, Download, Globe, ShoppingBag
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { downloadInvoicePDF, printInvoicePDF } from '../lib/invoicePdf'

const INR = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PAGE_SIZE = 15

// ---- Customer Detail Modal ----
const CustomerModal = ({ customer, onClose }) => {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState(null)
  const [actioning, setActioning] = useState(null)

  useEffect(() => {
    const load = async () => {
      const cleanPhone = (customer.phone || '').replace(/\D/g, '')

      const [{ data: invData }, { data: onlData }, { data: storeData }] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('online_orders')
          .select('*')
          .or(`customer_id.eq.${customer.id},customer_phone.ilike.%${cleanPhone}%`)
          .not('order_status', 'eq', 'CANCELLED')
          .order('created_at', { ascending: false }),
        supabase.from('store_settings').select('*').limit(1).single(),
      ])

      const list = []
      ;(invData || []).forEach(inv => {
        list.push({
          id: inv.id,
          reference: inv.invoice_number,
          date: inv.created_at,
          total: Number(inv.grand_total || 0),
          method: inv.payment_method || 'Cash',
          channel: 'POS',
          isInvoice: true,
          status: inv.payment_status || 'PAID',
          raw: inv,
        })
      })

      ;(onlData || []).forEach(ord => {
        list.push({
          id: ord.id,
          reference: ord.order_number,
          date: ord.created_at,
          total: Number(ord.grand_total || 0),
          method: ord.payment_method || 'Online',
          channel: 'Website',
          isInvoice: false,
          status: ord.order_status || 'CONFIRMED',
          raw: ord,
        })
      })

      list.sort((a, b) => new Date(b.date) - new Date(a.date))
      setTransactions(list)
      setStore(storeData)
      setLoading(false)
    }
    load()
  }, [customer.id, customer.phone])

  const handlePDF = async (invoice, type) => {
    setActioning(invoice.id + '-' + type)
    try {
      const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id)
      const params = { invoice, items: items || [], store, logoUrl: store?.logo_url || null }
      if (type === 'print') await printInvoicePDF(params)
      else { await downloadInvoicePDF(params); toast.success('PDF downloaded!') }
    } catch (e) {
      toast.error('PDF failed: ' + e.message)
    }
    setActioning(null)
  }

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const actualCount = transactions.length
  const actualSpent = transactions.reduce((sum, t) => sum + t.total, 0)
  const actualLast = transactions[0]?.date || null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 680, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-title">{customer.name}</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {customer.phone} · Customer since {formatDate(customer.created_at)}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {/* Stats computed from actual invoices + online orders */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              ['Total Orders', actualCount],
              ['Total Spent', INR(actualSpent)],
              ['Last Purchase', actualLast ? formatDate(actualLast) : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Purchase History */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            Unified Purchase History (POS + Website)
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
          ) : transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p style={{ margin: 0, fontSize: 13 }}>No purchases recorded for this customer.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Ref / Number</th>
                    <th>Channel</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th style={{ width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>
                        <code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
                          {t.reference}
                        </code>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                          background: t.channel === 'POS' ? '#f3f4f6' : '#eff6ff',
                          color: t.channel === 'POS' ? '#374151' : '#1d4ed8',
                          border: t.channel === 'POS' ? '1px solid #e5e7eb' : '1px solid #bfdbfe'
                        }}>
                          {t.channel === 'POS' ? <ShoppingBag size={10} /> : <Globe size={10} />}
                          {t.channel}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{formatDate(t.date)}</td>
                      <td style={{ fontWeight: 700 }}>{INR(t.total)}</td>
                      <td>
                        <span className={`badge ${t.method === 'Cash' ? 'badge-success' : t.method === 'UPI' ? 'badge-info' : 'badge-primary'}`}>
                          {t.method}
                        </span>
                      </td>
                      <td>
                        {t.isInvoice ? (
                          <div className="table-actions">
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handlePDF(t.raw, 'print')}
                              disabled={actioning === t.id + '-print'}
                              title="Print Invoice"
                            >
                              {actioning === t.id + '-print' ? <div className="spinner-sm" /> : <Printer size={12} />}
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handlePDF(t.raw, 'download')}
                              disabled={actioning === t.id + '-download'}
                              title="Download PDF"
                            >
                              {actioning === t.id + '-download' ? <div className="spinner-sm" /> : <Download size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                            {t.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Customers Page ----
const Customers = () => {
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('total_spent')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const fetchCustomers = async () => {
    setLoading(true)
    let query = supabase
      .from('customers')
      .select('*, invoices(id, grand_total, created_at, customer_phone), online_orders(id, grand_total, created_at, customer_phone, order_status, payment_status)', { count: 'exact' })

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query
    const rawList = data || []

    // Reconcile and calculate exact metrics from BOTH invoices AND online orders
    const reconciled = rawList.map(c => {
      const invs = c.invoices || []
      const onls = (c.online_orders || []).filter(o => o.payment_status === 'PAID' && o.order_status !== 'CANCELLED')

      const trueOrders = invs.length + onls.length
      const trueSpent = invs.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0) +
                        onls.reduce((sum, ord) => sum + Number(ord.grand_total || 0), 0)

      const allDates = [...invs.map(i => i.created_at), ...onls.map(o => o.created_at)].filter(Boolean).sort().reverse()
      const trueLast = allDates[0] || c.last_purchase_at

      // Self-heal DB record if stored stats differ from actual combined sum
      if (c.total_orders !== trueOrders || Number(c.total_spent) !== trueSpent) {
        supabase.from('customers').update({
          total_orders: trueOrders,
          total_spent: trueSpent,
          last_purchase_at: trueLast,
        }).eq('id', c.id).then(() => {})
      }

      return {
        ...c,
        total_orders: trueOrders,
        total_spent: trueSpent,
        last_purchase_at: trueLast,
      }
    })

    setCustomers(reconciled)
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [search, sortField, sortDir, page])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Customers</div>
          <div className="section-subtitle">{total} customers total (POS & Website combined)</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchCustomers}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: total, icon: Users },
          {
            label: 'Total Revenue',
            value: INR(customers.reduce((s, c) => s + Number(c.total_spent || 0), 0)),
            icon: FileText,
          },
          {
            label: 'Avg. Spend / Customer',
            value: total > 0
              ? INR(customers.reduce((s, c) => s + Number(c.total_spent || 0), 0) / customers.length)
              : '₹0.00',
            icon: Users,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: '#f3f4f6' }}>
              <Icon size={20} color="var(--brand-black)" />
            </div>
            <div className="stat-content">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            id="customer-search-input"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={24} /></div>
            <h3>No customers found</h3>
            <p>Customers will be automatically created when they place an order online or at POS.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Customer <ArrowUpDown size={11} /></span>
                    </th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th onClick={() => handleSort('total_orders')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Orders <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('total_spent')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Total Spent <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('last_purchase_at')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Last Purchase <ArrowUpDown size={11} /></span>
                    </th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.phone}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {c.email || '—'}
                      </td>
                      <td>
                        <span className="badge badge-primary">{c.total_orders}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-black)' }}>
                        {INR(c.total_spent)}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {formatDate(c.last_purchase_at)}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setSelectedCustomer(c)}
                          title="View customer purchase history"
                          id={`view-customer-${c.id}`}
                        >
                          <Eye size={13} />
                        </button>
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
                <div className="pagination-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft size={13} /> Previous
                  </button>
                  <span style={{ fontSize: 13, padding: '0 8px' }}>Page {page} of {totalPages}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Modal */}
      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}

export default Customers
