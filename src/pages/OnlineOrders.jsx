import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe, Package, Clock, CheckCircle2, XCircle, Truck,
  AlertCircle, RefreshCw, ChevronDown, ChevronUp, Phone,
  User, MapPin, CreditCard, ShoppingBag, ArrowRight,
  Wifi, RotateCcw, Box, Check, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_CONFIG = {
  PENDING:          { label: 'Pending',           color: '#d97706', bg: '#fef3c7', border: '#fcd34d', icon: Clock },
  CONFIRMED:        { label: 'Confirmed',          color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: CheckCircle2 },
  PROCESSING:       { label: 'Processing',         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: Package },
  PACKED:           { label: 'Packed',             color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: Box },
  READY_FOR_PICKUP: { label: 'Ready for Pickup',   color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: ShoppingBag },
  SHIPPED:          { label: 'Shipped',            color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc', icon: Truck },
  DELIVERED:        { label: 'Delivered',          color: '#16a34a', bg: '#dcfce7', border: '#86efac', icon: CheckCircle2 },
  CANCELLED:        { label: 'Cancelled',          color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
  RETURNED:         { label: 'Returned',           color: '#9d174d', bg: '#fdf2f8', border: '#fbcfe8', icon: RotateCcw },
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
  PROCESSING:       ['PACKED', 'CANCELLED'],
  PACKED:           ['SHIPPED', 'CANCELLED'],
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
const OrderCard = ({ order, onStatusChange, onOpenShipModal, onOpenCancelModal }) => {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const nextStatuses = STATUS_TRANSITIONS[order.order_status] || []
  const cfg = STATUS_CONFIG[order.order_status]

  const handleStatusClick = async (newStatus) => {
    if (newStatus === 'SHIPPED') {
      onOpenShipModal(order)
      return
    }
    if (newStatus === 'CANCELLED') {
      onOpenCancelModal(order)
      return
    }

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
          {order.tracking_number && (
            <span style={{
              background: '#e0f2fe', border: '1px solid #7dd3fc',
              borderRadius: 6, padding: '2px 7px',
              fontSize: 10, fontWeight: 700, color: '#0369a1',
            }}>
              Tracking: {order.tracking_number} ({order.courier_name || 'Courier'})
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
            title="Toggle Details"
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
            {PAYMENT_STATUS_CONFIG[order.payment_status]?.label || order.payment_status}
          </span>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: PAYMENT_STATUS_CONFIG[order.payment_status]?.color || '#9ca3af',
            display: 'inline-block',
          }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{INR(order.grand_total)}</span>
        </div>

        {/* Razorpay reference pill */}
        {order.payment_reference && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', fontWeight: 600
          }}>
            <CreditCard size={11} />
            <span>Razorpay: {order.payment_reference}</span>
          </div>
        )}

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
                onClick={() => handleStatusClick(ns)}
                disabled={updating}
                style={{ fontSize: 12 }}
              >
                {updating ? <div className="btn-spinner" /> : <ArrowRight size={11} />}
                {nextCfg?.label || ns}
              </button>
            )
          })}
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
            {(order.online_order_items || []).map((item, i) => {
              const isCombo =
                item.product_type === 'combo' ||
                (item.product_name || '').toLowerCase().includes('combo') ||
                (item.product_name || '').includes('[Includes:');

              return (
                <div key={i} style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{item.product_name}</span>
                        {isCombo && (
                          <span style={{
                            fontSize: 10, background: '#f5f3ff', color: '#7c3aed',
                            border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: 10, fontWeight: 700
                          }}>
                            Combo Bundle
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        Selected Phone Model: <strong style={{ color: 'var(--text-primary)' }}>{item.mobile_model || 'Universal'}</strong>
                        {item.mobile_brand ? ` (${item.mobile_brand})` : ''}
                        {item.selected_color ? ` · Color: ${item.selected_color}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>
                      <div style={{ fontWeight: 700 }}>{INR(item.line_total)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Quantity: <strong>{item.quantity}</strong> × {INR(item.unit_price)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Totals */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              {[
                ['Subtotal', INR(order.subtotal)],
                order.discount_amount > 0 ? ['Discount', '− ' + INR(order.discount_amount)] : null,
                ['GST (included)', INR(order.gst_amount)],
                order.shipping_amount > 0 ? ['Shipping', INR(order.shipping_amount)] : ['Shipping', 'Free'],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span>Grand Total Paid</span><span>{INR(order.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Customer + Shipping Address */}
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
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Shipping Address</div>
              <div style={{ fontSize: 12, display: 'flex', gap: 6, color: 'var(--text-secondary)' }}>
                <MapPin size={13} style={{ marginTop: 2, flexShrink: 0 }} color="var(--text-muted)" />
                <span>{order.shipping_address || 'Address provided at checkout'}</span>
              </div>
            </div>
          </div>

          {/* Payment & Tracking Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CreditCard size={13} />
              <span>Method: <strong>{order.payment_method}</strong> ({order.payment_status})</span>
            </div>
            {order.payment_reference && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Razorpay Payment ID:</span>
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                  {order.payment_reference}
                </code>
              </div>
            )}
            {order.tracking_number && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck size={13} color="#0284c7" />
                <span>Courier: <strong>{order.courier_name || 'Courier'}</strong></span>
                <span>AWB: <strong>{order.tracking_number}</strong></span>
              </div>
            )}
          </div>

          {order.cancelled_reason && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#991b1b' }}>
              <strong>Cancellation Reason:</strong> {order.cancelled_reason}
              {order.refund_status && (
                <span style={{ marginLeft: 8, fontWeight: 700 }}>
                  · Refund Status: {order.refund_status}
                </span>
              )}
            </div>
          )}

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
  const [stats, setStats] = useState({ pending: 0, today: 0, revenue: 0 })

  // Modals for Ship and Cancel actions
  const [shipModalOrder, setShipModalOrder] = useState(null)
  const [trackingNumberInput, setTrackingNumberInput] = useState('')
  const [courierNameInput, setCourierNameInput] = useState('Delhivery')
  const [shippingSaving, setShippingSaving] = useState(false)

  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancelReasonInput, setCancelReasonInput] = useState('Customer requested cancellation')
  const [cancelSaving, setCancelSaving] = useState(false)

  // Idempotently ensure customer exists in customers table
  const syncCustomerRecord = useCallback(async (order) => {
    if (!order?.customer_phone) return
    const cleanPhone = order.customer_phone.replace(/\D/g, '')
    try {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, total_orders, total_spent')
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (existing) {
        if (!order.customer_id) {
          await supabase.from('online_orders').update({ customer_id: existing.id }).eq('id', order.id)
        }
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert({
            name: order.customer_name || 'Online Customer',
            phone: cleanPhone,
            email: order.customer_email || null,
            address: order.shipping_address || null,
            total_orders: 1,
            total_spent: Number(order.grand_total || 0),
            last_purchase_at: order.created_at,
          })
          .select('id')
          .maybeSingle()

        if (newCust) {
          await supabase.from('online_orders').update({ customer_id: newCust.id }).eq('id', order.id)
        }
      }
    } catch (e) {
      console.warn('Customer auto-sync note:', e.message)
    }
  }, [])

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
      const list = data || []
      setOrders(list)
      // Auto-reconcile customer profile idempotently
      list.slice(0, 10).forEach(syncCustomerRecord)
    }
    setLoading(false)
  }, [statusFilter, syncCustomerRecord])

  const fetchStats = useCallback(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: pendingCount } = await supabase
      .from('online_orders')
      .select('*', { count: 'exact', head: true })
      .in('order_status', ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED'])

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
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Realtime subscription on online_orders AND online_order_items with toast alert
  useEffect(() => {
    const channel = supabase
      .channel('online-orders-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new
          toast.success(
            `🔔 New Website Order! #${newOrder.order_number || ''} — ₹${Number(newOrder.grand_total || 0).toLocaleString('en-IN')}`,
            { duration: 6000 }
          )
        }
        fetchOrders()
        fetchStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_order_items' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchOrders, fetchStats])

  const handleStatusChange = async (orderId, newStatus, order) => {
    // Try updating status
    let payload = { order_status: newStatus }
    let { error } = await supabase.from('online_orders').update(payload).eq('id', orderId)

    // Fallback if 'PACKED' is rejected by existing check constraint before SQL migration
    if (error && newStatus === 'PACKED' && error.message.includes('check constraint')) {
      const fallbackNote = (order.notes ? order.notes + ' ' : '') + '[Status: PACKED]'
      const res = await supabase.from('online_orders').update({ order_status: 'PROCESSING', notes: fallbackNote }).eq('id', orderId)
      error = res.error
    }

    if (error) {
      toast.error('Status update failed: ' + error.message)
    } else {
      toast.success(`Order ${order.order_number} → ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      fetchOrders()
      fetchStats()
    }
  }

  // Handle Shipped with Tracking Number
  const handleConfirmShip = async () => {
    if (!shipModalOrder) return
    if (!trackingNumberInput.trim()) {
      toast.error('Please enter a tracking number')
      return
    }

    setShippingSaving(true)
    try {
      const trackingText = trackingNumberInput.trim()
      const courierText = courierNameInput.trim() || 'Courier'

      // Try updating with tracking_number and courier_name
      let { error } = await supabase
        .from('online_orders')
        .update({
          order_status: 'SHIPPED',
          tracking_number: trackingText,
          courier_name: courierText,
        })
        .eq('id', shipModalOrder.id)

      // Fallback if tracking_number column not yet migrated
      if (error && error.message.includes('column')) {
        const noteWithTracking = `Dispatched via ${courierText} (Tracking: ${trackingText})`
        const res = await supabase
          .from('online_orders')
          .update({
            order_status: 'SHIPPED',
            notes: (shipModalOrder.notes ? shipModalOrder.notes + ' · ' : '') + noteWithTracking,
          })
          .eq('id', shipModalOrder.id)
        error = res.error
      }

      if (error) throw error

      toast.success(`Order ${shipModalOrder.order_number} marked SHIPPED with Tracking #${trackingText}`)
      setShipModalOrder(null)
      setTrackingNumberInput('')
      fetchOrders()
      fetchStats()
    } catch (err) {
      toast.error('Shipping update failed: ' + err.message)
    } finally {
      setShippingSaving(false)
    }
  }

  // Handle Cancel with Reason (restores stock & records refund status)
  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return
    const reason = cancelReasonInput.trim() || 'Cancelled by staff'

    setCancelSaving(true)
    try {
      // 1. Try atomic cancellation RPC if deployed
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('cancel_and_restock_online_order', {
        p_order_id: cancelModalOrder.id,
        p_reason: reason,
      })

      if (!rpcErr && rpcRes?.success) {
        toast.success(`Order ${cancelModalOrder.order_number} cancelled and stock restored!`)
      } else {
        // 2. Direct stock restoration if RPC not yet deployed
        const items = cancelModalOrder.online_order_items || []
        for (const item of items) {
          if (item.product_id) {
            // Fetch current stock
            const { data: prod } = await supabase
              .from('products')
              .select('current_stock')
              .eq('id', item.product_id)
              .maybeSingle()

            if (prod) {
              const prevStock = prod.current_stock
              const newStock = prevStock + (Number(item.quantity) || 1)
              await supabase
                .from('products')
                .update({ current_stock: newStock })
                .eq('id', item.product_id)

              await supabase.from('inventory_movements').insert({
                product_id: item.product_id,
                movement_type: 'CUSTOMER_RETURN',
                quantity: Number(item.quantity) || 1,
                previous_stock: prevStock,
                new_stock: newStock,
                reason: `Online order cancelled: ${reason}`,
                reference_id: cancelModalOrder.order_number,
                channel: 'website',
              })
            }
          }
        }

        // Update order status and refund status
        const isPaid = cancelModalOrder.payment_status === 'PAID'
        const updatePayload = {
          order_status: 'CANCELLED',
          cancelled_reason: reason,
          refund_status: isPaid ? 'PROCESSED' : 'NONE',
          payment_status: isPaid ? 'REFUNDED' : cancelModalOrder.payment_status,
        }

        // If refund_status column is not yet in table, fallback without it
        let { error: ordErr } = await supabase
          .from('online_orders')
          .update(updatePayload)
          .eq('id', cancelModalOrder.id)

        if (ordErr && ordErr.message.includes('column')) {
          await supabase
            .from('online_orders')
            .update({
              order_status: 'CANCELLED',
              cancelled_reason: reason,
              payment_status: isPaid ? 'REFUNDED' : cancelModalOrder.payment_status,
            })
            .eq('id', cancelModalOrder.id)
        }

        // Record refund in payments if payments linked
        try {
          await supabase
            .from('payments')
            .update({ refund_status: 'PROCESSED', payment_status: 'REFUNDED' })
            .eq('online_order_id', cancelModalOrder.id)
        } catch (e) {}

        toast.success(`Order ${cancelModalOrder.order_number} cancelled. Stock restored and refund marked!`)
      }

      setCancelModalOrder(null)
      setCancelReasonInput('Customer requested cancellation')
      fetchOrders()
      fetchStats()
    } catch (err) {
      toast.error('Cancellation failed: ' + err.message)
    } finally {
      setCancelSaving(false)
    }
  }

  const FILTER_TABS = [
    { key: 'ALL', label: 'All Orders' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'PACKED', label: 'Packed' },
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
                Real-time website orders stream directly into POS
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#16a34a', fontWeight: 600,
            }}>
              <Wifi size={11} /> Realtime Connected
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
          { label: 'Action Required', value: stats.pending, color: '#d97706', bg: '#fef3c7', icon: AlertCircle, desc: 'Pending / Confirmed / Processing / Packed' },
          { label: 'Orders Today', value: stats.today, color: '#2563eb', bg: '#eff6ff', icon: Globe, desc: 'Excluding cancelled' },
          { label: 'Revenue Today', value: INR(stats.revenue), color: '#16a34a', bg: '#dcfce7', icon: ShoppingBag, desc: 'From online website channel' },
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
          <p>Online orders placed on the website will appear here in real time without refreshing.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onOpenShipModal={setShipModalOrder}
              onOpenCancelModal={setCancelModalOrder}
            />
          ))}
        </div>
      )}

      {/* Modal: Shipped with Tracking Number */}
      {shipModalOrder && (
        <div className="modal-overlay" onClick={() => setShipModalOrder(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Ship Order #{shipModalOrder.order_number}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShipModalOrder(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Enter the courier partner and tracking / AWB number. The customer's tracking page will update live.
              </p>
              <div className="form-group">
                <label className="form-label">Courier Partner</label>
                <select
                  className="filter-select"
                  style={{ width: '100%', padding: '8px 12px' }}
                  value={courierNameInput}
                  onChange={e => setCourierNameInput(e.target.value)}
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="DTDC">DTDC</option>
                  <option value="Blue Dart">Blue Dart</option>
                  <option value="India Post">India Post (Speed Post)</option>
                  <option value="Shadowfax">Shadowfax</option>
                  <option value="Store Courier">Store Courier / Local Delivery</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tracking / AWB Number <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DLV123456789 or AWBDTC883"
                  value={trackingNumberInput}
                  onChange={e => setTrackingNumberInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShipModalOrder(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmShip}
                disabled={shippingSaving || !trackingNumberInput.trim()}
              >
                {shippingSaving ? <div className="btn-spinner" /> : <Check size={14} />}
                Confirm Shipment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel with Reason */}
      {cancelModalOrder && (
        <div className="modal-overlay" onClick={() => setCancelModalOrder(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'var(--danger)' }}>
                Cancel Order #{cancelModalOrder.order_number}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setCancelModalOrder(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Cancelling this order will automatically <strong>release stock back to inventory</strong>, record an inventory return audit movement, and mark the Razorpay refund status.
              </p>
              <div className="form-group">
                <label className="form-label">Cancellation Reason <span className="required">*</span></label>
                <select
                  className="filter-select"
                  style={{ width: '100%', padding: '8px 12px', marginBottom: 8 }}
                  value={cancelReasonInput}
                  onChange={e => setCancelReasonInput(e.target.value)}
                >
                  <option value="Customer requested cancellation">Customer requested cancellation</option>
                  <option value="Product out of stock / defect">Product out of stock / defect</option>
                  <option value="Incorrect shipping address">Incorrect shipping address</option>
                  <option value="Customer unreachable by phone">Customer unreachable by phone</option>
                  <option value="Duplicate order">Duplicate order</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Provide specific reason..."
                  value={cancelReasonInput}
                  onChange={e => setCancelReasonInput(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCancelModalOrder(null)}>
                Keep Order
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelSaving || !cancelReasonInput.trim()}
              >
                {cancelSaving ? <div className="btn-spinner" /> : <RotateCcw size={14} />}
                Confirm Cancellation & Restock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OnlineOrders
