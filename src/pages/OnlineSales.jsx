// ============================================================
// WRAPSTORE — ONLINE SALES (Manual Channel Logging)
// Logs sales made via Instagram, WhatsApp, Other.
// Website orders are handled separately via the Online Orders page
// (they flow automatically through invoices with channel='website').
// All reads/writes go through Supabase — no localStorage fallback.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShoppingBag, Plus, Search, RefreshCw, Trash2,
  CheckCircle2, Package, TrendingUp, Calendar, X, Phone, User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { updateCombosAfterProductStockChange } from '../lib/comboSync'
import { getFormattedProductName } from '../lib/productUtils'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Active channels for manual sales (Instagram, WhatsApp, Other)
const CHANNELS = [
  { id: 'instagram', label: 'Instagram', color: '#e1306c', bg: '#fff0f5' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', bg: '#f0fff5' },
  { id: 'other', label: 'Other', color: '#6b7280', bg: '#f9fafb' },
]

// All channels map (including legacy amazon/flipkart so existing records render cleanly)
const CHANNEL_MAP = {
  instagram: { id: 'instagram', label: 'Instagram', color: '#e1306c', bg: '#fff0f5' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', bg: '#f0fff5' },
  other: { id: 'other', label: 'Other', color: '#6b7280', bg: '#f9fafb' },
  amazon: { id: 'amazon', label: 'Amazon', color: '#ff9900', bg: '#fff8f0' },
  flipkart: { id: 'flipkart', label: 'Flipkart', color: '#2874f0', bg: '#f0f5ff' },
}

// ---- Log Sale Form ----
const LogSaleForm = ({ onSaved }) => {
  const { user } = useAuth()
  const [channel, setChannel] = useState('instagram')
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchContainerRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setProductResults([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Product search function
  const searchProducts = useCallback(async (query) => {
    const q = (query || '').trim()
    setSearching(true)
    try {
      let req = supabase
        .from('products')
        .select('id, product_id, name, product_type, mobile_brand, mobile_model, color_variants, selling_price, current_stock, product_images(public_url, is_primary)')
        .eq('approval_status', 'APPROVED')
        .eq('is_active', true)

      if (q) {
        req = req.or(`name.ilike.%${q}%,product_id.ilike.%${q}%,mobile_model.ilike.%${q}%,mobile_brand.ilike.%${q}%,color_variants.ilike.%${q}%`)
      }

      const { data, error } = await req.order('created_at', { ascending: false }).limit(10)

      if (error) {
        console.warn('Product search error:', error)
        // Fallback simple search
        const { data: fbData } = await supabase
          .from('products')
          .select('id, product_id, name, product_type, mobile_brand, mobile_model, color_variants, selling_price, current_stock')
          .eq('is_active', true)
          .ilike('name', `%${q}%`)
          .limit(10)
        setProductResults(fbData || [])
      } else {
        setProductResults(data || [])
      }
    } catch (err) {
      console.error('Failed to search products:', err)
      setProductResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  // Search when typing
  useEffect(() => {
    const q = productQuery.trim()
    if (!q) {
      setProductResults([])
      return
    }

    // Don't search if the input matches already selected product
    if (selectedProduct && (getFormattedProductName(selectedProduct) || selectedProduct.name) === productQuery) {
      return
    }

    const t = setTimeout(() => {
      searchProducts(q)
    }, 200)

    return () => clearTimeout(t)
  }, [productQuery, selectedProduct, searchProducts])

  // Also load products when user focuses empty input
  const handleInputFocus = () => {
    if (!selectedProduct && productResults.length === 0) {
      searchProducts(productQuery)
    }
  }

  const selectProduct = (p) => {
    setSelectedProduct(p)
    setUnitPrice(String(p.selling_price || ''))
    setProductQuery(getFormattedProductName(p) || p.name)
    setProductResults([])
  }

  const clearSelectedProduct = () => {
    setSelectedProduct(null)
    setProductQuery('')
    setUnitPrice('')
    setProductResults([])
  }

  const totalAmount = (parseFloat(unitPrice) || 0) * quantity

  const handleSave = async () => {
    if (!selectedProduct) { toast.error('Select a product first.'); return }
    if (quantity < 1) { toast.error('Quantity must be at least 1.'); return }
    if (!unitPrice || parseFloat(unitPrice) <= 0) { toast.error('Enter a valid unit price.'); return }

    setSaving(true)
    try {
      // 1. Insert the online_sales record
      const payload = {
        product_id: selectedProduct.id,
        quantity,
        channel,
        unit_price: parseFloat(unitPrice),
        total_amount: totalAmount,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        notes: customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : null,
        sale_date: saleDate,
        created_by: user?.id ?? null,
      }

      let { error: saleErr } = await supabase
        .from('online_sales')
        .insert(payload)

      // Graceful fallback if customer_phone column is not yet created in Supabase table
      if (saleErr && (saleErr.message?.includes('customer_phone') || saleErr.code === '42703')) {
        console.warn('customer_phone column missing on online_sales, inserting fallback without it:', saleErr)
        const { customer_phone, ...fallbackPayload } = payload
        const { error: fbErr } = await supabase.from('online_sales').insert(fallbackPayload)
        if (fbErr) throw fbErr
      } else if (saleErr) {
        throw saleErr
      }

      // 2. Atomic stock deduction via DB function (race-condition safe)
      const { data: deductResult, error: rpcErr } = await supabase.rpc('deduct_stock', {
        p_product_id: selectedProduct.id,
        p_quantity: quantity,
        p_channel: channel.toUpperCase(),   // e.g. 'INSTAGRAM', 'WHATSAPP'
        p_reference_id: `${channel}-manual`,
        p_performed_by: user?.id ?? null,
      })

      if (rpcErr) {
        console.warn('Stock deduction warning:', rpcErr.message)
        toast.success(`Sale logged for ${CHANNEL_MAP[channel]?.label}!`)
        toast(`⚠ Stock deduction: ${rpcErr.message}`, { icon: '⚠️' })
      } else if (!deductResult?.success) {
        toast.success(`Sale logged for ${CHANNEL_MAP[channel]?.label}!`)
        toast(`⚠ Stock: ${deductResult?.error || 'Check inventory manually'}`, { icon: '⚠️' })
      } else {
        toast.success(
          `Sale logged! Stock: ${deductResult.previous_stock} → ${deductResult.new_stock}`
        )
      }

      // Auto-update allotted_qty for any combos that include this product
      if (selectedProduct?.id) {
        try {
          await updateCombosAfterProductStockChange([selectedProduct.id], supabase)
        } catch (comboErr) {
          console.warn('Notice syncing combo stock after online sale:', comboErr)
        }
      }

      // Reset form
      setSelectedProduct(null)
      setProductQuery('')
      setQuantity(1)
      setUnitPrice('')
      setCustomerName('')
      setCustomerPhone('')
      setSaleDate(new Date().toISOString().slice(0, 10))
      onSaved()
    } catch (err) {
      toast.error('Failed to log sale: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const cfg = CHANNEL_MAP[channel] || CHANNEL_MAP.instagram

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Log a Manual Channel Sale</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          For Instagram, WhatsApp, or Other
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Channel selector */}
        <div>
          <label className="form-label">Channel</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius)',
                  border: `2px solid ${channel === ch.id ? ch.color : 'var(--border)'}`,
                  background: channel === ch.id ? ch.bg : 'white',
                  color: channel === ch.id ? ch.color : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                  fontFamily: 'inherit',
                }}
              >
                {ch.label}
                {channel === ch.id && <CheckCircle2 size={11} style={{ marginLeft: 5 }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Product search */}
        <div ref={searchContainerRef} className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
          <label className="form-label">Product <span className="required">*</span></label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34, paddingRight: selectedProduct ? 30 : 12 }}
              placeholder="Type product name, ID, or model..."
              value={productQuery}
              onChange={e => {
                setProductQuery(e.target.value)
                if (selectedProduct) setSelectedProduct(null)
              }}
              onFocus={handleInputFocus}
              autoComplete="off"
            />
            {searching ? (
              <div className="spinner-sm" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} />
            ) : selectedProduct ? (
              <button
                type="button"
                onClick={clearSelectedProduct}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 2,
                }}
                title="Clear selected product"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Search Results Dropdown */}
          {productResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'white', border: '1.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
              maxHeight: 280, overflowY: 'auto', marginTop: 4,
            }}>
              {productResults.map(p => {
                const displayName = getFormattedProductName(p) || p.name
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>{p.product_id}</code>
                        {p.mobile_model && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{p.mobile_model}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700 }}>{INR(p.selling_price)}</div>
                      <div style={{ fontSize: 11, color: p.current_stock <= 5 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                        {p.current_stock} in stock
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Selected Product Confirmation Chip */}
          {selectedProduct && (
            <div style={{
              marginTop: 6,
              padding: '8px 12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: '#166534' }}>
                    {getFormattedProductName(selectedProduct) || selectedProduct.name}
                  </span>
                  <span style={{ color: '#6b7280', marginLeft: 6 }}>
                    ({selectedProduct.product_id} · {selectedProduct.current_stock} in stock)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quantity + Unit Price */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Quantity <span className="required">*</span></label>
            <input
              type="number" min={1}
              className="form-input"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Unit Price (₹) <span className="required">*</span></label>
            <input
              type="number" min={0} step="0.01"
              className="form-input"
              value={unitPrice}
              onChange={e => setUnitPrice(e.target.value)}
              placeholder="e.g. 299.00"
            />
          </div>
        </div>

        {/* Total preview */}
        {totalAmount > 0 && (
          <div style={{
            background: cfg?.bg || '#f9fafb',
            border: `1px solid ${cfg?.color || 'var(--border)'}33`,
            borderRadius: 'var(--radius)', padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Sale Amount</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: cfg?.color || 'var(--text-primary)' }}>{INR(totalAmount)}</span>
          </div>
        )}

        {/* Customer Name + Mobile Number */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Name</label>
            <input
              className="form-input"
              placeholder="e.g. Rajan Kumar"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mobile Number</label>
            <input
              type="tel"
              className="form-input"
              placeholder="e.g. +91 98765 43210"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Sale Date */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Sale Date</label>
          <input
            type="date"
            className="form-input"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ justifyContent: 'center' }}
          onClick={handleSave}
          disabled={saving || !selectedProduct || quantity < 1 || !unitPrice}
        >
          {saving
            ? <><div className="btn-spinner" /> Saving...</>
            : <><Plus size={15} /> Log {cfg?.label} Sale — {INR(totalAmount)}</>
          }
        </button>
      </div>
    </div>
  )
}

// ====================================================
// MAIN PAGE
// ====================================================
const OnlineSales = () => {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState('ALL')
  const [stats, setStats] = useState({ total: 0, revenue: 0, today: 0 })

  const fetchSales = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('online_sales')
      .select('*, products(name, product_id, mobile_model, color_variants)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (channelFilter !== 'ALL') {
      q = q.eq('channel', channelFilter)
    }

    const { data, error } = await q
    if (error) {
      toast.error('Failed to load sales: ' + error.message)
    } else {
      setSales(data || [])

      const today = new Date().toISOString().slice(0, 10)
      const todaySales = (data || []).filter(s => s.sale_date === today)
      setStats({
        total: (data || []).length,
        revenue: (data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0),
        today: todaySales.length,
      })
    }
    setLoading(false)
  }, [channelFilter])

  useEffect(() => { fetchSales() }, [fetchSales])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sale record? Stock will NOT be restored automatically.')) return
    const { error } = await supabase.from('online_sales').delete().eq('id', id)
    if (error) {
      toast.error('Delete failed: ' + error.message)
    } else {
      toast.success('Sale record deleted.')
      fetchSales()
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingBag size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Manual Sales Log</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Manual entries for Instagram, WhatsApp
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchSales} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Entries', value: stats.total, color: '#6366f1', bg: '#f5f3ff', icon: Package },
          { label: 'Today\'s Entries', value: stats.today, color: '#2563eb', bg: '#eff6ff', icon: Calendar },
          { label: 'Total Revenue', value: INR(stats.revenue), color: '#16a34a', bg: '#dcfce7', icon: TrendingUp },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{
            background: 'white', border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Log form */}
        <div>
          <LogSaleForm onSaved={fetchSales} />
        </div>

        {/* Right: Sales history */}
        <div>
          {/* Channel filter */}
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12,
            background: 'white', border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 6,
          }}>
            {[{ id: 'ALL', label: 'All Channels' }, ...CHANNELS].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setChannelFilter(id)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--radius)',
                  border: 'none',
                  background: channelFilter === id ? 'var(--brand-black)' : 'transparent',
                  color: channelFilter === id ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  transition: 'all var(--transition)', fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div className="spinner" />
            </div>
          ) : sales.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 0' }}>
              <div className="empty-state-icon"><ShoppingBag size={26} /></div>
              <h3>No {channelFilter !== 'ALL' ? (CHANNEL_MAP[channelFilter]?.label || channelFilter) : ''} Sales Logged</h3>
              <p>Use the form to log manual channel sales.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Channel</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => {
                    const chCfg = CHANNEL_MAP[s.channel] || CHANNEL_MAP.other
                    const prodName = getFormattedProductName(s.products) || s.products?.name || '—'
                    const displayPhone = s.customer_phone || (s.notes?.startsWith('Phone: ') ? s.notes.replace('Phone: ', '') : s.notes) || '—'
                    return (
                      <tr key={s.id}>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(s.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px',
                            borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: chCfg.bg, color: chCfg.color,
                          }}>
                            {chCfg.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {prodName}
                          </div>
                          {s.products?.product_id && (
                            <code style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
                              {s.products.product_id}
                            </code>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.quantity}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{INR(s.unit_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{INR(s.total_amount)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.customer_name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {displayPhone}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleDelete(s.id)}
                            style={{ color: 'var(--danger)' }}
                            title="Delete sale record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnlineSales
