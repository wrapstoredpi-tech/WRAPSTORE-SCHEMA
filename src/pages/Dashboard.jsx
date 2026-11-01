// ============================================================
// WRAPSTORE FINAL UNIFIED DASHBOARD
// Multi-stage control center: Today's sales, inventory health,
// recent invoices, online orders stream, top products, and channels
// ============================================================

import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Warehouse, TrendingUp, AlertTriangle,
  XCircle, ArrowUpRight, Clock, CheckCircle2, RefreshCw,
  ShoppingBag, CreditCard, MessageCircle, Sparkles,
  ChevronRight, BarChart2, Globe
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, Legend, Cell
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INR_SHORT = (val) => '₹' + Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const PRODUCT_TYPE_LABELS = {
  iphone_case: 'iPhone Cases',
  samsung_case: 'Samsung Cases',
  mobile_sticker: 'Mobile Stickers',
}

const PRODUCT_TYPE_COLORS = {
  iphone_case: '#111827',
  samsung_case: '#3b82f6',
  mobile_sticker: '#10b981',
}

const StatCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, onClick }) => (
  <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <div className="stat-icon" style={{ background: iconBg }}>
      <Icon size={20} color={iconColor} strokeWidth={2.5} />
    </div>
    <div className="stat-content">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
    {onClick && <ArrowUpRight size={16} color="var(--text-muted)" style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
  </div>
)

const Dashboard = () => {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)

  const [products, setProducts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [invoiceItems, setInvoiceItems] = useState([])
  const [onlineOrders, setOnlineOrders] = useState([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { data: prodData },
        { data: invData },
        { data: itemData },
        { data: onlData },
      ] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('invoices').select('*').eq('payment_status', 'PAID').order('created_at', { ascending: false }),
        supabase.from('invoice_items').select('*').order('created_at', { ascending: false }),
        supabase.from('online_orders').select('*, online_order_items(*)').eq('payment_status', 'PAID').not('order_status', 'eq', 'CANCELLED').order('created_at', { ascending: false }),
      ])

      const localProdsStr = localStorage.getItem('wrapstore_custom_products_v1')
      let localProds = []
      try { localProds = localProdsStr ? JSON.parse(localProdsStr) : [] } catch (e) {}

      const dbProds = prodData || []
      const mergedProds = [...dbProds]
      for (const lp of localProds) {
        if (lp.is_active !== false && !mergedProds.some(p => p.id === lp.id || (p.product_id && p.product_id === lp.product_id))) {
          mergedProds.push(lp)
        }
      }

      setProducts(mergedProds)
      setInvoices(invData || [])
      setInvoiceItems(itemData || [])
      setOnlineOrders(onlData || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Derived Metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayInvoices = invoices.filter(i => i.created_at?.startsWith(todayStr))
    const todayOnline = (onlineOrders || []).filter(o => o.created_at?.startsWith(todayStr))

    const todayPosSales = todayInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0)
    const todayOnlineSales = todayOnline.reduce((s, o) => s + Number(o.grand_total || 0), 0)
    const todayCombinedSales = todayPosSales + todayOnlineSales
    const todayOrdersCount = todayInvoices.length + todayOnline.length

    const approved = products.filter(p => p.approval_status === 'APPROVED' || !p.approval_status)
    const pendingApproval = products.filter(p => p.approval_status === 'PENDING_APPROVAL')
    const activeCatalog = products.length > 0 ? products : []
    const totalStock = activeCatalog.reduce((s, p) => s + Number(p.current_stock || 0), 0)
    const inventoryValue = activeCatalog.reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.selling_price || 0), 0)
    const lowStock = activeCatalog.filter(p => Number(p.current_stock || 0) > 0 && Number(p.current_stock || 0) <= Number(p.min_stock_level || 5))
    const outOfStock = activeCatalog.filter(p => Number(p.current_stock || 0) === 0)

    return {
      todayCombinedSales,
      todayPosSales,
      todayOnlineSales,
      todayInvoicesCount: todayInvoices.length,
      todayOnlineCount: todayOnline.length,
      todayOrdersCount,
      totalProducts: products.length,
      pendingApprovalCount: pendingApproval.length,
      totalStock,
      inventoryValue,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    }
  }, [products, invoices, onlineOrders])

  // Sales Overview Chart: Both POS invoices and Online Orders as separate lines + combined total
  const salesOverviewData = useMemo(() => {
    const map = {}

    // Map POS invoices
    invoices.slice(0, 60).forEach(inv => {
      const d = new Date(inv.created_at)
      const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!map[key]) map[key] = { date: key, posSales: 0, onlineSales: 0, totalSales: 0 }
      map[key].posSales += Number(inv.grand_total || 0)
      map[key].totalSales += Number(inv.grand_total || 0)
    })

    // Map Online orders
    onlineOrders.slice(0, 60).forEach(ord => {
      const d = new Date(ord.created_at)
      const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!map[key]) map[key] = { date: key, posSales: 0, onlineSales: 0, totalSales: 0 }
      map[key].onlineSales += Number(ord.grand_total || 0)
      map[key].totalSales += Number(ord.grand_total || 0)
    })

    return Object.values(map).reverse().slice(-7)
  }, [invoices, onlineOrders])

  // Inventory Overview: Breakdown by product type
  const typeBreakdown = useMemo(() => {
    const approved = products.filter(p => p.approval_status === 'APPROVED')
    return ['iphone_case', 'samsung_case', 'mobile_sticker'].map(type => ({
      name: PRODUCT_TYPE_LABELS[type],
      count: approved.filter(p => p.product_type === type).length,
      stock: approved.filter(p => p.product_type === type).reduce((s, p) => s + Number(p.current_stock || 0), 0),
      type,
    }))
  }, [products])

  // Top Selling Products Leaderboard (both POS items and online items)
  const topSellingProducts = useMemo(() => {
    const map = {}

    // POS invoice items
    invoiceItems.forEach(it => {
      const key = it.product_id_code || it.product_name
      if (!map[key]) {
        map[key] = {
          code: it.product_id_code,
          name: it.product_name,
          model: it.mobile_model || '—',
          units: 0,
          revenue: 0,
        }
      }
      map[key].units += Number(it.quantity || 0)
      map[key].revenue += Number(it.line_total || 0)
    })

    // Online order items
    onlineOrders.forEach(ord => {
      (ord.online_order_items || []).forEach(it => {
        const key = it.product_id_code || it.product_name
        if (!map[key]) {
          map[key] = {
            code: it.product_id_code || 'ONL-SKU',
            name: it.product_name,
            model: it.mobile_model || '—',
            units: 0,
            revenue: 0,
          }
        }
        map[key].units += Number(it.quantity || 0)
        map[key].revenue += Number(it.line_total || 0)
      })
    })

    return Object.values(map).sort((a, b) => b.units - a.units).slice(0, 5)
  }, [invoiceItems, onlineOrders])

  // Channel Revenue Breakdown (POS Invoices + Online Website Orders)
  const channelBreakdown = useMemo(() => {
    const map = {
      offline: { channel: 'offline', label: 'POS Counter', color: '#111827', bg: '#f3f4f6', revenue: 0, count: 0 },
      website: { channel: 'website', label: 'Online Website', color: '#2563eb', bg: '#eff6ff', revenue: 0, count: 0 },
    }

    invoices.forEach(inv => {
      map.offline.revenue += Number(inv.grand_total || 0)
      map.offline.count += 1
    })

    onlineOrders.forEach(ord => {
      map.website.revenue += Number(ord.grand_total || 0)
      map.website.count += 1
    })

    return Object.values(map).filter(ch => ch.count > 0 || ch.revenue > 0)
  }, [invoices, onlineOrders])

  // Recent Invoices (Latest 6)
  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices])

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" /> Loading WrapStore control center...
      </div>
    )
  }

  return (
    <div>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Store Operations, POS & Live Website Channels</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Required Metrics Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {/* 1. Today's Combined Sales */}
        <StatCard
          icon={TrendingUp}
          label="Today's Total Sales"
          value={INR(metrics.todayCombinedSales)}
          sub={`POS: ${INR(metrics.todayPosSales)} · Online: ${INR(metrics.todayOnlineSales)}`}
          iconBg="#ecfdf5"
          iconColor="#10b981"
          onClick={() => navigate('/sales')}
        />

        {/* 2. Orders Today (Combined) */}
        <StatCard
          icon={ShoppingBag}
          label="Orders Today"
          value={metrics.todayOrdersCount}
          sub={`${metrics.todayInvoicesCount} POS + ${metrics.todayOnlineCount} Website`}
          iconBg="#eff6ff"
          iconColor="#3b82f6"
          onClick={() => navigate('/online-orders')}
        />

        {/* 3. Total Products */}
        <StatCard
          icon={Package}
          label="Total Products"
          value={metrics.totalProducts}
          sub="Catalog inventory items"
          iconBg="#f3f4f6"
          iconColor="#111827"
          onClick={() => navigate('/products')}
        />

        {/* 4. Total Stock */}
        <StatCard
          icon={Warehouse}
          label="Total Stock"
          value={metrics.totalStock.toLocaleString()}
          sub="Physical units in store"
          iconBg="#eff6ff"
          iconColor="#3b82f6"
          onClick={() => navigate('/inventory')}
        />

        {/* Super admin approval queue (if applicable) */}
        {isSuperAdmin && metrics.pendingApprovalCount > 0 && (
          <StatCard
            icon={Clock}
            label="Pending Approval"
            value={metrics.pendingApprovalCount}
            sub="Awaiting admin sign-off"
            iconBg="#f5f3ff"
            iconColor="#8b5cf6"
            onClick={() => navigate('/products/approval')}
          />
        )}
      </div>

      {/* Channel Revenue Breakdown */}
      {channelBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Revenue by Channel (POS vs Online Website)</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Separate streams with combined oversight</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {channelBreakdown.map(ch => (
                <div key={ch.channel} style={{
                  background: ch.bg || '#f9fafb',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  border: `1.5px solid ${ch.color}22`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ch.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {ch.channel === 'website' ? <Globe size={13} /> : <ShoppingBag size={13} />}
                    {ch.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{INR(ch.revenue)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ch.count} order{ch.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
              <div style={{
                background: '#f0fdf4',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                border: '1.5px solid #bbf7d0',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Combined Total
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
                  {INR(channelBreakdown.reduce((sum, ch) => sum + ch.revenue, 0))}
                </div>
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                  {channelBreakdown.reduce((sum, ch) => sum + ch.count, 0)} total orders
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Overview & Inventory Overview Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr', gap: 20, marginBottom: 20 }}>
        {/* Sales Overview Chart: Both Lines + Combined */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="card-title">Sales Overview</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>POS Invoices & Online Orders</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sales')} style={{ fontSize: 12 }}>
              Analytics <ChevronRight size={12} />
            </button>
          </div>
          <div className="card-body">
            {salesOverviewData.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <p style={{ margin: 0, fontSize: 13 }}>No sales transactions recorded yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={salesOverviewData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#111827" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="onlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={INR_SHORT} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    formatter={(val, name) => [INR(val), name === 'posSales' ? 'POS Sales' : name === 'onlineSales' ? 'Online Orders' : 'Combined Total']}
                  />
                  <Legend
                    formatter={(val) => val === 'posSales' ? 'POS Invoices' : val === 'onlineSales' ? 'Online Orders' : 'Combined Total'}
                    wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  />
                  <Area type="monotone" dataKey="posSales" stroke="#111827" strokeWidth={2} fill="url(#posGrad)" />
                  <Area type="monotone" dataKey="onlineSales" stroke="#2563eb" strokeWidth={2} fill="url(#onlGrad)" />
                  <Area type="monotone" dataKey="totalSales" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Inventory Overview */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="card-title">Inventory Overview</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>3 core categories</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/smart-inventory')} style={{ fontSize: 12 }}>
              Smart Insights <ChevronRight size={12} />
            </button>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={typeBreakdown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val, name) => [val, name === 'stock' ? 'Stock Units' : 'SKUs']} />
                <Bar dataKey="stock" radius={[4, 4, 0, 0]}>
                  {typeBreakdown.map((entry) => (
                    <Cell key={entry.type} fill={PRODUCT_TYPE_COLORS[entry.type]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {typeBreakdown.map(item => (
                <div key={item.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: PRODUCT_TYPE_COLORS[item.type] }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: 700 }}>{item.stock} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>units ({item.count} models)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products & Recent Invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20 }}>
        {/* Top Selling Products */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Top Selling Products (POS & Online)</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sales')} style={{ fontSize: 12 }}>
              All <ChevronRight size={12} />
            </button>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            {topSellingProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <p style={{ margin: 0, fontSize: 13 }}>No product sales recorded yet</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Model</th>
                    <th style={{ textAlign: 'center' }}>Units</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingProducts.map(p => (
                    <tr key={p.code}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
                        <code style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{p.code}</code>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.model}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{p.units}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Recent Invoices (POS)</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/invoices')} style={{ fontSize: 12 }}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            {recentInvoices.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <p style={{ margin: 0, fontSize: 13 }}>No POS invoices generated yet</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => (
                    <tr
                      key={inv.id}
                      onClick={() => navigate('/invoices')}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {inv.invoice_number}
                        </code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{inv.customer_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{inv.customer_phone}</div>
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 13 }}>{INR(inv.grand_total)}</td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                          {inv.payment_method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
