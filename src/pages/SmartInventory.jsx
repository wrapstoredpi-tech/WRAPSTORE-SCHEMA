// ============================================================
// WRAPSTORE SMART INVENTORY MANAGEMENT
// Dynamic insights based on actual PostgreSQL sales & stock data
// ============================================================

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, AlertTriangle, Zap, Clock, PackageCheck,
  TrendingDown, ArrowRight, Search, RefreshCw, Warehouse,
  Package, ChevronRight, ShieldAlert, CheckCircle2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFormattedProductName } from '../lib/productUtils'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SmartInventory = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [invoiceItems, setInvoiceItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('ALL') // 'ALL', 'LOW_STOCK', 'FAST_MOVING', 'SLOW_MOVING', 'RESTOCK'
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch approved products
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('approval_status', 'APPROVED')
        .eq('is_active', true)
        .order('name')

      // 2. Fetch sales from the past 60 days
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()
      const { data: itemsData } = await supabase
        .from('invoice_items')
        .select('product_id, product_id_code, quantity, created_at, line_total')
        .gte('created_at', sixtyDaysAgo)

      setProducts(prodData || [])
      setInvoiceItems(itemsData || [])
    } catch (err) {
      console.error('Error fetching smart inventory data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Derive intelligent insights from real records
  const analyzedProducts = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 86400000
    const now = Date.now()

    // Map sales by product_id and product_id_code
    const sales30d = {}
    const sales60d = {}

    invoiceItems.forEach(it => {
      const pId = it.product_id || it.product_id_code
      const pCode = it.product_id_code
      const qty = Number(it.quantity || 0)
      const itemTime = new Date(it.created_at).getTime()

      // 60 days
      sales60d[pId] = (sales60d[pId] || 0) + qty
      if (pCode) sales60d[pCode] = (sales60d[pCode] || 0) + qty

      // 30 days
      if (itemTime >= thirtyDaysAgo) {
        sales30d[pId] = (sales30d[pId] || 0) + qty
        if (pCode) sales30d[pCode] = (sales30d[pCode] || 0) + qty
      }
    })

    return products.map(p => {
      const sold30 = sales30d[p.id] || sales30d[p.product_id] || 0
      const sold60 = sales60d[p.id] || sales60d[p.product_id] || 0
      const velocityPerDay = sold30 / 30
      const stock = Number(p.current_stock || 0)
      const minStock = Number(p.min_stock_level || 5)

      const isLowStock = stock <= minStock
      const isOutOfStock = stock === 0
      const isFastMoving = sold30 >= 3 || velocityPerDay >= 0.15
      const isSlowMoving = sold60 === 0 && stock > 0
      const daysOfStock = velocityPerDay > 0 ? Math.round(stock / velocityPerDay) : (stock > 0 ? 999 : 0)
      const needsRestock = isLowStock || (daysOfStock <= 14 && velocityPerDay > 0)
      const suggestedRestockUnits = isLowStock
        ? Math.max(minStock * 2 - stock, 10)
        : (daysOfStock <= 14 ? Math.ceil(velocityPerDay * 30) - stock : 0)

      return {
        ...p,
        stock,
        minStock,
        sold30,
        sold60,
        velocityPerDay,
        daysOfStock,
        isLowStock,
        isOutOfStock,
        isFastMoving,
        isSlowMoving,
        needsRestock,
        suggestedRestockUnits: Math.max(0, suggestedRestockUnits),
      }
    })
  }, [products, invoiceItems])

  // Counts for KPI tabs
  const lowStockCount = analyzedProducts.filter(p => p.isLowStock).length
  const fastMovingCount = analyzedProducts.filter(p => p.isFastMoving).length
  const slowMovingCount = analyzedProducts.filter(p => p.isSlowMoving).length
  const restockCount = analyzedProducts.filter(p => p.needsRestock).length

  // Filtered list
  const filteredList = useMemo(() => {
    let list = analyzedProducts

    if (activeFilter === 'LOW_STOCK') {
      list = list.filter(p => p.isLowStock)
    } else if (activeFilter === 'FAST_MOVING') {
      list = list.filter(p => p.isFastMoving)
    } else if (activeFilter === 'SLOW_MOVING') {
      list = list.filter(p => p.isSlowMoving)
    } else if (activeFilter === 'RESTOCK') {
      list = list.filter(p => p.needsRestock)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.product_id && p.product_id.toLowerCase().includes(q)) ||
        (p.mobile_model && p.mobile_model.toLowerCase().includes(q))
      )
    }

    return list
  }, [analyzedProducts, activeFilter, search])

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#6366f1" /> Smart Inventory Management
          </div>
          <div className="section-subtitle">
            Automated intelligence computed from physical sales velocity and real inventory counts
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={13} /> Refresh Data
        </button>
      </div>

      {/* KPI Cards / Filter Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* Low Stock */}
        <div
          className="stat-card"
          onClick={() => setActiveFilter(activeFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'LOW_STOCK' ? '2px solid #f59e0b' : '1px solid var(--border)',
            background: activeFilter === 'LOW_STOCK' ? '#fffbeb' : 'white',
          }}
        >
          <div className="stat-icon" style={{ background: '#fffbeb' }}>
            <AlertTriangle size={20} color="#f59e0b" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Low Stock Alerts</div>
            <div className="stat-value">{lowStockCount}</div>
            <div className="stat-sub">Stock &le; minimum threshold</div>
          </div>
        </div>

        {/* Fast Moving */}
        <div
          className="stat-card"
          onClick={() => setActiveFilter(activeFilter === 'FAST_MOVING' ? 'ALL' : 'FAST_MOVING')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'FAST_MOVING' ? '2px solid #3b82f6' : '1px solid var(--border)',
            background: activeFilter === 'FAST_MOVING' ? '#eff6ff' : 'white',
          }}
        >
          <div className="stat-icon" style={{ background: '#eff6ff' }}>
            <Zap size={20} color="#3b82f6" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Fast Moving</div>
            <div className="stat-value">{fastMovingCount}</div>
            <div className="stat-sub">High 30-day velocity</div>
          </div>
        </div>

        {/* Slow Moving */}
        <div
          className="stat-card"
          onClick={() => setActiveFilter(activeFilter === 'SLOW_MOVING' ? 'ALL' : 'SLOW_MOVING')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'SLOW_MOVING' ? '2px solid #6b7280' : '1px solid var(--border)',
            background: activeFilter === 'SLOW_MOVING' ? '#f3f4f6' : 'white',
          }}
        >
          <div className="stat-icon" style={{ background: '#f3f4f6' }}>
            <Clock size={20} color="#6b7280" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Slow Moving</div>
            <div className="stat-value">{slowMovingCount}</div>
            <div className="stat-sub">No sales in last 60 days</div>
          </div>
        </div>

        {/* Restock Needed */}
        <div
          className="stat-card"
          onClick={() => setActiveFilter(activeFilter === 'RESTOCK' ? 'ALL' : 'RESTOCK')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'RESTOCK' ? '2px solid #8b5cf6' : '1px solid var(--border)',
            background: activeFilter === 'RESTOCK' ? '#f5f3ff' : 'white',
          }}
        >
          <div className="stat-icon" style={{ background: '#f5f3ff' }}>
            <PackageCheck size={20} color="#8b5cf6" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Restock Needed</div>
            <div className="stat-value">{restockCount}</div>
            <div className="stat-sub">Runout expected soon</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search product name, ID or model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'ALL', label: 'All Products' },
            { id: 'LOW_STOCK', label: 'Low Stock' },
            { id: 'FAST_MOVING', label: 'Fast Moving' },
            { id: 'SLOW_MOVING', label: 'Slow Moving' },
            { id: 'RESTOCK', label: 'Restock Suggestions' },
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-sm ${activeFilter === f.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Insights Cards List */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Calculating smart inventory telemetry...</div>
      ) : filteredList.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <Sparkles size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
            <h3>No products match this insight filter</h3>
            <p>Try switching to All Products or clear your search.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredList.map(prod => (
            <div
              key={prod.id}
              className="card"
              style={{
                padding: '16px 20px',
                borderLeft: prod.isOutOfStock
                  ? '4px solid #ef4444'
                  : prod.isLowStock
                  ? '4px solid #f59e0b'
                  : prod.isFastMoving
                  ? '4px solid #3b82f6'
                  : '4px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                {/* Product Meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {prod.product_id}
                    </code>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{getFormattedProductName(prod)}</span>
                    {prod.mobile_model && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({prod.mobile_model})</span>
                    )}
                  </div>

                  {/* Insight Bullet Description */}
                  <div style={{ fontSize: 13, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {prod.isOutOfStock && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', fontWeight: 600 }}>
                        <ShieldAlert size={14} /> OUT OF STOCK: Product has 0 units remaining in store.
                      </div>
                    )}

                    {!prod.isOutOfStock && prod.isLowStock && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309', fontWeight: 600 }}>
                        <AlertTriangle size={14} /> LOW STOCK: {prod.name} has only {prod.stock} units remaining (min threshold: {prod.minStock}).
                      </div>
                    )}

                    {prod.isFastMoving && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1d4ed8' }}>
                        <Zap size={14} /> FAST MOVING: Sold {prod.sold30} units in the last 30 days ({prod.velocityPerDay.toFixed(1)} units/day).
                      </div>
                    )}

                    {prod.isSlowMoving && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4b5563' }}>
                        <Clock size={14} /> SLOW MOVING: Product {prod.product_id} has had no sales in the last 60 days with {prod.stock} units in inventory.
                      </div>
                    )}

                    {prod.needsRestock && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6d28d9', fontWeight: 600 }}>
                        <PackageCheck size={14} /> RESTOCK: Based on recent sales, this product requires restocking (suggested: +{prod.suggestedRestockUnits} units).
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock Stats & Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Current Stock</div>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: prod.isOutOfStock ? 'var(--danger)' : prod.isLowStock ? 'var(--warning)' : 'var(--text-primary)',
                    }}>
                      {prod.stock} units
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Selling: {INR(prod.selling_price)}</div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6 }}
                    onClick={() => navigate('/inventory')}
                  >
                    Adjust Stock <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SmartInventory
