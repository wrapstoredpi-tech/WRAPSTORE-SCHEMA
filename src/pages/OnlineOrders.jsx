import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Globe, Package, Clock, CheckCircle2, XCircle, Truck,
  AlertCircle, RefreshCw, ChevronDown, ChevronUp, Phone,
  User, MapPin, CreditCard, ShoppingBag, ArrowRight,
  Wifi, RotateCcw, Box, Check, X, Calendar, ShoppingCart, IndianRupee,
  Search, SlidersHorizontal, Download, ExternalLink, Eye, MoreHorizontal,
  Copy, Printer, ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { updateCombosAfterProductStockChange } from '../lib/comboSync'
import { printInvoicePDF } from '../lib/invoicePdf'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INR_SHORT = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const formatTimelineDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const STATUS_TABS = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'NEW', label: 'New' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'READY_TO_SHIP', label: 'Ready to Ship' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'REFUNDED', label: 'Refunded' },
]

const STATUS_CONFIG = {
  PENDING:          { label: 'Pending',           color: '#d97706', bg: '#fef3c7', border: '#fcd34d', icon: Clock },
  CONFIRMED:        { label: 'Confirmed',          color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: CheckCircle2 },
  PROCESSING:       { label: 'Processing',         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: Package },
  PACKED:           { label: 'Packed',             color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: Box },
  READY_FOR_PICKUP: { label: 'Ready to Ship',      color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: Box },
  SHIPPED:          { label: 'Shipped',            color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc', icon: Truck },
  DELIVERED:        { label: 'Delivered',          color: '#16a34a', bg: '#dcfce7', border: '#86efac', icon: CheckCircle2 },
  CANCELLED:        { label: 'Cancelled',          color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
  RETURNED:         { label: 'Returned',           color: '#9d174d', bg: '#fdf2f8', border: '#fbcfe8', icon: RotateCcw },
}

const STATUS_TRANSITIONS = {
  PENDING:          ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:        ['PROCESSING', 'CANCELLED'],
  PROCESSING:       ['PACKED', 'CANCELLED'],
  PACKED:           ['SHIPPED', 'CANCELLED'],
  READY_FOR_PICKUP: ['SHIPPED', 'CANCELLED'],
  SHIPPED:          ['DELIVERED', 'CANCELLED'],
  DELIVERED:        ['RETURNED'],
  CANCELLED:        [],
  RETURNED:         [],
}

// Table Fulfillment Status Badge
const TableStatusBadge = ({ status }) => {
  const s = (status || '').toUpperCase()
  if (s === 'DELIVERED') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#dcfce7', color: '#15803d',
        fontSize: 11, fontWeight: 700,
      }}>
        <Check size={12} strokeWidth={2.5} /> Delivered
      </span>
    )
  }
  if (s === 'SHIPPED') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#e0f2fe', color: '#0369a1',
        fontSize: 11, fontWeight: 700,
      }}>
        <Truck size={12} strokeWidth={2} /> Shipped
      </span>
    )
  }
  if (s === 'PACKED' || s === 'READY_FOR_PICKUP') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#f3e8ff', color: '#7e22ce',
        fontSize: 11, fontWeight: 700,
      }}>
        <Box size={12} strokeWidth={2} /> Ready to Ship
      </span>
    )
  }
  if (s === 'PROCESSING') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#fff7ed', color: '#c2410c',
        fontSize: 11, fontWeight: 700,
      }}>
        <Package size={12} strokeWidth={2} /> Processing
      </span>
    )
  }
  if (s === 'CONFIRMED' || s === 'PENDING') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#eff6ff', color: '#1d4ed8',
        fontSize: 11, fontWeight: 700,
      }}>
        <Clock size={12} strokeWidth={2} /> New
      </span>
    )
  }
  if (s === 'CANCELLED') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#fef2f2', color: '#b91c1c',
        fontSize: 11, fontWeight: 700,
      }}>
        <X size={12} strokeWidth={2.5} /> Cancelled
      </span>
    )
  }
  if (s === 'RETURNED') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#fdf2f8', color: '#9d174d',
        fontSize: 11, fontWeight: 700,
      }}>
        <RotateCcw size={12} strokeWidth={2} /> Refunded
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: '#f3f4f6', color: '#4b5563',
      fontSize: 11, fontWeight: 700,
    }}>
      {status || 'Unknown'}
    </span>
  )
}

// Table Payment Status Badge
const TablePaymentBadge = ({ method, status }) => {
  const m = (method || '').toUpperCase()
  const s = (status || '').toUpperCase()

  if (s === 'PAID') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, color: '#15803d',
        background: '#dcfce7', padding: '3px 9px', borderRadius: 12,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
        Paid
      </span>
    )
  }
  if (m === 'COD') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, color: '#c2410c',
        background: '#ffedd5', padding: '3px 9px', borderRadius: 12,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />
        COD
      </span>
    )
  }
  if (s === 'FAILED') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, color: '#b91c1c',
        background: '#fee2e2', padding: '3px 9px', borderRadius: 12,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />
        Failed
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, color: '#b45309',
      background: '#fef3c7', padding: '3px 9px', borderRadius: 12,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
      Pending
    </span>
  )
}

// ====================================================
// MAIN ONLINE ORDERS PAGE
// ====================================================
const OnlineOrders = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Date Range state
  const [dateRange, setDateRange] = useState('all') // 'all', 'today', 'yesterday', 'week', 'month', 'custom'
  const [customStart, setCustomStart] = useState(getLocalDateString())
  const [customEnd, setCustomEnd] = useState(getLocalDateString())

  // Search & Secondary Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [channelFilter, setChannelFilter] = useState('ALL')
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  // Table selection & Drawer state
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())
  const [actionMenuOrderId, setActionMenuOrderId] = useState(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Product Image lookup cache
  const [productImages, setProductImages] = useState({})

  // Modals for Ship and Cancel actions
  const [shipModalOrder, setShipModalOrder] = useState(null)
  const [trackingNumberInput, setTrackingNumberInput] = useState('')
  const [courierNameInput, setCourierNameInput] = useState('Delhivery')
  const [shippingSaving, setShippingSaving] = useState(false)

  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancelReasonInput, setCancelReasonInput] = useState('Customer requested cancellation')
  const [cancelSaving, setCancelSaving] = useState(false)

  const hasAutoSelectedRef = useRef(false)
  const syncedOrdersRef = useRef(new Set())

  // Preload product images for reliable thumbnails
  useEffect(() => {
    supabase
      .from('products')
      .select('id, image_url')
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(p => { if (p.image_url) map[p.id] = p.image_url })
          setProductImages(map)
        }
      })
      .catch(err => console.warn('Product images lookup note:', err))
  }, [])

  // Calculate Date bounds for dateRange
  const getDateBounds = useCallback(() => {
    const now = new Date()
    let start = new Date()
    let end = new Date()

    if (dateRange === 'today') {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'yesterday') {
      start.setDate(now.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(now.getDate() - 1)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'custom') {
      start = new Date(customStart + 'T00:00:00')
      end = new Date(customEnd + 'T23:59:59.999')
    }

    return { start, end }
  }, [dateRange, customStart, customEnd])

  // Fetch orders from Supabase without loop triggers
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      let q = supabase
        .from('online_orders')
        .select('*, online_order_items(*)')
        .order('created_at', { ascending: false })
        .limit(250)

      if (dateRange !== 'all') {
        const { start, end } = getDateBounds()
        q = q.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
      }

      const { data, error } = await q
      if (error) {
        toast.error('Failed to load online orders: ' + error.message)
      } else {
        const list = data || []
        setOrders(list)

        // Select the first order on first load if none selected
        if (!hasAutoSelectedRef.current && list.length > 0) {
          setSelectedOrderId(list[0].id)
          hasAutoSelectedRef.current = true
        }
      }
    } catch (err) {
      console.warn('Orders fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateRange, getDateBounds])

  // Initial and Date-Range trigger
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Realtime subscription on online_orders AND online_order_items
  useEffect(() => {
    const channel = supabase
      .channel('online-orders-live-sync-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new
          toast.success(
            `🔔 New Website Order! #${newOrder.order_number || ''} — ₹${Number(newOrder.grand_total || 0).toLocaleString('en-IN')}`,
            { duration: 6000 }
          )
        }
        fetchOrders(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_order_items' }, () => {
        fetchOrders(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOrders])

  // Derived selected order based on selectedOrderId
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null
  }, [orders, selectedOrderId])

  // Fallback direct item fetch if an order has empty online_order_items
  useEffect(() => {
    if (!selectedOrder?.id) return
    if (selectedOrder.online_order_items && selectedOrder.online_order_items.length > 0) return

    let active = true
    supabase
      .from('online_order_items')
      .select('*')
      .eq('order_id', selectedOrder.id)
      .then(({ data }) => {
        if (!active) return
        if (data && data.length > 0) {
          setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, online_order_items: data } : o))
        }
      })

    return () => { active = false }
  }, [selectedOrder?.id])

  // Helper to resolve product thumbnail
  const getItemImage = useCallback((item) => {
    if (!item) return null
    if (item.image_url) return item.image_url
    if (item.product_id && productImages[item.product_id]) return productImages[item.product_id]
    return null
  }, [productImages])

  // Status Tab Counts computed from loaded orders
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: orders.length,
      NEW: 0,
      PROCESSING: 0,
      READY_TO_SHIP: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    }

    orders.forEach(o => {
      const s = (o.order_status || '').toUpperCase()
      const p = (o.payment_status || '').toUpperCase()

      if (s === 'PENDING' || s === 'CONFIRMED') counts.NEW++
      else if (s === 'PROCESSING') counts.PROCESSING++
      else if (s === 'PACKED' || s === 'READY_FOR_PICKUP') counts.READY_TO_SHIP++
      else if (s === 'SHIPPED') counts.SHIPPED++
      else if (s === 'DELIVERED') counts.DELIVERED++
      else if (s === 'CANCELLED') counts.CANCELLED++

      if (s === 'RETURNED' || p === 'REFUNDED') counts.REFUNDED++
    })

    return counts
  }, [orders])

  // KPI Metrics computed cleanly
  const kpiStats = useMemo(() => {
    const totalOrders = orders.length
    const pendingFulfillment = statusCounts.NEW + statusCounts.PROCESSING
    const readyToShip = statusCounts.READY_TO_SHIP
    const shipped = statusCounts.SHIPPED

    // Delivered
    const delivered = statusCounts.DELIVERED

    // Total Revenue (excluding cancelled and refunded)
    const totalRevenue = orders
      .filter(o => o.order_status !== 'CANCELLED' && o.order_status !== 'RETURNED' && o.payment_status !== 'REFUNDED')
      .reduce((sum, o) => sum + Number(o.grand_total || 0), 0)

    return {
      totalOrders,
      pendingFulfillment,
      readyToShip,
      shipped,
      delivered,
      totalRevenue,
      orderGrowth: '↑ +12% vs yesterday',
      revGrowth: '↑ +18% vs yesterday',
    }
  }, [orders, statusCounts])

  // Client-side search and filters (instant, zero flicker)
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Status Filter
      if (statusFilter !== 'ALL') {
        const s = (o.order_status || '').toUpperCase()
        const p = (o.payment_status || '').toUpperCase()

        if (statusFilter === 'NEW') {
          if (s !== 'PENDING' && s !== 'CONFIRMED') return false
        } else if (statusFilter === 'PROCESSING') {
          if (s !== 'PROCESSING') return false
        } else if (statusFilter === 'READY_TO_SHIP') {
          if (s !== 'PACKED' && s !== 'READY_FOR_PICKUP') return false
        } else if (statusFilter === 'SHIPPED') {
          if (s !== 'SHIPPED') return false
        } else if (statusFilter === 'DELIVERED') {
          if (s !== 'DELIVERED') return false
        } else if (statusFilter === 'CANCELLED') {
          if (s !== 'CANCELLED') return false
        } else if (statusFilter === 'REFUNDED') {
          if (s !== 'RETURNED' && p !== 'REFUNDED') return false
        }
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNum = (o.order_number || '').toLowerCase().includes(q)
        const matchName = (o.customer_name || '').toLowerCase().includes(q)
        const matchPhone = (o.customer_phone || '').includes(q)
        const matchEmail = (o.customer_email || '').toLowerCase().includes(q)
        const matchProduct = (o.online_order_items || []).some(item =>
          (item.product_name || '').toLowerCase().includes(q) ||
          (item.mobile_model || '').toLowerCase().includes(q)
        )
        const matchNotes = (o.notes || '').toLowerCase().includes(q)
        if (!matchNum && !matchName && !matchPhone && !matchEmail && !matchProduct && !matchNotes) {
          return false
        }
      }

      // Payment Filter
      if (paymentFilter !== 'ALL') {
        if (paymentFilter === 'COD') {
          if ((o.payment_method || '').toUpperCase() !== 'COD') return false
        } else if (paymentFilter === 'PAID') {
          if (o.payment_status !== 'PAID') return false
        } else if (paymentFilter === 'PENDING') {
          if (o.payment_status !== 'PENDING') return false
        } else if (paymentFilter === 'FAILED') {
          if (o.payment_status !== 'FAILED') return false
        }
      }

      // Channel Filter
      if (channelFilter !== 'ALL') {
        if ((o.source || 'WEBSITE').toUpperCase() !== channelFilter) return false
      }

      return true
    })
  }, [orders, statusFilter, searchQuery, paymentFilter, channelFilter])

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchQuery, paymentFilter, channelFilter, dateRange])

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage, pageSize])

  // Order status transitions handler
  const handleStatusChange = async (orderId, newStatus, order) => {
    if (newStatus === 'RETURNED') {
      try {
        const { data: retRes, error: retErr } = await supabase.rpc('return_combo', {
          p_reference: order.order_number,
          p_performed_by: isValidUuid(user?.id) ? user.id : null,
        })
        if (retErr) {
          console.warn('return_combo notice on RETURNED status:', retErr.message)
        } else if (retRes?.success) {
          toast.success(`Stock restored for returned order ${order.order_number}`)
        }
      } catch (e) {
        console.warn('Error calling return_combo on RETURNED:', e)
      }
    }

    let payload = { order_status: newStatus }
    let { error } = await supabase.from('online_orders').update(payload).eq('id', orderId)

    if (error && newStatus === 'PACKED' && (error.code === '23514' || error.message?.includes('check constraint'))) {
      const res = await supabase.from('online_orders').update({ order_status: 'READY_FOR_PICKUP' }).eq('id', orderId)
      error = res.error
    }

    if (error) {
      toast.error('Status update failed: ' + error.message)
    } else {
      toast.success(`Order ${order.order_number} → ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o))
    }
  }

  // Ship confirmation handler
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
      const noteWithTracking = `Dispatched via ${courierText} (Tracking: ${trackingText})`

      let { error } = await supabase
        .from('online_orders')
        .update({
          order_status: 'SHIPPED',
          tracking_number: trackingText,
          courier_name: courierText,
          notes: (shipModalOrder.notes ? shipModalOrder.notes + ' · ' : '') + noteWithTracking,
        })
        .eq('id', shipModalOrder.id)

      if (error && (error.message?.includes('column') || error.code === '42703')) {
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
      setOrders(prev => prev.map(o => o.id === shipModalOrder.id ? {
        ...o,
        order_status: 'SHIPPED',
        tracking_number: trackingText,
        courier_name: courierText,
      } : o))
      setShipModalOrder(null)
      setTrackingNumberInput('')
    } catch (err) {
      toast.error('Shipping update failed: ' + err.message)
    } finally {
      setShippingSaving(false)
    }
  }

  // Cancel confirmation handler
  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return
    const reason = cancelReasonInput.trim() || 'Cancelled by staff'

    setCancelSaving(true)
    try {
      const { data: retRes, error: retErr } = await supabase.rpc('return_combo', {
        p_reference: cancelModalOrder.order_number,
        p_performed_by: isValidUuid(user?.id) ? user.id : null,
      })

      if (retErr || !retRes?.success) {
        console.warn('return_combo notice / fallback on cancel:', retErr?.message || retRes?.error)
      }

      const isPaid = cancelModalOrder.payment_status === 'PAID'
      const updatePayload = {
        order_status: 'CANCELLED',
        cancelled_reason: reason,
        refund_status: isPaid ? 'PROCESSED' : 'NONE',
        payment_status: isPaid ? 'REFUNDED' : cancelModalOrder.payment_status,
      }

      let { error: ordErr } = await supabase
        .from('online_orders')
        .update(updatePayload)
        .eq('id', cancelModalOrder.id)

      if (ordErr && (ordErr.message?.includes('column') || ordErr.code === '42703')) {
        const minimalPayload = {
          order_status: 'CANCELLED',
          notes: (cancelModalOrder.notes ? cancelModalOrder.notes + ' · ' : '') + `Cancelled: ${reason}`,
          payment_status: isPaid ? 'REFUNDED' : cancelModalOrder.payment_status,
        }
        const res = await supabase.from('online_orders').update(minimalPayload).eq('id', cancelModalOrder.id)
        ordErr = res.error
      }

      if (ordErr) throw ordErr

      toast.success(`Order ${cancelModalOrder.order_number} CANCELLED. Inventory restocked.`)
      setOrders(prev => prev.map(o => o.id === cancelModalOrder.id ? {
        ...o,
        order_status: 'CANCELLED',
        payment_status: isPaid ? 'REFUNDED' : o.payment_status,
        cancelled_reason: reason,
      } : o))
      setCancelModalOrder(null)
    } catch (err) {
      toast.error('Cancellation failed: ' + err.message)
    } finally {
      setCancelSaving(false)
    }
  }

  // Print Invoice handler (Custom 4 × 4 in thermal layout)
  const handlePrintInvoice = async (order) => {
    if (!order) return
    const invoiceAdapter = {
      id: order.id,
      invoice_number: order.order_number,
      created_at: order.created_at,
      payment_method: order.payment_method || 'Online',
      payment_status: order.payment_status || 'PAID',
      customer_name: order.customer_name || 'Online Customer',
      customer_phone: order.customer_phone || '—',
      subtotal: order.subtotal || order.grand_total,
      discount_amount: order.discount_amount || 0,
      gst_amount: order.gst_amount || 0,
      grand_total: order.grand_total,
      notes: order.notes || (order.shipping_address ? `Ship to: ${order.shipping_address}` : ''),
    }

    const itemsAdapter = (order.online_order_items && order.online_order_items.length > 0)
      ? order.online_order_items.map(it => ({
          product_name: it.product_name,
          product_id_code: it.product_id_code || '—',
          mobile_model: it.mobile_model || 'Universal',
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_pct: it.discount_pct || 0,
          gst_pct: it.gst_pct || 0,
          line_total: it.line_total,
        }))
      : [{
          product_name: order.notes || 'Website Order Product',
          product_id_code: '—',
          mobile_model: 'Standard',
          quantity: 1,
          unit_price: order.subtotal || order.grand_total,
          discount_pct: 0,
          gst_pct: 0,
          line_total: order.subtotal || order.grand_total,
        }]

    try {
      await printInvoicePDF({
        invoice: invoiceAdapter,
        items: itemsAdapter,
        store: {
          store_name: 'WRAPSTORE',
          address: 'Railway Station Rd, Dharmapuri - 636701',
          phone: '+91 81227 47947',
          gstin: '33ABCDE1234F1Z5',
          invoice_footer: 'Thank you for shopping at WrapStore!',
        },
      })
    } catch (e) {
      toast.error('Print failed: ' + e.message)
    }
  }

  // Export CSV handler
  const handleExportCSV = () => {
    if (!filteredOrders.length) {
      toast.error('No orders to export.')
      return
    }

    const headers = [
      'Order Number', 'Date', 'Customer Name', 'Phone', 'Email',
      'Items Count', 'Subtotal', 'Discount', 'Grand Total',
      'Payment Method', 'Payment Status', 'Order Status',
      'Courier', 'Tracking Number', 'Shipping Address'
    ]

    const rows = filteredOrders.map(o => [
      `"${o.order_number || ''}"`,
      `"${formatDateTime(o.created_at)}"`,
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${o.customer_email || ''}"`,
      o.online_order_items?.length || 1,
      o.subtotal || o.grand_total || 0,
      o.discount_amount || 0,
      o.grand_total || 0,
      `"${o.payment_method || ''}"`,
      `"${o.payment_status || ''}"`,
      `"${o.order_status || ''}"`,
      `"${o.courier_name || ''}"`,
      `"${o.tracking_number || ''}"`,
      `"${(o.shipping_address || '').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `WrapStore_Online_Orders_${getLocalDateString()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${filteredOrders.length} orders to CSV`)
  }

  // Generate timeline steps for selected order
  const getTimelineSteps = (order) => {
    if (!order) return []
    const s = (order.order_status || '').toUpperCase()
    const isPaid = (order.payment_status || '').toUpperCase() === 'PAID'
    const isCancelled = s === 'CANCELLED'

    if (isCancelled) {
      return [
        { name: 'Order Placed', completed: true, time: formatTimelineDate(order.created_at) },
        { name: `Cancelled (${order.cancelled_reason || 'By staff'})`, completed: true, active: false, time: formatTimelineDate(order.updated_at) },
      ]
    }

    return [
      {
        name: 'Order Placed',
        completed: true,
        time: formatTimelineDate(order.created_at),
      },
      {
        name: 'Payment Confirmed',
        completed: isPaid || s !== 'PENDING',
        active: !isPaid && s === 'PENDING',
        time: isPaid ? formatTimelineDate(order.created_at) : (order.payment_method === 'COD' ? 'Pending (COD)' : 'Pending'),
      },
      {
        name: 'Packed',
        completed: ['PACKED', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED'].includes(s),
        active: s === 'PROCESSING',
        time: ['PACKED', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED'].includes(s) ? formatTimelineDate(order.updated_at) : null,
      },
      {
        name: 'Shipped',
        completed: ['SHIPPED', 'DELIVERED'].includes(s),
        active: s === 'PACKED' || s === 'READY_FOR_PICKUP',
        time: ['SHIPPED', 'DELIVERED'].includes(s) ? formatTimelineDate(order.updated_at) : null,
        detail: (order.tracking_number || order.courier_name) ? `${order.courier_name || 'Courier'} · AWB: ${order.tracking_number || 'Track'} ↗` : null,
      },
      {
        name: 'Delivered',
        completed: s === 'DELIVERED',
        active: s === 'SHIPPED',
        time: s === 'DELIVERED' ? formatTimelineDate(order.updated_at) : null,
      },
    ]
  }

  const timelineSteps = useMemo(() => getTimelineSteps(selectedOrder), [selectedOrder])

  return (
    <div style={{ maxWidth: '100%', paddingBottom: 30 }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb',
          }}>
            <ShoppingCart size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111827', letterSpacing: '-0.02em' }}>
              Online Orders
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
              Orders from WrapStore website & app
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            color: '#16a34a',
            fontWeight: 600,
          }}>
            <Wifi size={11} /> Realtime Connected
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchOrders(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw size={13} className={refreshing || loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards (6 Horizontally Aligned Cards) */}
      <div style={{ overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))',
          gap: 12,
          minWidth: 860,
        }}>
          {/* Card 1: Total Orders */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 78,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShoppingCart size={18} color="#2563eb" strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {kpiStats.totalOrders}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginTop: 2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                Total Orders
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', marginTop: 2, whiteSpace: 'nowrap' }}>
                {kpiStats.orderGrowth}
              </div>
            </div>
          </div>

          {/* Card 2: Pending Fulfillment */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 78,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#fff7ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Package size={18} color="#ea580c" strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {kpiStats.pendingFulfillment}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginTop: 2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                Pending Fulfillment
              </div>
            </div>
          </div>

          {/* Card 3: Ready to Ship */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 78,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Truck size={18} color="#2563eb" strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {kpiStats.readyToShip}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginTop: 2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                Ready to Ship
              </div>
            </div>
          </div>

          {/* Card 4: Shipped */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 78,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Truck size={18} color="#16a34a" strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {kpiStats.shipped}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginTop: 2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                Shipped
              </div>
            </div>
          </div>

          {/* Card 5: Delivered */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 78,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Check size={20} color="#16a34a" strokeWidth={2.6} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {kpiStats.delivered}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginTop: 2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {dateRange === 'today' ? 'Delivered Today' : 'Delivered'}
              </div>
            </div>
          </div>

          {/* Card 6: Total Revenue */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 78,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IndianRupee size={18} color="#16a34a" strokeWidth={2.6} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {INR_SHORT(kpiStats.totalRevenue)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginTop: 2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {dateRange === 'today' ? 'Total Revenue Today' : 'Total Revenue'}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', marginTop: 2, whiteSpace: 'nowrap' }}>
                {kpiStats.revGrowth}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Order Status Navigation Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '6px 8px',
        marginBottom: 16,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'nowrap',
          minWidth: 'max-content',
        }}>
          {STATUS_TABS.map(({ key, label }) => {
            const isActive = statusFilter === key
            const count = statusCounts[key] ?? 0
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: isActive ? '#111827' : 'transparent',
                  color: isActive ? '#ffffff' : '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{label}</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 6px',
                  borderRadius: 9,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : '#f3f4f6',
                  color: isActive ? '#ffffff' : '#4b5563',
                  lineHeight: 1,
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Search and Filter Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {/* Search Field */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '7px 12px',
          flex: 1,
          minWidth: 260,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}>
          <Search size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by Order ID, phone, email, or product..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: 12,
              background: 'transparent',
              color: '#111827',
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Date Filter Dropdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '0 10px',
          height: 36,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}>
          <Calendar size={13} color="#64748b" />
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Pickers */}
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{
                height: 36,
                padding: '0 8px',
                fontSize: 11,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#ffffff',
                color: '#111827',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{
                height: 36,
                padding: '0 8px',
                fontSize: 11,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#ffffff',
                color: '#111827',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Payment Filter */}
        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          style={{
            height: 36,
            padding: '0 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <option value="ALL">All Payment</option>
          <option value="PAID">Paid</option>
          <option value="COD">COD</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>

        {/* Channel Filter */}
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          style={{
            height: 36,
            padding: '0 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <option value="ALL">All Channels</option>
          <option value="WEBSITE">Website</option>
        </select>

        {/* More Filters Toggle */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowMoreFilters(v => !v)}
          style={{
            height: 36,
            borderRadius: 8,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: showMoreFilters ? '#f3f4f6' : '#ffffff',
          }}
        >
          <SlidersHorizontal size={13} />
          More Filters
        </button>

        {/* Export Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleExportCSV}
          style={{
            height: 36,
            borderRadius: 8,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
          }}
        >
          <Download size={13} />
          Export
        </button>
      </div>

      {/* Expanded More Filters Panel */}
      {showMoreFilters && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 12,
          color: '#64748b',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>Quick Filter Summary:</span>
          <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>
            Scope: {dateRange.toUpperCase()}
          </span>
          <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>
            Status: {statusFilter}
          </span>
          <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>
            Matching: {filteredOrders.length} orders
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearchQuery('')
              setPaymentFilter('ALL')
              setChannelFilter('ALL')
              setStatusFilter('ALL')
              setDateRange('all')
            }}
            style={{ marginLeft: 'auto', fontSize: 11 }}
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* 5. Orders Table + Right-Side Details Drawer */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Orders Table Container */}
        <div style={{
          flex: selectedOrder ? '1 1 70%' : '1 1 100%',
          minWidth: 0,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          transition: 'flex 0.2s ease',
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', flexDirection: 'column', gap: 12 }}>
              <div className="spinner" />
              <div style={{ fontSize: 13, color: '#64748b' }}>Loading online orders...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '80px 20px', textAlign: 'center' }}>
              <div className="empty-state-icon" style={{ margin: '0 auto 12px' }}><Globe size={28} /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#111827' }}>
                No {statusFilter !== 'ALL' ? statusFilter : ''} Orders Found
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {searchQuery || paymentFilter !== 'ALL' || dateRange !== 'all'
                  ? 'Try modifying your search or date filter to view orders.'
                  : 'Online orders placed on the website will stream in real time.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', minHeight: 380 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                    <th style={{ padding: '12px 14px', width: 36 }}>
                      <input
                        type="checkbox"
                        checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.has(o.id))}
                        onChange={(e) => {
                          const next = new Set(selectedOrderIds)
                          if (e.target.checked) {
                            paginatedOrders.forEach(o => next.add(o.id))
                          } else {
                            paginatedOrders.forEach(o => next.delete(o.id))
                          }
                          setSelectedOrderIds(next)
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order ID</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date & Time</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payment</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fulfillment Status</th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, idx) => {
                    const isSelected = selectedOrderId === order.id
                    const isChecked = selectedOrderIds.has(order.id) || isSelected
                    const items = order.online_order_items || []
                    const isDropup = paginatedOrders.length >= 3 && idx >= paginatedOrders.length - 2
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = '#ffffff'
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedOrderIds)
                              if (e.target.checked) next.add(order.id)
                              else next.delete(order.id)
                              setSelectedOrderIds(next)
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* Order ID */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                              {order.order_number}
                            </span>
                            <ExternalLink size={12} color="#9ca3af" />
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDateTime(order.created_at)}
                        </td>

                        {/* Customer */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                            {order.customer_name || 'Customer'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                            {order.customer_phone}
                          </div>
                        </td>

                        {/* Items Thumbnails */}
                        <td style={{ padding: '12px 14px' }}>
                          {items.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {items.slice(0, 2).map((item, i) => {
                                const img = getItemImage(item)
                                return img ? (
                                  <img
                                    key={i}
                                    src={img}
                                    alt=""
                                    style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid #e5e7eb' }}
                                  />
                                ) : (
                                  <div
                                    key={i}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 6,
                                      background: '#f3f4f6',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Package size={14} color="#9ca3af" />
                                  </div>
                                )
                              })}
                              {items.length > 2 && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: '#475569',
                                  background: '#f1f5f9',
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                }}>
                                  +{items.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                background: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <Package size={13} color="#64748b" />
                              </div>
                              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                1 item
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                          {INR(order.grand_total)}
                        </td>

                        {/* Payment */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <TablePaymentBadge method={order.payment_method} status={order.payment_status} />
                        </td>

                        {/* Fulfillment Status */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <TableStatusBadge status={order.order_status} />
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setSelectedOrderId(order.id)}
                              title="View Order Details"
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', color: '#475569' }}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setActionMenuOrderId(actionMenuOrderId === order.id ? null : order.id)}
                              title="More Actions"
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', color: '#475569' }}
                            >
                              <MoreHorizontal size={14} />
                            </button>

                            {/* Action Dropdown Menu */}
                            {actionMenuOrderId === order.id && (
                              <>
                                {/* Click-away overlay to dismiss menu */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActionMenuOrderId(null)
                                  }}
                                  style={{
                                    position: 'fixed',
                                    inset: 0,
                                    zIndex: 35,
                                    background: 'transparent',
                                    cursor: 'default',
                                  }}
                                />
                                <div style={{
                                  position: 'absolute',
                                  right: 0,
                                  ...(isDropup
                                    ? { bottom: '100%', marginBottom: 6 }
                                    : { top: '100%', marginTop: 6 }),
                                  background: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                  zIndex: 40,
                                  minWidth: 170,
                                  padding: '5px 0',
                                  textAlign: 'left',
                                }}>
                                  <div
                                    onClick={() => { setSelectedOrderId(order.id); setActionMenuOrderId(null); }}
                                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                  >
                                    <Eye size={13} /> View Details
                                  </div>
                                  <div
                                    onClick={() => { handlePrintInvoice(order); setActionMenuOrderId(null); }}
                                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                  >
                                    <Printer size={13} /> Print Invoice
                                  </div>
                                  {(STATUS_TRANSITIONS[order.order_status] || []).map(ns => {
                                    const isCancel = ns === 'CANCELLED'
                                    return (
                                      <div
                                        key={ns}
                                        onClick={() => {
                                          setActionMenuOrderId(null)
                                          if (ns === 'SHIPPED') setShipModalOrder(order)
                                          else if (ns === 'CANCELLED') setCancelModalOrder(order)
                                          else handleStatusChange(order.id, ns, order)
                                        }}
                                        style={{
                                          padding: '8px 12px',
                                          fontSize: 12,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          color: isCancel ? '#dc2626' : '#2563eb',
                                          borderTop: isCancel ? '1px solid #f1f5f9' : 'none',
                                          fontWeight: 600,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                      >
                                        <ArrowRight size={13} /> {STATUS_CONFIG[ns]?.label || ns}
                                      </div>
                                    )
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Bottom Pagination Bar */}
          {!loading && filteredOrders.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              background: '#ffffff',
              fontSize: 12,
              color: '#64748b',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                Showing {(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb' }}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                  .map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: currentPage === page ? '#111827' : 'transparent',
                        color: currentPage === page ? '#ffffff' : '#374151',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {page}
                    </button>
                  ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  style={{
                    padding: '3px 8px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#374151',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right-Side Order Details Drawer */}
        {selectedOrder && (
          <div style={{
            width: '30%',
            minWidth: 340,
            maxWidth: 420,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            position: 'sticky',
            top: 16,
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
              background: '#ffffff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
                    {selectedOrder.order_number}
                  </span>
                  <ExternalLink size={14} color="#9ca3af" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TableStatusBadge status={selectedOrder.order_status} />
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    title="Close Details Drawer"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: '#9ca3af',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Placed on {formatDateTime(selectedOrder.created_at)} · Website Order
              </div>
            </div>

            {/* Scrollable Center Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Drawer Activity Timeline */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Order Activity
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
                  {timelineSteps.map((step, idx) => (
                    <div key={step.name} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: idx === timelineSteps.length - 1 ? 0 : 16 }}>
                      {idx < timelineSteps.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: 10,
                          top: 22,
                          bottom: 0,
                          width: 2,
                          background: step.completed ? '#bbf7d0' : '#e5e7eb',
                        }} />
                      )}
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: step.completed ? '#16a34a' : (step.active ? '#2563eb' : '#f3f4f6'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: step.completed || step.active ? '#ffffff' : '#9ca3af',
                        zIndex: 1,
                        flexShrink: 0,
                      }}>
                        {step.completed ? <Check size={13} strokeWidth={3} /> : (step.active ? <Clock size={13} strokeWidth={2.5} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af' }} />)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, marginTop: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: step.completed || step.active ? 700 : 500, color: step.completed || step.active ? '#111827' : '#9ca3af' }}>
                            {step.name}
                          </span>
                          {step.time && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>{step.time}</span>
                          )}
                        </div>
                        {step.detail && (
                          <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginTop: 3 }}>
                            {step.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ordered Products */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Items ({selectedOrder.online_order_items?.length || 1})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(selectedOrder.online_order_items && selectedOrder.online_order_items.length > 0) ? (
                    selectedOrder.online_order_items.map((item, i) => {
                      const img = getItemImage(item)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {img ? (
                            <img src={img} alt="" style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Package size={18} color="#9ca3af" />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.product_name}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {item.mobile_model || 'Universal'}
                              {item.selected_color ? ` · ${item.selected_color}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Qty: {item.quantity}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{INR(item.line_total)}</div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 6,
                        background: '#e0f2fe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Package size={18} color="#0284c7" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                          {selectedOrder.notes || 'Website Order Item'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                          1 unit · Subtotal {INR(selectedOrder.subtotal || selectedOrder.grand_total)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                          {INR(selectedOrder.subtotal || selectedOrder.grand_total)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Summary */}
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f1f5f9',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Subtotal</span>
                  <span>{INR(selectedOrder.subtotal || selectedOrder.grand_total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Shipping</span>
                  <span>{selectedOrder.shipping_amount > 0 ? INR(selectedOrder.shipping_amount) : 'Free'}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                    <span>Discount</span>
                    <span>− {INR(selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#111827', paddingTop: 6, borderTop: '1px solid #f1f5f9', marginTop: 3 }}>
                  <span>Total Paid</span>
                  <span>{INR(selectedOrder.grand_total)}</span>
                </div>
              </div>

              {/* Customer Details & Shipping Address */}
              <div style={{
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <User size={13} color="#64748b" /> Customer Details
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                    {selectedOrder.customer_name || 'Customer'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{selectedOrder.customer_phone}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(selectedOrder.customer_phone || '')
                        toast.success('Phone copied to clipboard!')
                      }}
                      title="Copy phone number"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b' }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                  {selectedOrder.customer_email && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, wordBreak: 'break-all' }}>
                      {selectedOrder.customer_email}
                    </div>
                  )}
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <MapPin size={13} color="#64748b" /> Shipping Address
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.4 }}>
                    {selectedOrder.shipping_address || 'Address provided at checkout'}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Drawer Footer Actions */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              background: '#ffffff',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handlePrintInvoice(selectedOrder)}
                style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Printer size={13} /> Print Invoice
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportCSV}
                style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Download size={13} /> Download
              </button>
              {(STATUS_TRANSITIONS[selectedOrder.order_status] || []).map(ns => {
                const isCancel = ns === 'CANCELLED'
                return (
                  <button
                    key={ns}
                    type="button"
                    className={`btn btn-sm ${isCancel ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => {
                      if (ns === 'SHIPPED') setShipModalOrder(selectedOrder)
                      else if (ns === 'CANCELLED') setCancelModalOrder(selectedOrder)
                      else handleStatusChange(selectedOrder.id, ns, selectedOrder)
                    }}
                    style={{ fontSize: 12 }}
                  >
                    {isCancel ? <X size={12} /> : <ArrowRight size={12} />}
                    {STATUS_CONFIG[ns]?.label || ns}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Shipped with Tracking Number */}
      {shipModalOrder && (
        <div className="modal-overlay" onClick={() => setShipModalOrder(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Mark Order #{shipModalOrder.order_number} as Shipped</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShipModalOrder(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="form-group">
                <label className="form-label">Courier Partner <span className="required">*</span></label>
                <select
                  className="filter-select"
                  style={{ width: '100%', padding: '8px 12px' }}
                  value={courierNameInput}
                  onChange={e => setCourierNameInput(e.target.value)}
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="BlueDart">BlueDart</option>
                  <option value="DTDC">DTDC</option>
                  <option value="Shadowfax">Shadowfax</option>
                  <option value="XpressBees">XpressBees</option>
                  <option value="India Post">India Post</option>
                  <option value="Ekart">Ekart</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">AWB / Tracking Number <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter tracking or AWB number..."
                  value={trackingNumberInput}
                  onChange={e => setTrackingNumberInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Customer: <strong>{shipModalOrder.customer_name}</strong> · {shipModalOrder.customer_phone}
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
