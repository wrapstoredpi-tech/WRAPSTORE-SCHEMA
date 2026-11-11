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
  ChevronRight, BarChart2, Globe, Calendar
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, Legend, Cell
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INR_SHORT = (val) => '₹' + Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

  // Calendar / Date Range filter state (affects Row 1 sales cards & Row 2 channel revenue)
  const [dateRange, setDateRange] = useState('today') // 'today', 'yesterday', 'week', 'month', 'all', 'custom'
  const [customStart, setCustomStart] = useState(getLocalDateString())
  const [customEnd, setCustomEnd] = useState(getLocalDateString())

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

  // Calculate date bounds based on selected dateRange and custom inputs
  const getDateBounds = () => {
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
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (dateRange === 'all') {
      start = new Date(2020, 0, 1, 0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'custom') {
      if (customStart) {
        const [y, m, d] = customStart.split('-').map(Number)
        start = new Date(y, m - 1, d, 0, 0, 0, 0)
      } else {
        start.setHours(0, 0, 0, 0)
      }
      if (customEnd) {
        const [y, m, d] = customEnd.split('-').map(Number)
        end = new Date(y, m - 1, d, 23, 59, 59, 999)
      } else if (customStart) {
        const [y, m, d] = customStart.split('-').map(Number)
        end = new Date(y, m - 1, d, 23, 59, 59, 999)
      } else {
        end.setHours(23, 59, 59, 999)
      }
      if (start.getTime() > end.getTime()) {
        const tmp = start
        start = end
        end = tmp
      }
    }

    return { start, end }
  }

  // Formatted date label showing active range
  const rangeLabel = useMemo(() => {
    const { start, end } = getDateBounds()
    const options = { day: 'numeric', month: 'short' }
    if (dateRange === 'today') {
      return `Today (${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`
    }
    if (dateRange === 'yesterday') {
      return `Yesterday (${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`
    }
    if (dateRange === 'week') {
      return `This Week (${start.toLocaleDateString('en-IN', options)} – ${end.toLocaleDateString('en-IN', { ...options, year: 'numeric' })})`
    }
    if (dateRange === 'month') {
      return `This Month (${start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`
    }
    if (dateRange === 'all') {
      return 'All Time'
    }
    if (customStart === customEnd) {
      return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return `${start.toLocaleDateString('en-IN', options)} – ${end.toLocaleDateString('en-IN', { ...options, year: 'numeric' })}`
  }, [dateRange, customStart, customEnd])

  const salesCardLabel = useMemo(() => {
    if (dateRange === 'today') return "Today's Total Sales"
    if (dateRange === 'yesterday') return "Yesterday's Sales"
    if (dateRange === 'week') return "This Week's Sales"
    if (dateRange === 'month') return "This Month's Sales"
    if (dateRange === 'all') return "All-Time Sales"
    return "Total Sales"
  }, [dateRange])

  const ordersCardLabel = useMemo(() => {
    if (dateRange === 'today') return "Orders Today"
    if (dateRange === 'yesterday') return "Yesterday's Orders"
    if (dateRange === 'week') return "This Week's Orders"
    if (dateRange === 'month') return "This Month's Orders"
    if (dateRange === 'all') return "All-Time Orders"
    return "Total Orders"
  }, [dateRange])

  // Date-filtered metrics (First Two Rows: Sales card, Orders card, and Channel Breakdown)
  const filteredMetrics = useMemo(() => {
    const { start, end } = getDateBounds()
    const startTime = start.getTime()
    const endTime = end.getTime()

    const filteredInvoices = invoices.filter(i => {
      if (!i.created_at) return false
      const t = new Date(i.created_at).getTime()
      return t >= startTime && t <= endTime
    })

    const filteredOnline = (onlineOrders || []).filter(o => {
      if (!o.created_at) return false
      const t = new Date(o.created_at).getTime()
      return t >= startTime && t <= endTime
    })

    const posSales = filteredInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0)
    const onlineSales = filteredOnline.reduce((s, o) => s + Number(o.grand_total || 0), 0)
    const combinedSales = posSales + onlineSales
    const posOrdersCount = filteredInvoices.length
    const onlineOrdersCount = filteredOnline.length
    const ordersCount = posOrdersCount + onlineOrdersCount

    const channels = [
      {
        channel: 'offline',
        label: 'POS Counter',
        color: '#111827',
        bg: '#f3f4f6',
        revenue: posSales,
        count: posOrdersCount,
      },
      {
        channel: 'website',
        label: 'Online Website',
        color: '#2563eb',
        bg: '#eff6ff',
        revenue: onlineSales,
        count: onlineOrdersCount,
      },
    ]

    return {
      posSales,
      onlineSales,
      combinedSales,
      posOrdersCount,
      onlineOrdersCount,
      ordersCount,
      channels,
    }
  }, [invoices, onlineOrders, dateRange, customStart, customEnd])

  // Catalog & Inventory Snapshot Metrics (Independent of date range)
  const catalogMetrics = useMemo(() => {
    const approved = products.filter(p => p.approval_status === 'APPROVED' || !p.approval_status)
    const pendingApproval = products.filter(p => p.approval_status === 'PENDING_APPROVAL')
    const activeCatalog = products.length > 0 ? products : []
    const totalStock = activeCatalog.reduce((s, p) => s + Number(p.current_stock || 0), 0)
    const inventoryValue = activeCatalog.reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.selling_price || 0), 0)
    const lowStock = activeCatalog.filter(p => Number(p.current_stock || 0) > 0 && Number(p.current_stock || 0) <= Number(p.min_stock_level || 5))
    const outOfStock = activeCatalog.filter(p => Number(p.current_stock || 0) === 0)

    return {
      totalProducts: products.length,
      pendingApprovalCount: pendingApproval.length,
      totalStock,
      inventoryValue,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    }
  }, [products])

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
          model: it.billed_model || it.mobile_model || '—',
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
            model: it.billed_model || it.mobile_model || '—',
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

  // Recent Invoices (Latest 6)
  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices])

  const combinedTotal = filteredMetrics.combinedSales
  const posPercent = combinedTotal > 0 ? ((filteredMetrics.posSales / combinedTotal) * 100).toFixed(1) : '0.0'
  const onlinePercent = combinedTotal > 0 ? ((filteredMetrics.onlineSales / combinedTotal) * 100).toFixed(1) : '0.0'

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Store Operations, POS & Live Website Channels</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Calendar Date Range Filter Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Quick presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginRight: 6
            }}>
              <Calendar size={14} />
              <span>Date Range:</span>
            </div>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${dateRange === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius)', fontSize: 12, padding: '4px 10px', height: 28 }}
                onClick={() => setDateRange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers & Active Range Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {dateRange === 'custom' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f9fafb',
                padding: '3px 8px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
                <input
                  type="date"
                  style={{
                    padding: '3px 8px',
                    fontSize: 12,
                    height: 28,
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
                <input
                  type="date"
                  style={{
                    padding: '3px 8px',
                    fontSize: 12,
                    height: 28,
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            )}
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              background: '#f3f4f6',
              padding: '5px 10px',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}>
              <Calendar size={12} color="var(--text-muted)" />
              <span>{rangeLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Required Metrics Cards (Row 1: Sales & Orders change with selected date range) */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {/* 1. Combined Sales for selected range */}
        <StatCard
          icon={TrendingUp}
          label={salesCardLabel}
          value={INR(filteredMetrics.combinedSales)}
          sub={`POS: ${INR(filteredMetrics.posSales)} · Online: ${INR(filteredMetrics.onlineSales)}`}
          iconBg="#ecfdf5"
          iconColor="#10b981"
          onClick={() => navigate('/sales')}
        />

        {/* 2. Orders Count for selected range */}
        <StatCard
          icon={ShoppingBag}
          label={ordersCardLabel}
          value={filteredMetrics.ordersCount}
          sub={`${filteredMetrics.posOrdersCount} POS + ${filteredMetrics.onlineOrdersCount} Website`}
          iconBg="#eff6ff"
          iconColor="#3b82f6"
          onClick={() => navigate('/online-orders')}
        />

        {/* 3. Total Products */}
        <StatCard
          icon={Package}
          label="Total Products"
          value={catalogMetrics.totalProducts}
          sub="Catalog inventory items"
          iconBg="#f3f4f6"
          iconColor="#111827"
          onClick={() => navigate('/products')}
        />

        {/* 4. Total Stock */}
        <StatCard
          icon={Warehouse}
          label="Total Stock"
          value={catalogMetrics.totalStock.toLocaleString()}
          sub="Physical units in store"
          iconBg="#eff6ff"
          iconColor="#3b82f6"
          onClick={() => navigate('/inventory')}
        />

        {/* Super admin approval queue (if applicable) */}
        {isSuperAdmin && catalogMetrics.pendingApprovalCount > 0 && (
          <StatCard
            icon={Clock}
            label="Pending Approval"
            value={catalogMetrics.pendingApprovalCount}
            sub="Awaiting admin sign-off"
            iconBg="#f5f3ff"
            iconColor="#8b5cf6"
            onClick={() => navigate('/products/approval')}
          />
        )}
      </div>

      {/* Channel Revenue Breakdown - Unified Single Tile */}
      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title" style={{ margin: 0 }}>
              Revenue by Channel
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              (POS vs Online Website)
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              background: '#f3f4f6',
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              {rangeLabel}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Separate streams with combined oversight
          </span>
        </div>

        {/* 3 Metrics Integrated Under One Tile */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          background: 'var(--bg-card)',
        }}>
          {/* Section 1: POS Counter */}
          <div style={{
            padding: '18px 22px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#111827',
                }}>
                  <ShoppingBag size={15} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    POS Counter
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    In-Store Checkout
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#111827',
                background: '#f3f4f6',
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                {posPercent}%
              </span>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {INR(filteredMetrics.posSales)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{filteredMetrics.posOrdersCount}</strong> order{filteredMetrics.posOrdersCount !== 1 ? 's' : ''} recorded
              </div>
            </div>
          </div>

          {/* Section 2: Online Website */}
          <div style={{
            padding: '18px 22px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}>
                  <Globe size={15} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Online Website
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Live Web Store
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#2563eb',
                background: '#eff6ff',
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                {onlinePercent}%
              </span>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {INR(filteredMetrics.onlineSales)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <strong style={{ color: '#2563eb' }}>{filteredMetrics.onlineOrdersCount}</strong> order{filteredMetrics.onlineOrdersCount !== 1 ? 's' : ''} placed
              </div>
            </div>
          </div>

          {/* Section 3: Combined Total */}
          <div style={{
            padding: '18px 22px',
            background: '#fcfdfd',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                }}>
                  <Sparkles size={15} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Combined Total
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Unified Omnichannel
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#16a34a',
                background: '#ecfdf5',
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                100%
              </span>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {INR(filteredMetrics.combinedSales)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <strong style={{ color: '#15803d' }}>{filteredMetrics.ordersCount}</strong> total order{filteredMetrics.ordersCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Ratio Progress Bar */}
        <div style={{ padding: '0 22px 18px 22px', background: 'var(--bg-card)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#111827' }} />
              POS Share: <strong>{posPercent}%</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
              Online Share: <strong>{onlinePercent}%</strong>
            </span>
          </div>

          <div style={{
            width: '100%',
            height: 7,
            borderRadius: 99,
            background: '#f3f4f6',
            overflow: 'hidden',
            display: 'flex',
          }}>
            {combinedTotal > 0 ? (
              <>
                <div
                  style={{
                    width: `${posPercent}%`,
                    background: '#111827',
                    transition: 'width 0.4s ease',
                  }}
                  title={`POS Counter: ${INR(filteredMetrics.posSales)} (${posPercent}%)`}
                />
                <div
                  style={{
                    width: `${onlinePercent}%`,
                    background: '#2563eb',
                    transition: 'width 0.4s ease',
                  }}
                  title={`Online Website: ${INR(filteredMetrics.onlineSales)} (${onlinePercent}%)`}
                />
              </>
            ) : (
              <div style={{ width: '100%', background: '#e5e7eb' }} />
            )}
          </div>
        </div>
      </div>

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
