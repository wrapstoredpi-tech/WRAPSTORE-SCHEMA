// ============================================================
// WRAPSTORE — ONLINE SALES (Manual Channel Logging)
// Logs sales made via Amazon, Flipkart, Instagram, WhatsApp, Other.
// Website orders are handled separately via the Online Orders page
// (they flow automatically through invoices with channel='website').
// All reads/writes go through Supabase — no localStorage fallback.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  ShoppingBag, Plus, Search, RefreshCw, Trash2,
  AlertCircle, CheckCircle2, Package, TrendingUp,
  Calendar, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Website is intentionally excluded — those orders flow automatically
// via invoices.channel='website' through the Online Orders page.
const CHANNELS = [
  { id: 'amazon',    label: 'Amazon',    color: '#ff9900', bg: '#fff8f0' },
  { id: 'flipkart',  label: 'Flipkart',  color: '#2874f0', bg: '#f0f5ff' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c', bg: '#fff0f5' },
  { id: 'whatsapp',  label: 'WhatsApp',  color: '#25d366', bg: '#f0fff5' },
  { id: 'other',     label: 'Other',     color: '#6b7280', bg: '#f9fafb' },
]

const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.id, c]))

// ---- Log Sale Form ----
const LogSaleForm = ({ onSaved }) => {
  const { user } = useAuth()
  const [channel, setChannel] = useState('amazon')
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)

  // Product search
  useEffect(() => {
    if (!productQuery || productQuery.length < 2) { setProductResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('products')
        .select('id, product_id, name, product_type, mobile_brand, mobile_model, selling_price, current_stock')
        .eq('approval_status', 'APPROVED')
        .eq('is_active', true)
        .or(`name.ilike.%${productQuery}%,product_id.ilike.%${productQuery}%,mobile_model.ilike.%${productQuery}%`)
        .limit(8)
      setProductResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [productQuery])

  const selectProduct = (p) => {
    setSelectedProduct(p)
    setUnitPrice(String(p.selling_price))
    setProductQuery(p.name)
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
      const { error: saleErr } = await supabase
        .from('online_sales')
        .insert({
          product_id:    selectedProduct.id,
          quantity,
          channel,
          unit_price:    parseFloat(unitPrice),
          total_amount:  totalAmount,
          customer_name: customerName.trim() || null,
          notes:         notes.trim() || null,
          sale_date:     saleDate,
          created_by:    user?.id ?? null,
        })

      if (saleErr) throw saleErr

      // 2. Atomic stock deduction via DB function (race-condition safe)
      const { data: deductResult, error: rpcErr } = await supabase.rpc('deduct_stock', {
        p_product_id:   selectedProduct.id,
        p_quantity:     quantity,
        p_channel:      channel.toUpperCase(),   // e.g. 'AMAZON'
        p_reference_id: `${channel}-manual`,
        p_performed_by: user?.id ?? null,
      })

      if (rpcErr) {
        // Stock deduction failed — log warning but don't block the sale record
        console.warn('Stock deduction warning:', rpcErr.message)
        toast.success(`Sale logged for ${CHANNEL_MAP[channel]?.label}!`)
        toast(`⚠ Stock deduction may need manual adjustment: ${rpcErr.message}`, { icon: '⚠️' })
      } else if (!deductResult?.success) {
        toast.success(`Sale logged for ${CHANNEL_MAP[channel]?.label}!`)
        toast(`⚠ Stock: ${deductResult?.error || 'Check inventory manually'}`, { icon: '⚠️' })
      } else {
        toast.success(
          `Sale logged! Stock: ${deductResult.previous_stock} → ${deductResult.new_stock}`
        )
      }

      // Note: inventory_movements.channel is set automatically by deduct_stock() RPC
      // which uses movement_type ONLINE_SALE. The channel column will be updated when
      // the deduct_stock() function is extended to accept a channel param in a future
      // migration. For now, the online_sales table records the channel accurately.

      // Reset form
      setSelectedProduct(null)
      setProductQuery('')
      setQuantity(1)
      setUnitPrice('')
      setCustomerName('')
      setNotes('')
      setSaleDate(new Date().toISOString().slice(0, 10))
      onSaved()
    } catch (err) {
      toast.error('Failed to log sale: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const cfg = CHANNEL_MAP[channel]

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Log a Manual Channel Sale</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          For Amazon, Flipkart, Instagram, WhatsApp, or Other
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
        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
          <label className="form-label">Product <span className="required">*</span></label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search product name, ID or model..."
              value={productQuery}
              onChange={e => { setProductQuery(e.target.value); setSelectedProduct(null) }}
            />
            {searching && <div className="spinner-sm" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} />}
          </div>
          {productResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'white', border: '1.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
              maxHeight: 260, overflowY: 'auto', marginTop: 4,
            }}>
              {productResults.map(p => (
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
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{p.product_id}</code>
                      {p.mobile_model && <span style={{ marginLeft: 6 }}>{p.mobile_model}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700 }}>{INR(p.selling_price)}</div>
                    <div style={{ fontSize: 11, color: p.current_stock <= 5 ? 'var(--warning)' : 'var(--success)' }}>
                      {p.current_stock} in stock
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quantity + Price */}
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
            border: `1px solid ${cfg?.color || 'var(--border)'}22`,
            borderRadius: 'var(--radius)', padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Sale Amount</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: cfg?.color || 'var(--text-primary)' }}>{INR(totalAmount)}</span>
          </div>
        )}

        {/* Customer + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Name (optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Rajan Kumar"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sale Date</label>
            <input
              type="date"
              className="form-input"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Notes (optional)</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Order ID, tracking number, remarks..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button
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
      .select('*, products(name, product_id, mobile_model)')
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
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Online Sales Log</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Manual entries for Amazon, Flipkart, Instagram, WhatsApp & Other
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
              <h3>No {channelFilter !== 'ALL' ? CHANNEL_MAP[channelFilter]?.label : ''} Sales Logged</h3>
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
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => {
                    const chCfg = CHANNEL_MAP[s.channel] || CHANNEL_MAP.other
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
                            {s.products?.name || '—'}
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
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.notes || '—'}
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
