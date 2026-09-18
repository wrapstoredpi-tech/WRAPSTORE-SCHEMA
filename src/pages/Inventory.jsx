import React, { useEffect, useState } from 'react'
import {
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  Plus, Minus, RotateCcw, AlertTriangle, Trash2,
  History, X, Check, Image as ImageIcon, RefreshCw, Package,
  TrendingUp, XCircle, ArrowUpRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ProductImageHover from '../components/common/ProductImageHover'

const PAGE_SIZE = 15

const MOVEMENT_TYPES = [
  { value: 'ADD_STOCK', label: 'Add Stock', icon: Plus, color: 'var(--success)' },
  { value: 'REMOVE_STOCK', label: 'Remove Stock', icon: Minus, color: 'var(--danger)' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment', icon: RotateCcw, color: 'var(--info)' },
  { value: 'DAMAGED', label: 'Damaged / Write-off', icon: Trash2, color: 'var(--warning)' },
  { value: 'CUSTOMER_RETURN', label: 'Customer Return', icon: RotateCcw, color: 'var(--success)' },
]

const POSITIVE_TYPES = ['ADD_STOCK', 'INITIAL_STOCK', 'CUSTOMER_RETURN']

const MOVEMENT_LABELS = {
  ADD_STOCK: 'Stock Added',
  REMOVE_STOCK: 'Stock Removed',
  INITIAL_STOCK: 'Initial Stock',
  MANUAL_ADJUSTMENT: 'Manual Adjustment',
  DAMAGED: 'Damaged',
  CUSTOMER_RETURN: 'Customer Return',
  SALE: 'Sale',
}

const getStockStatus = (p) => {
  if (p.current_stock === 0) return { label: 'OUT OF STOCK', class: 'badge-danger', dot: 'var(--danger)' }
  if (p.current_stock <= p.min_stock_level) return { label: 'LOW STOCK', class: 'badge-warning', dot: 'var(--warning)' }
  return { label: 'IN STOCK', class: 'badge-success', dot: 'var(--success)' }
}

const formatProductType = (p) => {
  if (p?.categories?.name) return p.categories.name
  const type = p?.product_type || (typeof p === 'string' ? p : '')
  if (!type) return 'General'
  const known = {
    iphone_case: 'iPhone Case',
    samsung_case: 'Samsung Case',
    mobile_sticker: 'Mobile Sticker',
    accessories: 'Accessories',
  }
  if (known[type]) return known[type]
  return type.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ---- Stock Management Modal ----
const StockModal = ({ product, onClose, onSaved }) => {
  const { user } = useAuth()
  const [movementType, setMovementType] = useState('ADD_STOCK')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const config = MOVEMENT_TYPES.find(t => t.value === movementType)
  const isAddition = POSITIVE_TYPES.includes(movementType)
  const isAdjustment = movementType === 'MANUAL_ADJUSTMENT'

  const computeNewStock = () => {
    const qty = Number(quantity) || 0
    if (isAdjustment) return qty  // set absolute value
    return isAddition
      ? product.current_stock + qty
      : product.current_stock - qty
  }

  const newStock = computeNewStock()

  const handleSave = async () => {
    if (!quantity || Number(quantity) < 0) { toast.error('Enter a valid quantity'); return }
    if (movementType === 'REMOVE_STOCK' || movementType === 'DAMAGED') {
      if (Number(quantity) > product.current_stock) {
        toast.error(`Cannot remove more than current stock (${product.current_stock})`); return
      }
    }
    if (newStock < 0) { toast.error('Stock cannot go below 0'); return }

    setSaving(true)
    try {
      // Update product stock
      const { error: updateErr } = await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', product.id)

      if (updateErr) throw updateErr

      // Record movement
      const qty = isAdjustment
        ? newStock - product.current_stock  // record the delta
        : (isAddition ? Number(quantity) : -Number(quantity))

      const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)
      const validUserUuid = isValidUuid(user?.id) ? user.id : null

      const { error: movErr } = await supabase.from('inventory_movements').insert({
        product_id: product.id,
        movement_type: movementType,
        quantity: Math.abs(Number(quantity)),
        previous_stock: product.current_stock,
        new_stock: newStock,
        reason: reason.trim() || null,
        performed_by: validUserUuid,
      })

      if (movErr) throw movErr

      toast.success(`Stock updated: ${product.current_stock} → ${newStock}`)
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-title">Manage Stock</span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {product.name}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {/* Current Stock */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1, background: '#f9fafb', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Current Stock</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{product.current_stock}</div>
            </div>
            <div style={{ flex: 1, background: '#f9fafb', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>New Stock</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: newStock < 0 ? 'var(--danger)' : newStock <= product.min_stock_level ? 'var(--warning)' : 'var(--success)' }}>
                {quantity ? newStock : '—'}
              </div>
            </div>
          </div>

          {/* Movement Type */}
          <div className="form-group">
            <label className="form-label">Movement Type <span className="required">*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {MOVEMENT_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <label
                    key={t.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      border: `2px solid ${movementType === t.value ? 'var(--brand-black)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all var(--transition)',
                      background: movementType === t.value ? '#f9fafb' : 'white',
                    }}
                  >
                    <input
                      type="radio"
                      name="movement_type"
                      value={t.value}
                      checked={movementType === t.value}
                      onChange={() => setMovementType(t.value)}
                      style={{ display: 'none' }}
                    />
                    <Icon size={14} color={t.color} />
                    <span style={{ flex: 1 }}>{t.label}</span>
                    {movementType === t.value && <Check size={13} color="var(--brand-black)" />}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="form-group">
            <label className="form-label">
              {isAdjustment ? 'Set New Stock Total' : 'Quantity'} <span className="required">*</span>
            </label>
            <input
              type="number"
              className="form-input"
              placeholder={isAdjustment ? `Current: ${product.current_stock}` : "Enter quantity"}
              min="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              autoFocus
              id="stock-quantity-input"
            />
            {isAdjustment && (
              <div className="form-hint">Enter the new absolute stock total (not the change amount).</div>
            )}
          </div>

          {/* Reason */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Reason / Note</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Monthly restock, defective batch, store transfer..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!quantity || saving || newStock < 0}
            id="save-stock-btn"
          >
            {saving ? <><div className="btn-spinner" /> Saving...</> : <><Check size={14} /> Update Stock</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Movement History Modal ----
const HistoryModal = ({ product, onClose }) => {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('inventory_movements')
        .select(`*, profiles(full_name, email)`)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setMovements(data || [])
      setLoading(false)
    }
    fetchHistory()
  }, [product.id])

  const formatDate = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-title">Inventory History</span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {product.name} · {product.product_id}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div className="loading-overlay" style={{ minHeight: '100px' }}><div className="spinner" /></div>
          ) : movements.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <p style={{ margin: 0 }}>No movement history yet.</p>
            </div>
          ) : (
            movements.map(m => {
              const positive = POSITIVE_TYPES.includes(m.movement_type)
              return (
                <div key={m.id} className="movement-row">
                  <div
                    className="movement-icon"
                    style={{ background: positive ? 'var(--success-bg)' : 'var(--danger-bg)' }}
                  >
                    {positive
                      ? <Plus size={13} color="var(--success)" />
                      : <Minus size={13} color="var(--danger)" />}
                  </div>
                  <div className="movement-details">
                    <div className="movement-type">{MOVEMENT_LABELS[m.movement_type]}</div>
                    <div className="movement-meta">
                      {m.previous_stock} → {m.new_stock} units · {formatDate(m.created_at)}
                    </div>
                    {m.reason && <div className="movement-meta">"{m.reason}"</div>}
                    <div className="movement-meta" style={{ fontSize: '11px' }}>
                      by {m.profiles?.full_name || m.profiles?.email || 'System'}
                    </div>
                  </div>
                  <div className={`movement-qty ${positive ? 'positive' : 'negative'}`}>
                    {positive ? '+' : '-'}{m.quantity}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Main Inventory Page ----
const StatCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, onClick, active }) => (
  <div
    className="stat-card"
    onClick={onClick}
    style={{
      cursor: onClick ? 'pointer' : 'default',
      border: active ? '2px solid var(--brand-black)' : '1px solid var(--border)',
      transition: 'all 0.15s ease',
      background: active ? '#f9fafb' : '#ffffff',
    }}
  >
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

const Inventory = () => {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const [stockModal, setStockModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null)

  const [summaryData, setSummaryData] = useState({
    inventoryValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  })

  const fetchSummaryMetrics = async () => {
    const { data: allProds } = await supabase
      .from('products')
      .select('current_stock, selling_price, min_stock_level')
      .eq('approval_status', 'APPROVED')
      .eq('is_active', true)

    const list = allProds || []
    const inventoryValue = list.reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.selling_price || 0), 0)
    const lowStockCount = list.filter(p => Number(p.current_stock || 0) > 0 && Number(p.current_stock || 0) <= Number(p.min_stock_level || 5)).length
    const outOfStockCount = list.filter(p => Number(p.current_stock || 0) === 0).length

    setSummaryData({
      inventoryValue,
      lowStockCount,
      outOfStockCount,
    })
  }

  const fetchInventory = async () => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(`*, categories(name), subcategories(name), product_images(public_url, is_primary)`, { count: 'exact' })
      .eq('approval_status', 'APPROVED')
      .eq('is_active', true)

    if (search) {
      query = query.or(`name.ilike.%${search}%,product_id.ilike.%${search}%,mobile_model.ilike.%${search}%,mobile_brand.ilike.%${search}%`)
    }
    if (typeFilter) {
      query = query.or(`category_id.eq.${typeFilter},product_type.eq.${typeFilter}`)
    }
    if (stockFilter === 'out') query = query.eq('current_stock', 0)
    if (stockFilter === 'low') query = query.gt('current_stock', 0)

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query
    let filtered = data || []

    // Client-side low/in-stock filtering
    if (stockFilter === 'low') {
      filtered = filtered.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_level)
    } else if (stockFilter === 'in') {
      filtered = filtered.filter(p => p.current_stock > p.min_stock_level)
    }

    setProducts(filtered)
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []))
    fetchSummaryMetrics()
  }, [])

  useEffect(() => { fetchInventory() }, [search, typeFilter, stockFilter, sortField, sortDir, page])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const getPrimaryImage = (images) =>
    images?.find(i => i.is_primary)?.public_url || images?.[0]?.public_url || null

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Inventory</div>
          <div className="section-subtitle">{total} approved products tracked</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { fetchInventory(); fetchSummaryMetrics() }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Inventory Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard
          icon={TrendingUp}
          label="Inventory Value"
          value={'₹' + Number(summaryData.inventoryValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          sub="Valuation at selling price"
          iconBg="#ecfdf5"
          iconColor="#10b981"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={summaryData.lowStockCount}
          sub="At or below threshold"
          iconBg="#fffbeb"
          iconColor="#f59e0b"
          active={stockFilter === 'low'}
          onClick={() => {
            setStockFilter(prev => prev === 'low' ? '' : 'low')
            setPage(1)
          }}
        />
        <StatCard
          icon={XCircle}
          label="Out of Stock"
          value={summaryData.outOfStockCount}
          sub="Requires immediate reorder"
          iconBg="#fef2f2"
          iconColor="#ef4444"
          active={stockFilter === 'out'}
          onClick={() => {
            setStockFilter(prev => prev === 'out' ? '' : 'out')
            setPage(1)
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, ID, model, brand..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            id="inventory-search"
          />
        </div>
        <select className="filter-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="filter-select" value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(1) }}>
          <option value="">All Stock</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={24} /></div>
            <h3>No products found</h3>
            <p>Approved products will appear here. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>Image</th>
                    <th onClick={() => handleSort('product_id')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>ID <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('name')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Product <ArrowUpDown size={11} /></span>
                    </th>
                    <th>Type</th>
                    <th>Brand / Model</th>
                    <th onClick={() => handleSort('selling_price')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Price <ArrowUpDown size={11} /></span>
                    </th>
                    <th>GST</th>
                    <th onClick={() => handleSort('current_stock')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Stock <ArrowUpDown size={11} /></span>
                    </th>
                    <th>Status</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const imgUrl = getPrimaryImage(p.product_images)
                    const status = getStockStatus(p)
                    return (
                      <tr key={p.id}>
                        <td>
                          <ProductImageHover src={imgUrl} title={p.name} alt={p.name} size={40} />
                        </td>
                        <td>
                          <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                            {p.product_id}
                          </code>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>
                            {p.name}
                          </div>
                          {p.categories?.name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 1 }}>
                              {p.categories.name}{p.subcategories?.name ? ` › ${p.subcategories.name}` : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="product-type-tag">{formatProductType(p)}</span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {p.mobile_brand && <div style={{ fontWeight: 500 }}>{p.mobile_brand}</div>}
                          {p.mobile_model && (
                            <div
                              style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}
                              title={p.mobile_model}
                            >
                              {p.mobile_model.split(',').length > 2
                                ? `${p.mobile_model.split(',').slice(0, 2).join(', ')} (+${p.mobile_model.split(',').length - 2} more)`
                                : p.mobile_model}
                            </div>
                          )}
                          {!p.mobile_brand && !p.mobile_model && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          ₹{Number(p.selling_price).toLocaleString('en-IN')}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {p.gst_percentage}%
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.dot, flexShrink: 0 }} />
                            <span style={{ fontWeight: 800, fontSize: '15px' }}>{p.current_stock}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            min {p.min_stock_level}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${status.class}`}>{status.label}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setStockModal(p)}
                              title="Manage stock"
                              id={`manage-stock-${p.id}`}
                            >
                              <Plus size={12} /> Stock
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setHistoryModal(p)}
                              title="View history"
                            >
                              <History size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
                    return (
                      <button key={pg} className={`pagination-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
                    )
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

      {/* Modals */}
      {stockModal && (
        <StockModal
          product={stockModal}
          onClose={() => setStockModal(null)}
          onSaved={() => { setStockModal(null); fetchInventory() }}
        />
      )}
      {historyModal && (
        <HistoryModal product={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  )
}

export default Inventory
