// ============================================================
// WRAPSTORE REPORTS CENTER
// Comprehensive Inventory, Sales, and Customer reports with CSV export & Print
// ============================================================

import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText, Warehouse, TrendingUp, Users, Download,
  Printer, Calendar, Search, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, ArrowUpRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const Reports = () => {
  const [activeTab, setActiveTab] = useState('inventory') // 'inventory', 'sales', 'customers'
  const [loading, setLoading] = useState(true)

  // Data states
  const [products, setProducts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [invoiceItems, setInvoiceItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [salesPeriod, setSalesPeriod] = useState('all') // 'today', 'month', 'all'

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { data: prodData },
        { data: invData },
        { data: itemData },
        { data: custData },
      ] = await Promise.all([
        supabase.from('products').select('*').eq('approval_status', 'APPROVED').eq('is_active', true).order('name'),
        supabase.from('invoices').select('*').eq('payment_status', 'PAID').order('created_at', { ascending: false }),
        supabase.from('invoice_items').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('total_spent', { ascending: false }),
      ])

      setProducts(prodData || [])
      setInvoices(invData || [])
      setInvoiceItems(itemData || [])
      setCustomers(custData || [])
    } catch (err) {
      console.error('Error fetching reports data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ====================================================
  // CSV EXPORT HELPER
  // ====================================================
  const exportCSV = (filename, headers, rows) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ====================================================
  // 1. INVENTORY REPORT CALCULATIONS
  // ====================================================
  const inventorySummary = useMemo(() => {
    const totalSKUs = products.length
    const totalStock = products.reduce((s, p) => s + Number(p.current_stock || 0), 0)
    const totalValue = products.reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.selling_price || 0), 0)
    const lowStock = products.filter(p => p.current_stock > 0 && p.current_stock <= (p.min_stock_level || 5)).length
    const outOfStock = products.filter(p => p.current_stock === 0).length

    return { totalSKUs, totalStock, totalValue, lowStock, outOfStock }
  }, [products])

  const handleExportInventoryCSV = () => {
    const headers = ['Product ID', 'Product Name', 'Type', 'Model', 'Current Stock', 'Min Stock', 'Unit Price (₹)', 'Inventory Value (₹)', 'Status']
    const rows = products.map(p => {
      const stock = Number(p.current_stock || 0)
      const min = Number(p.min_stock_level || 5)
      const status = stock === 0 ? 'Out of Stock' : (stock <= min ? 'Low Stock' : 'In Stock')
      return [
        p.product_id,
        p.name,
        p.product_type,
        p.mobile_model || '—',
        stock,
        min,
        p.selling_price,
        stock * p.selling_price,
        status,
      ]
    })
    exportCSV('wrapstore-inventory-report', headers, rows)
  }

  // ====================================================
  // 2. SALES REPORT CALCULATIONS
  // ====================================================
  const filteredInvoices = useMemo(() => {
    if (salesPeriod === 'today') {
      const today = new Date().toISOString().slice(0, 10)
      return invoices.filter(i => i.created_at?.startsWith(today))
    }
    if (salesPeriod === 'month') {
      const currentMonth = new Date().toISOString().slice(0, 7)
      return invoices.filter(i => i.created_at?.startsWith(currentMonth))
    }
    return invoices
  }, [invoices, salesPeriod])

  const salesSummary = useMemo(() => {
    const totalSales = filteredInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0)
    const totalTaxable = filteredInvoices.reduce((s, i) => s + Number(i.taxable_amount || 0), 0)
    const totalGst = filteredInvoices.reduce((s, i) => s + Number(i.gst_amount || 0), 0)
    const totalDiscount = filteredInvoices.reduce((s, i) => s + Number(i.discount_amount || 0), 0)
    const count = filteredInvoices.length

    return { totalSales, totalTaxable, totalGst, totalDiscount, count }
  }, [filteredInvoices])

  // Channel breakdown — uses invoices.channel (migration_channel_tracking.sql)
  // Falls back to 'offline' if the column doesn't exist yet
  const CHANNEL_META = {
    offline:   { label: 'Offline (POS)', color: '#111827', bg: '#f3f4f6' },
    website:   { label: 'Website',       color: '#2563eb', bg: '#eff6ff' },
    amazon:    { label: 'Amazon',         color: '#f59e0b', bg: '#fffbeb' },
    flipkart:  { label: 'Flipkart',       color: '#3b82f6', bg: '#eff6ff' },
    instagram: { label: 'Instagram',      color: '#ec4899', bg: '#fdf2f8' },
    whatsapp:  { label: 'WhatsApp',       color: '#16a34a', bg: '#dcfce7' },
    other:     { label: 'Other',          color: '#6b7280', bg: '#f9fafb' },
  }
  const channelBreakdown = useMemo(() => {
    const map = {}
    filteredInvoices.forEach(inv => {
      const ch = inv.channel || 'offline'
      if (!map[ch]) map[ch] = { channel: ch, revenue: 0, count: 0, ...(CHANNEL_META[ch] || {}) }
      map[ch].revenue += Number(inv.grand_total || 0)
      map[ch].count += 1
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [filteredInvoices])

  const handleExportSalesCSV = () => {
    const headers = ['Invoice #', 'Date', 'Channel', 'Customer Name', 'Customer Phone', 'Payment Method', 'Subtotal (₹)', 'Discount (₹)', 'GST (₹)', 'Grand Total (₹)', 'WhatsApp Status']
    const rows = filteredInvoices.map(i => [
      i.invoice_number,
      i.created_at ? new Date(i.created_at).toLocaleDateString('en-IN') : '',
      i.channel || 'offline',
      i.customer_name,
      i.customer_phone,
      i.payment_method,
      i.subtotal,
      i.discount_amount,
      i.gst_amount,
      i.grand_total,
      i.whatsapp_status || 'N/A',
    ])
    exportCSV('wrapstore-sales-report', headers, rows)
  }

  // ====================================================
  // 3. CUSTOMER REPORT CALCULATIONS
  // ====================================================
  const customerSummary = useMemo(() => {
    const totalCustomers = customers.length
    const repeatCustomers = customers.filter(c => Number(c.total_orders || 0) > 1).length
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0
    const totalCustomerSpend = customers.reduce((s, c) => s + Number(c.total_spent || 0), 0)
    const avgSpend = totalCustomers > 0 ? totalCustomerSpend / totalCustomers : 0

    return { totalCustomers, repeatCustomers, repeatRate, totalCustomerSpend, avgSpend }
  }, [customers])

  const handleExportCustomerCSV = () => {
    const headers = ['Customer Name', 'Phone', 'Total Orders', 'Total Spent (₹)', 'Customer Since', 'Last Purchase']
    const rows = customers.map(c => [
      c.name,
      c.phone,
      c.total_orders,
      c.total_spent,
      c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
      c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('en-IN') : '—',
    ])
    exportCSV('wrapstore-customer-report', headers, rows)
  }

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Reports Center</div>
          <div className="section-subtitle">Official store accounting, inventory valuation, and customer analytics</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={13} /> Print Report
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[
          { id: 'inventory', label: 'Inventory Report', icon: Warehouse },
          { id: 'sales', label: 'Sales Report', icon: TrendingUp },
          { id: 'customers', label: 'Customer Report', icon: Users },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 'var(--radius)' }}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} /> {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Generating report telemetry...</div>
      ) : (
        <>
          {/* ==================================================== */}
          {/* 1. INVENTORY REPORT TAB                               */}
          {/* ==================================================== */}
          {activeTab === 'inventory' && (
            <div>
              {/* Inventory KPIs */}
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#eff6ff' }}>
                    <Warehouse size={20} color="#3b82f6" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Total Stock Units</div>
                    <div className="stat-value">{inventorySummary.totalStock.toLocaleString()}</div>
                    <div className="stat-sub">{inventorySummary.totalSKUs} active product models</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                    <TrendingUp size={20} color="#10b981" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Inventory Valuation</div>
                    <div className="stat-value">{INR(inventorySummary.totalValue)}</div>
                    <div className="stat-sub">Retail stock valuation</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#fffbeb' }}>
                    <AlertTriangle size={20} color="#f59e0b" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Low Stock SKUs</div>
                    <div className="stat-value">{inventorySummary.lowStock}</div>
                    <div className="stat-sub">&le; threshold units</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#fef2f2' }}>
                    <XCircle size={20} color="#ef4444" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Out of Stock</div>
                    <div className="stat-value">{inventorySummary.outOfStock}</div>
                    <div className="stat-sub">0 units in store</div>
                  </div>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="card" style={{ padding: 0 }}>
                <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="card-title">Stock Valuation Table</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{products.length} products</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportInventoryCSV}>
                    <Download size={13} /> Export CSV
                  </button>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Name</th>
                        <th>Compatible Model</th>
                        <th style={{ textAlign: 'center' }}>Stock</th>
                        <th style={{ textAlign: 'center' }}>Min Stock</th>
                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Stock Value</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => {
                        const stock = Number(p.current_stock || 0)
                        const min = Number(p.min_stock_level || 5)
                        const isZero = stock === 0
                        const isLow = stock <= min && !isZero

                        return (
                          <tr key={p.id}>
                            <td>
                              <code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                {p.product_id}
                              </code>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.mobile_model || '—'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: isZero ? 'var(--danger)' : isLow ? 'var(--warning)' : 'inherit' }}>
                              {stock}
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{min}</td>
                            <td style={{ textAlign: 'right' }}>{INR(p.selling_price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(stock * p.selling_price)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${isZero ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                                {isZero ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 2. SALES REPORT TAB                                  */}
          {/* ==================================================== */}
          {activeTab === 'sales' && (
            <div>
              {/* Filter controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { id: 'all', label: 'All Invoices' },
                    { id: 'month', label: 'This Month' },
                    { id: 'today', label: 'Today' },
                  ].map(p => (
                    <button
                      key={p.id}
                      className={`btn btn-sm ${salesPeriod === p.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setSalesPeriod(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleExportSalesCSV}>
                  <Download size={13} /> Export CSV
                </button>
              </div>

              {/* Sales KPIs */}
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                    <TrendingUp size={20} color="#10b981" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Total Revenue</div>
                    <div className="stat-value">{INR(salesSummary.totalSales)}</div>
                    <div className="stat-sub">{salesSummary.count} invoices settled</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#eff6ff' }}>
                    <FileText size={20} color="#3b82f6" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Taxable Base</div>
                    <div className="stat-value">{INR(salesSummary.totalTaxable)}</div>
                    <div className="stat-sub">Before GST addition</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#fffbeb' }}>
                    <CheckCircle2 size={20} color="#f59e0b" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">GST Collected</div>
                    <div className="stat-value">{INR(salesSummary.totalGst)}</div>
                    <div className="stat-sub">Govt tax collected</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#f5f3ff' }}>
                    <AlertTriangle size={20} color="#8b5cf6" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Discounts Conceded</div>
                    <div className="stat-value">{INR(salesSummary.totalDiscount)}</div>
                    <div className="stat-sub">Customer discounts</div>
                  </div>
                </div>
              </div>

              {/* Channel Revenue Breakdown */}
              {channelBreakdown.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <span className="card-title">Revenue by Channel</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Breakdown of selected period — totals above are the combined sum</span>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 }}>
                      {channelBreakdown.map(ch => (
                        <div key={ch.channel} style={{
                          background: ch.bg || '#f9fafb',
                          borderRadius: 'var(--radius)',
                          padding: '12px 14px',
                          border: `1px solid ${ch.color || '#e5e7eb'}22`,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: ch.color || '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            {ch.label || ch.channel}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{INR(ch.revenue)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ch.count} invoice{ch.count !== 1 ? 's' : ''}</div>
                          <div style={{ marginTop: 6, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              width: `${salesSummary.totalSales > 0 ? Math.round((ch.revenue / salesSummary.totalSales) * 100) : 0}%`,
                              height: '100%', background: ch.color || '#374151', borderRadius: 2,
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {salesSummary.totalSales > 0 ? Math.round((ch.revenue / salesSummary.totalSales) * 100) : 0}% of total
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Invoices List */}
              <div className="card" style={{ padding: 0 }}>
                <div className="card-header" style={{ padding: '16px 20px' }}>
                  <span className="card-title">Settled Invoices ({filteredInvoices.length})</span>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Channel</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Payment</th>
                        <th style={{ textAlign: 'right' }}>GST</th>
                        <th style={{ textAlign: 'right' }}>Grand Total</th>
                        <th style={{ textAlign: 'center' }}>WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id}>
                          <td><code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{inv.invoice_number}</code></td>
                          <td style={{ fontSize: 12 }}>{new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                          <td>
                            {(() => {
                              const ch = inv.channel || 'offline'
                              const m = CHANNEL_META[ch] || { label: ch, color: '#6b7280', bg: '#f9fafb' }
                              return (
                                <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {m.label}
                                </span>
                              )
                            })()}
                          </td>
                          <td style={{ fontWeight: 600 }}>{inv.customer_name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.customer_phone}</td>
                          <td><span className="badge badge-secondary">{inv.payment_method}</span></td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{INR(inv.gst_amount)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>{INR(inv.grand_total)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${inv.whatsapp_status === 'SENT' ? 'badge-success' : inv.whatsapp_status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                              {inv.whatsapp_status === 'SENT' ? 'Sent ✓' : inv.whatsapp_status === 'FAILED' ? 'Failed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 3. CUSTOMER REPORT TAB                               */}
          {/* ==================================================== */}
          {activeTab === 'customers' && (
            <div>
              {/* Customer KPIs */}
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#f5f3ff' }}>
                    <Users size={20} color="#8b5cf6" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Total Customers</div>
                    <div className="stat-value">{customerSummary.totalCustomers}</div>
                    <div className="stat-sub">Store patrons registered</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                    <CheckCircle2 size={20} color="#10b981" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Repeat Customers</div>
                    <div className="stat-value">{customerSummary.repeatCustomers}</div>
                    <div className="stat-sub">{customerSummary.repeatRate}% repeat visitor rate</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#eff6ff' }}>
                    <TrendingUp size={20} color="#3b82f6" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Lifetime Value (LTV)</div>
                    <div className="stat-value">{INR(customerSummary.totalCustomerSpend)}</div>
                    <div className="stat-sub">Cumulative spend across patrons</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#fffbeb' }}>
                    <ArrowUpRight size={20} color="#f59e0b" strokeWidth={2.5} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Avg Spend / Customer</div>
                    <div className="stat-value">{INR(customerSummary.avgSpend)}</div>
                    <div className="stat-sub">Average customer spend</div>
                  </div>
                </div>
              </div>

              {/* Customer Table */}
              <div className="card" style={{ padding: 0 }}>
                <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="card-title">Customer Directory & Spend Rank</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{customers.length} patrons</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportCustomerCSV}>
                    <Download size={13} /> Export CSV
                  </button>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer Name</th>
                        <th>WhatsApp Phone</th>
                        <th style={{ textAlign: 'center' }}>Orders</th>
                        <th style={{ textAlign: 'right' }}>Total Spent</th>
                        <th style={{ textAlign: 'center' }}>Loyalty Tier</th>
                        <th>Last Visit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c, idx) => {
                        const orders = Number(c.total_orders || 1)
                        const isVIP = orders >= 3
                        const isRepeat = orders > 1

                        return (
                          <tr key={c.id}>
                            <td style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 12 }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.phone}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800 }}>{orders}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{INR(c.total_spent)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${isVIP ? 'badge-primary' : isRepeat ? 'badge-info' : 'badge-secondary'}`}>
                                {isVIP ? 'VIP Patron' : isRepeat ? 'Repeat Customer' : 'First Visit'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('en-IN') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Reports
