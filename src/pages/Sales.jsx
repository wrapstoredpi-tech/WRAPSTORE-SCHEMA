// ============================================================
// WRAPSTORE SALES ANALYTICS
// Real-time sales insights based on completed invoices and confirmed online orders
// ============================================================

import React, { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Calendar, CreditCard, ShoppingBag, DollarSign,
  Package, ArrowUpRight, BarChart2, PieChart as PieIcon, RefreshCw,
  Smartphone, ShieldCheck, Globe
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, PieChart, Pie
} from 'recharts'
import { supabase } from '../lib/supabase'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INR_SHORT = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const PRODUCT_TYPES = [
  { key: 'iphone_case', label: 'iPhone Cases', color: '#111827' },
  { key: 'samsung_case', label: 'Samsung Premium Cases', color: '#3b82f6' },
  { key: 'mobile_sticker', label: 'Mobile Stickers', color: '#10b981' },
  { key: 'combo', label: 'Value Combos', color: '#8b5cf6' },
]

const PAYMENT_COLORS = {
  Cash: '#10b981',
  UPI: '#6366f1',
  Card: '#f59e0b',
  Online: '#0284c7',
  Razorpay: '#0284c7',
  Other: '#6b7280',
}

const Sales = () => {
  const [dateRange, setDateRange] = useState('month') // 'today', 'yesterday', 'week', 'month', 'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [invoices, setInvoices] = useState([])
  const [invoiceItems, setInvoiceItems] = useState([])
  const [onlineOrders, setOnlineOrders] = useState([])
  const [onlineOrderItems, setOnlineOrderItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Calculate range bounds
  const getBounds = () => {
    const now = new Date()
    let start = new Date()
    let end = new Date()

    if (dateRange === 'today') {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'yesterday') {
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'week') {
      const day = now.getDay() || 7 // Monday as first day
      start.setDate(now.getDate() - day + 1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (dateRange === 'custom') {
      if (customStart) start = new Date(customStart + 'T00:00:00')
      if (customEnd) end = new Date(customEnd + 'T23:59:59')
    }

    return { start: start.toISOString(), end: end.toISOString() }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const { start, end } = getBounds()

      // Fetch invoices in date range
      const [
        { data: invData },
        { data: onlineData },
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('payment_status', 'PAID')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true }),
        supabase
          .from('online_orders')
          .select('*')
          .neq('order_status', 'CANCELLED')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true }),
      ])

      const invList = invData || []
      const onlineList = (onlineData || []).filter(o =>
        o.payment_status === 'PAID' ||
        o.payment_status === 'COMPLETED' ||
        o.payment_status === 'captured' ||
        ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(o.order_status)
      )

      setInvoices(invList)
      setOnlineOrders(onlineList)

      // Fetch items for invoices
      if (invList.length > 0) {
        const invIds = invList.map(i => i.id)
        const { data: itemsData } = await supabase
          .from('invoice_items')
          .select('*')
          .in('invoice_id', invIds)
        setInvoiceItems(itemsData || [])
      } else {
        setInvoiceItems([])
      }

      // Fetch items for online orders
      if (onlineList.length > 0) {
        const orderIds = onlineList.map(o => o.id)
        const { data: oItemsData } = await supabase
          .from('online_order_items')
          .select('*')
          .in('order_id', orderIds)
        setOnlineOrderItems(oItemsData || [])
      } else {
        setOnlineOrderItems([])
      }
    } catch (err) {
      console.error('Error fetching sales analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange, customStart, customEnd])

  // Aggregate Metrics (Omnichannel)
  const summary = useMemo(() => {
    const posSales = invoices.reduce((s, i) => s + Number(i.grand_total || 0), 0)
    const posCount = invoices.length
    const posGst = invoices.reduce((s, i) => s + Number(i.gst_amount || 0), 0)
    const posDiscounts = invoices.reduce((s, i) => s + Number(i.discount_amount || 0), 0)

    const onlineSales = onlineOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const onlineCount = onlineOrders.length
    const onlineGst = onlineOrders.reduce((s, o) => s + Number(o.gst_amount || 0), 0)
    const onlineDiscounts = onlineOrders.reduce((s, o) => s + Number(o.discount_amount || 0), 0)

    const totalSales = posSales + onlineSales
    const totalInvoices = posCount + onlineCount
    const avgOrderValue = totalInvoices > 0 ? totalSales / totalInvoices : 0

    const posUnits = invoiceItems.reduce((s, it) => s + Number(it.quantity || 0), 0)
    const onlineUnits = onlineOrderItems.reduce((s, it) => s + Number(it.quantity || 0), 0)
    const totalUnits = posUnits + onlineUnits

    const totalGst = posGst + onlineGst
    const totalDiscounts = posDiscounts + onlineDiscounts

    return {
      posSales, posCount,
      onlineSales, onlineCount,
      totalSales, totalInvoices, avgOrderValue, totalUnits, totalGst, totalDiscounts
    }
  }, [invoices, invoiceItems, onlineOrders, onlineOrderItems])

  // Daily / Periodic Trend Data (Omnichannel)
  const trendData = useMemo(() => {
    const map = {}
    // Invoices
    invoices.forEach(inv => {
      const d = new Date(inv.created_at)
      const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!map[key]) map[key] = { date: key, sales: 0, posSales: 0, onlineSales: 0, count: 0 }
      const amt = Number(inv.grand_total || 0)
      map[key].sales += amt
      map[key].posSales += amt
      map[key].count += 1
    })
    // Online orders
    onlineOrders.forEach(ord => {
      const d = new Date(ord.created_at)
      const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!map[key]) map[key] = { date: key, sales: 0, posSales: 0, onlineSales: 0, count: 0 }
      const amt = Number(ord.total_amount || 0)
      map[key].sales += amt
      map[key].onlineSales += amt
      map[key].count += 1
    })
    return Object.values(map)
  }, [invoices, onlineOrders])

  // Sales by Product Type (Omnichannel)
  const typeData = useMemo(() => {
    const map = {
      iphone_case: { name: 'iPhone Cases', sales: 0, units: 0, color: '#111827' },
      samsung_case: { name: 'Samsung Premium Cases', sales: 0, units: 0, color: '#3b82f6' },
      mobile_sticker: { name: 'Mobile Stickers', sales: 0, units: 0, color: '#10b981' },
      combo: { name: 'Combos & Packs', sales: 0, units: 0, color: '#8b5cf6' },
    }

    // POS Items
    invoiceItems.forEach(item => {
      const t = item.product_type || 'iphone_case'
      const key = map[t] ? t : 'iphone_case'
      map[key].sales += Number(item.line_total || 0)
      map[key].units += Number(item.quantity || 0)
    })

    // Online Items
    onlineOrderItems.forEach(item => {
      let t = item.product_type || 'iphone_case'
      if (t === 'case') t = 'iphone_case'
      const key = map[t] ? t : 'iphone_case'
      map[key].sales += Number(item.line_total || 0)
      map[key].units += Number(item.quantity || 0)
    })

    return Object.values(map)
  }, [invoiceItems, onlineOrderItems])

  // Payment Breakdown (Omnichannel)
  const paymentData = useMemo(() => {
    const map = {
      Cash: { name: 'Cash', value: 0, count: 0, color: PAYMENT_COLORS.Cash },
      UPI: { name: 'UPI', value: 0, count: 0, color: PAYMENT_COLORS.UPI },
      Card: { name: 'Card', value: 0, count: 0, color: PAYMENT_COLORS.Card },
      'Online (Razorpay)': { name: 'Online (Razorpay)', value: 0, count: 0, color: PAYMENT_COLORS.Razorpay },
      Other: { name: 'Other', value: 0, count: 0, color: PAYMENT_COLORS.Other },
    }

    invoices.forEach(inv => {
      const pm = inv.payment_method || 'Cash'
      if (map[pm]) {
        map[pm].value += Number(inv.grand_total || 0)
        map[pm].count += 1
      } else {
        map['Other'].value += Number(inv.grand_total || 0)
        map['Other'].count += 1
      }
    })

    onlineOrders.forEach(ord => {
      map['Online (Razorpay)'].value += Number(ord.total_amount || 0)
      map['Online (Razorpay)'].count += 1
    })

    return Object.values(map).filter(p => p.count > 0 || p.value > 0)
  }, [invoices, onlineOrders])

  // Top Selling Products Leaderboard (Omnichannel)
  const topProducts = useMemo(() => {
    const map = {}
    invoiceItems.forEach(it => {
      const key = it.product_id_code || it.product_name
      if (!map[key]) {
        map[key] = {
          code: it.product_id_code,
          name: it.product_name,
          type: it.product_type,
          model: it.billed_model || it.mobile_model || '—',
          units: 0,
          revenue: 0,
        }
      }
      map[key].units += Number(it.quantity || 0)
      map[key].revenue += Number(it.line_total || 0)
    })

    onlineOrderItems.forEach(it => {
      const key = it.product_name || `prod-${it.product_id}`
      if (!map[key]) {
        map[key] = {
          code: 'WEB',
          name: it.product_name,
          type: it.product_type,
          model: it.billed_model || it.mobile_model || '—',
          units: 0,
          revenue: 0,
        }
      }
      map[key].units += Number(it.quantity || 0)
      map[key].revenue += Number(it.line_total || 0)
    })

    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [invoiceItems, onlineOrderItems])

  return (
    <div>
      {/* Header & Date Range Toolbar */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">Sales Analytics</div>
          <div className="section-subtitle">Real-time revenue, order trends, and product performance (POS & Online)</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`btn btn-sm ${dateRange === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius)' }}
                onClick={() => setDateRange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                className="filter-select"
                style={{ padding: '4px 8px', fontSize: 12 }}
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="filter-select"
                style={{ padding: '4px 8px', fontSize: 12 }}
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading sales metrics...</div>
      ) : (
        <>
          {/* KPI Stat Cards */}
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                <TrendingUp size={20} color="#10b981" strokeWidth={2.5} />
              </div>
              <div className="stat-content">
                <div className="stat-label">Total Sales (Omnichannel)</div>
                <div className="stat-value">{INR(summary.totalSales)}</div>
                <div className="stat-sub">
                  POS: {INR(summary.posSales)} ({summary.posCount}) · Online: {INR(summary.onlineSales)} ({summary.onlineCount})
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#eff6ff' }}>
                <ShoppingBag size={20} color="#3b82f6" strokeWidth={2.5} />
              </div>
              <div className="stat-content">
                <div className="stat-label">Total Transactions</div>
                <div className="stat-value">{summary.totalInvoices}</div>
                <div className="stat-sub">Avg Order: {INR(summary.avgOrderValue)}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f5f3ff' }}>
                <Package size={20} color="#8b5cf6" strokeWidth={2.5} />
              </div>
              <div className="stat-content">
                <div className="stat-label">Units Sold</div>
                <div className="stat-value">{summary.totalUnits.toLocaleString()}</div>
                <div className="stat-sub">Combined store & online orders</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fffbeb' }}>
                <DollarSign size={20} color="#f59e0b" strokeWidth={2.5} />
              </div>
              <div className="stat-content">
                <div className="stat-label">GST Collected</div>
                <div className="stat-value">{INR(summary.totalGst)}</div>
                <div className="stat-sub">Discounts: {INR(summary.totalDiscounts)}</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Sales Trend Chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Sales Trend</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Revenue over time (POS & Online combined)</span>
              </div>
              <div className="card-body">
                {trendData.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 0' }}>
                    <BarChart2 size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No sales recorded in this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#111827" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={INR_SHORT} />
                      <Tooltip
                        contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                        formatter={(val) => [INR(val), 'Total Sales']}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#111827" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Sales by Product Type */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Sales by Product Type</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Omnichannel Scope</span>
              </div>
              <div className="card-body">
                {typeData.every(t => t.sales === 0) ? (
                  <div className="empty-state" style={{ padding: '40px 0' }}>
                    <PieIcon size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No item sales recorded</p>
                  </div>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={typeData}
                          dataKey="sales"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [INR(v), 'Revenue']} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                      {typeData.map(item => (
                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                            <span>{item.name}</span>
                          </div>
                          <div style={{ fontWeight: 700 }}>
                            {INR(item.sales)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({item.units} pcs)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown & Top Products */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
            {/* Payment Methods */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Payment Breakdown</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cash, UPI, Card & Online</span>
              </div>
              <div className="card-body">
                {paymentData.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 0' }}>
                    <CreditCard size={28} color="var(--text-muted)" style={{ marginBottom: 6 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No transactions</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {paymentData.map(p => {
                      const pct = summary.totalSales > 0 ? ((p.value / summary.totalSales) * 100).toFixed(1) : 0
                      return (
                        <div key={p.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                            <span style={{ fontWeight: 700 }}>{INR(p.value)} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({pct}%)</span></span>
                          </div>
                          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.count} transactions</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Products Table */}
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <span className="card-title">Top Selling Products</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ranked by revenue (POS + Online)</span>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                {topProducts.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 0' }}>
                    <p style={{ margin: 0, fontSize: 13 }}>No product sales recorded in this period</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>Model</th>
                        <th style={{ textAlign: 'center' }}>Units Sold</th>
                        <th style={{ textAlign: 'right' }}>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.slice(0, 8).map((prod, idx) => (
                        <tr key={prod.code || idx}>
                          <td style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 12 }}>{idx + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{prod.name}</div>
                            <code style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{prod.code}</code>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prod.model}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{prod.units}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>{INR(prod.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Sales
