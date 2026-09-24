import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe, Package, Clock, CheckCircle2, XCircle, Truck,
  AlertCircle, RefreshCw, ChevronDown, ChevronUp, Phone,
  User, MapPin, CreditCard, FileText, Eye, ShoppingBag,
  ArrowRight, Banknote, Wifi
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { downloadInvoicePDF, getInvoicePDFBlob } from '../lib/invoicePdf'
import { sendWhatsAppInvoice } from '../services/whatsappService'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_CONFIG = {
  PENDING:          { label: 'Pending',           color: '#d97706', bg: '#fef3c7', border: '#fcd34d', icon: Clock },
  CONFIRMED:        { label: 'Confirmed',          color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: CheckCircle2 },
  PROCESSING:       { label: 'Processing',         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: Package },
  READY_FOR_PICKUP: { label: 'Ready for Pickup',   color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: ShoppingBag },
  SHIPPED:          { label: 'Shipped',            color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc', icon: Truck },
  DELIVERED:        { label: 'Delivered',          color: '#16a34a', bg: '#dcfce7', border: '#86efac', icon: CheckCircle2 },
  CANCELLED:        { label: 'Cancelled',          color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
  RETURNED:         { label: 'Returned',           color: '#9d174d', bg: '#fdf2f8', border: '#fbcfe8', icon: XCircle },
}

const PAYMENT_STATUS_CONFIG = {
  PENDING:   { label: 'Unpaid',          color: '#d97706' },
  PAID:      { label: 'Paid',            color: '#16a34a' },
  FAILED:    { label: 'Payment Failed',  color: '#dc2626' },
  REFUNDED:  { label: 'Refunded',        color: '#7c3aed' },
}

const STATUS_TRANSITIONS = {
  PENDING:          ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:        ['PROCESSING', 'CANCELLED'],
  PROCESSING:       ['READY_FOR_PICKUP', 'SHIPPED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  SHIPPED:          ['DELIVERED', 'CANCELLED'],
  DELIVERED:        ['RETURNED'],
  CANCELLED:        [],
  RETURNED:         [],
}

// ---- Status Badge ----
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontSize: 11, fontWeight: 700,
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ---- Order Card ----
const OrderCard = ({ order, onStatusChange, onGenerateInvoice, onViewDetails, generating }) => {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const nextStatuses = STATUS_TRANSITIONS[order.order_status] || []
  const cfg = STATUS_CONFIG[order.order_status]

  const handleStatus = async (newStatus) => {
    setUpdating(true)
    await onStatusChange(order.id, newStatus, order)
    setUpdating(false)
  }

  return (
    <div style={{
      background: 'white',
      border: `1.5px solid ${cfg?.border || 'var(--border)'}`,
      borderLeft: `4px solid ${cfg?.color || 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: 'box-shadow var(--transition)',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Order number + channel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 6, padding: '3px 8px',
            display: 'flex', alignItems: 'center', gap: 5,
            flexShrink: 0,
          }}>
            <Globe size={11} color="#16a34a" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {order.source || 'WEBSITE'}
            </span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{order.order_number}</span>
          {order.invoice_id && (
            <span style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 6, padding: '2px 7px',
              fontSize: 10, fontWeight: 700, color: '#1d4ed8',
            }}>
              ✓ Invoice Created
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Status + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <StatusBadge status={order.order_status} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setExpanded(v => !v)}
            style={{ border: '1.5px solid var(--border)' }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Quick info row */}
      <div style={{
        padding: '0 18px 12px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <User size={13} color="var(--text-muted)" />
          <span style={{ fontWeight: 600 }}>{order.customer_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Phone size={13} color="var(--text-muted)" />
          <span>{order.customer_phone}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {PAYMENT_STATUS_CONFIG[order.payment_status]?.label}
          </span>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: PAYMENT_STATUS_CONFIG[order.payment_status]?.color || '#9ca3af',
            display: 'inline-block',
          }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{INR(order.grand_total)}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {nextStatuses.map(ns => {
            const nextCfg = STATUS_CONFIG[ns]
            const isCancel = ns === 'CANCELLED'
            return (
              <button
                key={ns}
                className={`btn btn-sm ${isCancel ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => handleStatus(ns)}
                disabled={updating}
                style={{ fontSize: 12 }}
              >
                {updating ? <div className="btn-spinner" /> : <ArrowRight size={11} />}
                {nextCfg?.label}
              </button>
            )
          })}

          {/* Generate Invoice — only if payment confirmed and no invoice yet */}
          {order.payment_status === 'PAID' && !order.invoice_id && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onGenerateInvoice(order)}
              disabled={generating === order.id}
              style={{ fontSize: 12 }}
            >
              {generating === order.id
                ? <><div className="btn-spinner" /> Generating...</>
                : <><FileText size={11} /> Generate Invoice</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '14px 18px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Items */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Order Items ({order.online_order_items?.length || 0})
            </div>
            {(order.online_order_items || []).map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                  {item.mobile_brand && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.mobile_brand} {item.mobile_model}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{INR(item.line_total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.quantity} × {INR(item.unit_price)}
                    {item.discount_pct > 0 && ` (−${item.discount_pct}%)`}
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              {[
                ['Subtotal', INR(order.subtotal)],
                order.discount_amount > 0 ? ['Discount', '− ' + INR(order.discount_amount)] : null,
                ['GST', INR(order.gst_amount)],
                order.shipping_amount > 0 ? ['Shipping', INR(order.shipping_amount)] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span>Grand Total</span><span>{INR(order.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Customer + Shipping */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Customer</div>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Phone size={11} color="var(--text-muted)" />
                  {order.customer_phone}
                </div>
                {order.customer_email && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{order.customer_email}</div>
                )}
              </div>
            </div>
            {order.shipping_address && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Ship To</div>
                <div style={{ fontSize: 12, display: 'flex', gap: 6, color: 'var(--text-secondary)' }}>
                  <MapPin size={11} style={{ marginTop: 2, flexShrink: 0 }} color="var(--text-muted)" />
                  {order.shipping_address}
                </div>
              </div>
            )}
          </div>

          {/* Payment info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <CreditCard size={12} />
            <span>Payment: <strong>{order.payment_method}</strong></span>
            {order.payment_reference && <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{order.payment_reference}</span>}
          </div>

          {order.notes && (
            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#856404' }}>
              📝 {order.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ====================================================
// MAIN PAGE
// ====================================================
const OnlineOrders = () => {
  const { user, profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [store, setStore] = useState(null)
  const [generatingInvoice, setGeneratingInvoice] = useState(null)
  const [stats, setStats] = useState({ pending: 0, today: 0, revenue: 0 })

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('online_orders')
      .select('*, online_order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (statusFilter !== 'ALL') {
      q = q.eq('order_status', statusFilter)
    }

    const { data, error } = await q
    if (error) {
      toast.error('Failed to load online orders: ' + error.message)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }, [statusFilter])

  const fetchStats = useCallback(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: pendingCount } = await supabase
      .from('online_orders')
      .select('*', { count: 'exact', head: true })
      .in('order_status', ['PENDING', 'CONFIRMED', 'PROCESSING'])

    const { data: todayOrders } = await supabase
      .from('online_orders')
      .select('grand_total')
      .gte('created_at', today.toISOString())
      .not('order_status', 'in', '(CANCELLED,RETURNED)')

    setStats({
      pending: pendingCount || 0,
      today: todayOrders?.length || 0,
      revenue: todayOrders?.reduce((s, o) => s + Number(o.grand_total || 0), 0) || 0,
    })
  }, [])

  useEffect(() => {
    supabase.from('store_settings').select('*').limit(1).single().then(({ data }) => setStore(data))
    fetchStats()
  }, [fetchStats])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('online-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_orders' }, () => {
        fetchOrders()
        fetchStats()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders, fetchStats])

  const handleStatusChange = async (orderId, newStatus, order) => {
    // If cancelling, release reserved stock
    if (newStatus === 'CANCELLED') {
      const items = order.online_order_items || []
      for (const item of items) {
        if (item.product_id) {
          await supabase.rpc('release_reserved_stock', {
            p_product_id:   item.product_id,
            p_quantity:     item.quantity,
            p_reference_id: orderId,
          })
        }
      }
    }

    const { error } = await supabase
      .from('online_orders')
      .update({ order_status: newStatus })
      .eq('id', orderId)

    if (error) {
      toast.error('Status update failed: ' + error.message)
    } else {
      toast.success(`Order ${order.order_number} → ${STATUS_CONFIG[newStatus]?.label}`)
      fetchOrders()
      fetchStats()
    }
  }

  const handleGenerateInvoice = async (order) => {
    setGeneratingInvoice(order.id)
    try {
      const cleanPhone = order.customer_phone

      // 1. Find or create customer
      let customerId = order.customer_id
      if (!customerId) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', cleanPhone)
          .single()

        if (existing) {
          customerId = existing.id
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert({ name: order.customer_name, phone: cleanPhone, email: order.customer_email })
            .select()
            .single()
          if (custErr) throw custErr
          customerId = newCust.id
        }
      }

      // 2. Create Invoice
      const invoiceNum = `WS-INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number:   invoiceNum,
          customer_id:      customerId,
          customer_name:    order.customer_name,
          customer_phone:   cleanPhone,
          subtotal:         order.subtotal,
          discount_amount:  order.discount_amount,
          taxable_amount:   Number(order.subtotal) - Number(order.discount_amount),
          gst_amount:       order.gst_amount,
          grand_total:      order.grand_total,
          payment_method:   order.payment_method === 'COD' ? 'Cash' : 'Other',
          payment_status:   'PAID',
          notes:            order.notes || null,
          created_by:       user?.id,
          sale_channel:     'ONLINE',
          online_order_id:  order.id,
        })
        .select()
        .single()
      if (invErr) throw invErr

      // 3. Create Invoice Items + deduct stock atomically
      const items = order.online_order_items || []
      const invoiceItemsPayload = items.map(item => ({
        invoice_id:      invoice.id,
        product_id:      item.product_id,
        product_id_code: item.product_id_code || '',
        product_name:    item.product_name,
        product_type:    item.product_type || 'general',
        mobile_brand:    item.mobile_brand || null,
        mobile_model:    item.mobile_model || null,
        quantity:        item.quantity,
        unit_price:      item.unit_price,
        discount_pct:    item.discount_pct || 0,
        gst_pct:         item.gst_pct || 0,
        line_total:      item.line_total,
      }))

      const { error: itemsErr } = await supabase.from('invoice_items').insert(invoiceItemsPayload)
      if (itemsErr) throw itemsErr

      // 4. Atomic stock deduction for each item
      const stockErrors = []
      for (const item of items) {
        if (!item.product_id) continue
        const { data: res, error: rpcErr } = await supabase.rpc('deduct_stock', {
          p_product_id:   item.product_id,
          p_quantity:     item.quantity,
          p_channel:      'ONLINE',
          p_reference_id: invoice.id,
          p_performed_by: user?.id ?? null,
        })
        if (rpcErr || !res?.success) {
          stockErrors.push(item.product_name)
        }
      }

      if (stockErrors.length > 0) {
        toast.error(`⚠ Some stock could not be deducted: ${stockErrors.join(', ')}. Check inventory.`)
      }

      // 5. Link invoice to online order
      await supabase.from('online_orders').update({ invoice_id: invoice.id }).eq('id', order.id)

      // 6. Try WhatsApp
      try {
        await sendWhatsAppInvoice({
          invoice,
          pdfUrl: null,
          customerPhone: cleanPhone,
          grandTotal: order.grand_total,
          customerId,
        })
      } catch (_) {}

      toast.success(`Invoice ${invoiceNum} created for online order ${order.order_number}!`)
      fetchOrders()
    } catch (err) {
      toast.error('Invoice generation failed: ' + err.message)
    } finally {
      setGeneratingInvoice(null)
    }
  }

  const FILTER_TABS = [
    { key: 'ALL', label: 'All Orders' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'READY_FOR_PICKUP', label: 'Ready' },
    { key: 'SHIPPED', label: 'Shipped' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Online Orders</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Manage orders placed on the WrapStore website
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#16a34a', fontWeight: 600,
            }}>
              <Wifi size={11} /> Live
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchOrders} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Action Required', value: stats.pending, color: '#d97706', bg: '#fef3c7', icon: AlertCircle, desc: 'Pending / Confirmed / Processing' },
          { label: 'Orders Today', value: stats.today, color: '#2563eb', bg: '#eff6ff', icon: Globe, desc: 'Excluding cancelled' },
          { label: 'Revenue Today', value: INR(stats.revenue), color: '#16a34a', bg: '#dcfce7', icon: ShoppingBag, desc: 'From online channel' },
        ].map(({ label, value, color, bg, icon: Icon, desc }) => (
          <div key={label} style={{
            background: 'white', border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16,
        background: 'white', border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 6,
      }}>
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: statusFilter === key ? 'var(--brand-black)' : 'transparent',
              color: statusFilter === key ? 'white' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all var(--transition)',
              fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Order list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state" style={{ padding: '80px 0' }}>
          <div className="empty-state-icon"><Globe size={28} /></div>
          <h3>No {statusFilter !== 'ALL' ? STATUS_CONFIG[statusFilter]?.label : ''} Orders</h3>
          <p>Online orders placed on the website will appear here in real time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onGenerateInvoice={handleGenerateInvoice}
              generating={generatingInvoice}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default OnlineOrders
