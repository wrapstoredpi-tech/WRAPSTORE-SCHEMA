import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Plus, Minus, Trash2, User, Phone, CreditCard,
  Banknote, Smartphone, ShoppingBag, CheckCircle2, AlertCircle,
  FileText, X, Image as ImageIcon, ChevronDown, RefreshCw, MessageCircle,
  Wifi, WifiOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { downloadInvoicePDF, printInvoicePDF, getInvoicePDFBlob } from '../lib/invoicePdf'
import { sendWhatsAppInvoice, retryWhatsAppDelivery } from '../services/whatsappService'
import ProductImageHover from '../components/common/ProductImageHover'

// ---- Helpers ----
const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)
const INR = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'Card', label: 'Card', icon: CreditCard },
  { id: 'Other', label: 'Other', icon: ShoppingBag },
]

const computeTotals = (cartItems, discountPct) => {
  let subtotal = 0
  let totalGst = 0

  cartItems.forEach(item => {
    const lineSubtotal = item.selling_price * item.qty
    const discAmt = lineSubtotal * (item.discount_percentage / 100)
    const taxable = lineSubtotal - discAmt
    const gst = taxable * (item.gst_percentage / 100)
    subtotal += lineSubtotal
    totalGst += gst
  })

  const discountAmt = subtotal * (discountPct / 100)
  const taxableAmount = subtotal - discountAmt
  const grandTotal = taxableAmount + totalGst

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmt * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstAmount: Math.round(totalGst * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}

// ---- Product Search ----
const ProductSearch = ({ onAddToCart }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef()
  const debounceRef = useRef()

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); setShowResults(false); return }
    setSearching(true)
    const { data } = await supabase
      .from('products')
      .select('*, product_images(public_url, is_primary)')
      .eq('approval_status', 'APPROVED')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,product_id.ilike.%${q}%,mobile_model.ilike.%${q}%,mobile_brand.ilike.%${q}%`)
      .gt('current_stock', 0)
      .limit(8)
    setResults(data || [])
    setShowResults(true)
    setSearching(false)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  const handleSelect = (product) => {
    onAddToCart(product)
    setQuery('')
    setResults([])
    setShowResults(false)
    searchRef.current?.focus()
  }

  const getPrimaryImg = (imgs) => imgs?.find(i => i.is_primary)?.public_url || imgs?.[0]?.public_url

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          ref={searchRef}
          className="search-input"
          style={{ width: '100%', paddingLeft: 36, fontSize: '14px', height: 44 }}
          placeholder="Search by product name, ID (WS-000001) or mobile model..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          id="billing-product-search"
          autoComplete="off"
        />
        {searching && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner-sm" />
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 100,
          marginTop: 4,
          maxHeight: 360,
          overflowY: 'auto',
        }}>
          {results.map(p => {
            const img = getPrimaryImg(p.product_images)
            return (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <ProductImageHover src={img} title={p.name} alt={p.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>{p.product_id}</code>
                    {p.mobile_model && <span>{p.mobile_model}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{INR(p.selling_price)}</div>
                  <div style={{ fontSize: 11, color: p.current_stock <= p.min_stock_level ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                    {p.current_stock} in stock
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleSelect(p) }}>
                  <Plus size={12} /> Add
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showResults && results.length === 0 && query.length >= 2 && !searching && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 100,
          marginTop: 4,
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          No approved in-stock products found for "{query}"
        </div>
      )}
    </div>
  )
}

// ---- Cart Item Row ----
const CartItemRow = ({ item, onQtyChange, onRemove }) => {
  const lineSubtotal = item.selling_price * item.qty
  const discAmt = lineSubtotal * (item.discount_percentage / 100)
  const taxable = lineSubtotal - discAmt
  const gst = taxable * (item.gst_percentage / 100)
  const lineTotal = taxable + gst

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '40px 1fr auto auto auto',
      gap: 10,
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Image */}
      <div className="product-thumb">
        {item._img
          ? <img src={item._img} alt={item.name} />
          : <ImageIcon size={13} color="var(--text-muted)" />
        }
      </div>

      {/* Name + meta */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', gap: 6 }}>
          <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{item.product_id}</code>
          {item.mobile_model && <span>{item.mobile_model}</span>}
          <span style={{ color: 'var(--text-muted)' }}>GST {item.gst_percentage}%</span>
        </div>
        {item.qty > item.current_stock && (
          <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
            ⚠ Only {item.current_stock} available
          </div>
        )}
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', fontSize: 12, minWidth: 70 }}>
        <div style={{ fontWeight: 600 }}>{INR(item.selling_price)}</div>
        {item.discount_percentage > 0 && <div style={{ color: 'var(--danger)', fontSize: 10 }}>-{item.discount_percentage}%</div>}
      </div>

      {/* Qty controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onQtyChange(item.id, item.qty - 1)}
          disabled={item.qty <= 1}
          style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
        >
          <Minus size={11} />
        </button>
        <input
          type="number"
          min={1}
          max={item.current_stock}
          value={item.qty}
          onChange={e => onQtyChange(item.id, parseInt(e.target.value) || 1)}
          style={{
            width: 40,
            textAlign: 'center',
            border: '1.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 4px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
          }}
        />
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onQtyChange(item.id, item.qty + 1)}
          disabled={item.qty >= item.current_stock}
          style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Line total + delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
        <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'right', flex: 1 }}>{INR(lineTotal)}</div>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onRemove(item.id)}
          style={{ color: 'var(--danger)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ---- Success Modal ----
const SuccessModal = ({ invoice, items, store, whatsappResult, onClose, onNewSale }) => {
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [waStatus, setWaStatus] = useState(whatsappResult?.status || 'PENDING')
  const [waError, setWaError] = useState(whatsappResult?.error || null)
  const [retryingWa, setRetryingWa] = useState(false)

  const getLogoUrl = () => store?.logo_url || null

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadInvoicePDF({ invoice, items, store, logoUrl: getLogoUrl() })
      toast.success('PDF downloaded!')
    } catch (e) {
      toast.error('PDF generation failed: ' + e.message)
    }
    setDownloading(false)
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      await printInvoicePDF({ invoice, items, store, logoUrl: getLogoUrl() })
    } catch (e) {
      toast.error('PDF generation failed: ' + e.message)
    }
    setPrinting(false)
  }

  const handleRetryWhatsApp = async () => {
    setRetryingWa(true)
    try {
      const res = await retryWhatsAppDelivery(invoice)
      if (res.success) {
        setWaStatus('SENT')
        setWaError(null)
        toast.success(`WhatsApp delivered to ${invoice.customer_phone}!`)
      } else {
        setWaStatus('FAILED')
        setWaError(res.error || 'Delivery failed')
        toast.error('WhatsApp retry failed: ' + (res.error || 'Network error'))
      }
    } catch (err) {
      setWaStatus('FAILED')
      setWaError(err.message)
    }
    setRetryingWa(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-sm" style={{ textAlign: 'center' }}>
        <div className="modal-body" style={{ padding: '32px 28px' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={28} color="var(--success)" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Sale Complete!</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Invoice <strong>{invoice.invoice_number}</strong> created for{' '}
            <strong>{invoice.customer_name}</strong>
          </div>

          {/* WhatsApp Live Status Card */}
          <div style={{
            background: waStatus === 'SENT' ? '#ecfdf5' : waStatus === 'FAILED' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${waStatus === 'SENT' ? '#a7f3d0' : waStatus === 'FAILED' ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', minWidth: 0 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: waStatus === 'SENT' ? '#d1fae5' : waStatus === 'FAILED' ? '#fee2e2' : '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle size={16} color={waStatus === 'SENT' ? '#10b981' : waStatus === 'FAILED' ? '#ef4444' : '#16a34a'} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: waStatus === 'SENT' ? '#065f46' : waStatus === 'FAILED' ? '#991b1b' : '#166534',
                }}>
                  {waStatus === 'SENT' ? 'WhatsApp Invoice Sent ✓' : waStatus === 'FAILED' ? 'WhatsApp Delivery Failed' : 'Sending via WhatsApp...'}
                </div>
                <div style={{
                  fontSize: 11,
                  color: waStatus === 'SENT' ? '#047857' : waStatus === 'FAILED' ? '#b91c1c' : '#15803d',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {waStatus === 'SENT'
                    ? `Delivered to ${invoice.customer_phone}`
                    : waStatus === 'FAILED'
                    ? (waError || 'Phone unreachable')
                    : `Dispatched to ${invoice.customer_phone}`}
                </div>
              </div>
            </div>

            {waStatus === 'FAILED' && (
              <button
                className="btn btn-sm btn-danger"
                style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                onClick={handleRetryWhatsApp}
                disabled={retryingWa}
              >
                {retryingWa ? 'Retrying...' : 'Retry'}
              </button>
            )}
            {waStatus === 'SENT' && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: '#047857', padding: '4px 8px', flexShrink: 0 }}
                onClick={handleRetryWhatsApp}
                disabled={retryingWa}
                title="Resend WhatsApp invoice"
              >
                {retryingWa ? 'Sending...' : 'Resend'}
              </button>
            )}
          </div>

          <div style={{ background: '#f9fafb', borderRadius: 'var(--radius)', padding: '14px', marginBottom: 20, textAlign: 'left' }}>
            {[
              ['Invoice', invoice.invoice_number],
              ['Customer', invoice.customer_name],
              ['Phone', invoice.customer_phone],
              ['Payment', invoice.payment_method],
              ['Grand Total', INR(invoice.grand_total)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }} onClick={handlePrint} disabled={printing}>
              {printing ? <><div className="btn-spinner" /> Generating...</> : <><FileText size={15} /> View / Print PDF</>}
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={handleDownload} disabled={downloading}>
              {downloading ? <><div className="btn-spinner" /> Downloading...</> : 'Download PDF'}
            </button>
            <button className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={onNewSale}>
              + New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ====================================================
// MAIN BILLING PAGE
// ====================================================
const Billing = () => {
  const { user } = useAuth()
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discountPct, setDiscountPct] = useState(18)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stockErrors, setStockErrors] = useState([])
  const [successData, setSuccessData] = useState(null)
  const [store, setStore] = useState(null)
  const cartRef = useRef(cart)

  // Keep ref in sync so the realtime callback always sees the latest cart
  useEffect(() => { cartRef.current = cart }, [cart])

  useEffect(() => {
    supabase.from('store_settings').select('*').limit(1).single()
      .then(({ data }) => setStore(data))
  }, [])

  // ── Realtime: warn cashier when an online order drops stock of a cart item ──
  useEffect(() => {
    const channel = supabase
      .channel('billing-stock-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const updated = payload.new
          const affectedItem = cartRef.current.find(i => i.id === updated.id)
          if (!affectedItem) return

          const available = updated.current_stock - (updated.reserved_stock || 0)

          if (available < affectedItem.qty) {
            toast(
              (t) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
                    ⚠ Online order reduced stock!
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f' }}>
                    <strong>{affectedItem.name}</strong>: only {available} left (you have {affectedItem.qty} in cart)
                  </div>
                  <div style={{ fontSize: 11, color: '#92400e' }}>Review cart quantities before completing the sale.</div>
                </div>
              ),
              {
                duration: 8000,
                style: {
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: 10,
                  maxWidth: 340,
                },
              }
            )
            // Auto-clamp cart qty to available
            if (available <= 0) {
              setCart(prev => prev.filter(i => i.id !== updated.id))
            } else {
              setCart(prev => prev.map(i =>
                i.id === updated.id
                  ? { ...i, current_stock: available, qty: Math.min(i.qty, available) }
                  : i
              ))
            }
          } else {
            // Stock changed but still enough — silently update the display stock
            setCart(prev => prev.map(i =>
              i.id === updated.id ? { ...i, current_stock: updated.current_stock } : i
            ))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const totals = computeTotals(cart, discountPct)
  const hasStockIssues = cart.some(item => item.qty > item.current_stock)

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) {
        if (existing.qty >= product.current_stock) {
          toast.error(`Only ${product.current_stock} units available for ${product.name}`)
          return prev
        }
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      const img = product.product_images?.find(i => i.is_primary)?.public_url || product.product_images?.[0]?.public_url
      return [...prev, { ...product, qty: 1, _img: img }]
    })
  }

  const updateQty = (id, qty) => {
    if (qty < 1) return
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

  const resetBilling = () => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setDiscountPct(18)
    setPaymentMethod('Cash')
    setNotes('')
    setStockErrors([])
    setSuccessData(null)
  }

  const handleCompleteSale = async () => {
    // Validations
    if (cart.length === 0) { toast.error('Add at least one product to the cart.'); return }
    if (!customerName.trim()) { toast.error('Customer name is required.'); return }
    if (!customerPhone.trim()) { toast.error('Customer WhatsApp number is required.'); return }
    if (hasStockIssues) { toast.error('Fix stock quantity issues before completing the sale.'); return }

    setSubmitting(true)
    setStockErrors([])

    try {
      // ---- STEP 1: Validate stock for each cart item ----
      const stockCheckErrors = []
      for (const item of cart) {
        const { data: freshProduct } = await supabase
          .from('products')
          .select('current_stock, name, product_id')
          .eq('id', item.id)
          .single()

        if (!freshProduct || freshProduct.current_stock < item.qty) {
          stockCheckErrors.push({
            name: item.name,
            requested: item.qty,
            available: freshProduct?.current_stock ?? 0,
          })
        }
      }

      if (stockCheckErrors.length > 0) {
        setStockErrors(stockCheckErrors)
        toast.error('Stock validation failed. Please review quantities.')
        setSubmitting(false)
        return
      }

      // ---- STEP 2: Find or create customer (WITHOUT incrementing stats yet) ----
      let customerId = null
      const cleanPhone = customerPhone.trim().replace(/\s+/g, ' ')

      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, total_orders, total_spent')
        .eq('phone', cleanPhone)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert({
            name: customerName.trim(),
            phone: cleanPhone,
            total_orders: 0,
            total_spent: 0,
          })
          .select()
          .single()

        if (custErr) throw custErr
        customerId = newCustomer.id
      }

      // ---- STEP 3: Create Invoice ----
      const invoiceNum = `WS-INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNum,
          customer_id: customerId,
          customer_name: customerName.trim(),
          customer_phone: cleanPhone,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          taxable_amount: totals.taxableAmount,
          gst_amount: totals.gstAmount,
          grand_total: totals.grandTotal,
          payment_method: paymentMethod,
          payment_status: 'PAID',
          notes: notes.trim() || null,
          created_by: isValidUuid(user?.id) ? user.id : null,
          sale_channel: 'POS',
          channel: 'offline',
          order_status: 'confirmed',
        })
        .select()
        .single()

      if (invErr) throw invErr

      // ---- STEP 4: Create Invoice Items ----
      const invoiceItemsPayload = cart.map(item => {
        const lineSubtotal = item.selling_price * item.qty
        const discAmt = lineSubtotal * (item.discount_percentage / 100)
        const taxable = lineSubtotal - discAmt
        const gst = taxable * (item.gst_percentage / 100)
        const lineTotal = Math.round((taxable + gst) * 100) / 100

        return {
          invoice_id: invoice.id,
          product_id: item.id,
          product_id_code: item.product_id,
          product_name: item.name,
          product_type: item.product_type,
          mobile_brand: item.mobile_brand || null,
          mobile_model: item.mobile_model || null,
          quantity: item.qty,
          unit_price: item.selling_price,
          discount_pct: item.discount_percentage || 0,
          gst_pct: item.gst_percentage || 0,
          line_total: lineTotal,
        }
      })

      const { error: itemsErr } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsPayload)

      if (itemsErr) throw itemsErr

      // ---- STEP 4b: Update Customer Totals (ONLY AFTER INVOICE & ITEMS SUCCEED) ----
      if (customerId) {
        const { data: custInvoices } = await supabase
          .from('invoices')
          .select('grand_total, created_at')
          .eq('customer_id', customerId)

        const invList = custInvoices || []
        const exactOrders = invList.length
        const exactSpent = invList.reduce((s, inv) => s + Number(inv.grand_total || 0), 0)
        const sortedInvs = [...invList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        const exactLastPurchase = sortedInvs[0]?.created_at || new Date().toISOString()

        await supabase.from('customers').update({
          name: customerName.trim(),
          total_orders: exactOrders,
          total_spent: exactSpent,
          last_purchase_at: exactLastPurchase,
        }).eq('id', customerId)
      }

      // ── STEP 5: Atomic stock deduction via DB RPC (race-condition safe) ──
      // deduct_stock() uses SELECT ... FOR UPDATE (row-level lock).
      // If an online order already took the last unit between STEP 1 validation
      // and now, this will return success:false and we abort cleanly.
      const stockDeductErrors = []
      for (const item of cart) {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('deduct_stock', {
          p_product_id:   item.id,
          p_quantity:     item.qty,
          p_channel:      'POS',
          p_reference_id: invoice.id,
          p_performed_by: isValidUuid(user?.id) ? user.id : null,
        })

        if (rpcErr) {
          stockDeductErrors.push({ name: item.name, error: rpcErr.message })
          continue
        }

        if (!rpcResult?.success) {
          stockDeductErrors.push({
            name: item.name,
            requested: item.qty,
            available: rpcResult?.available ?? 0,
            error: rpcResult?.error || 'Insufficient stock',
          })
        }
      }

      if (stockDeductErrors.length > 0) {
        // Stock changed between validation and deduction (online order race)
        // Surface the error — invoice was created so mark as cancelled
        await supabase.from('invoices').update({ payment_status: 'CANCELLED' }).eq('id', invoice.id)
        setStockErrors(stockDeductErrors.map(e => ({
          name: e.name,
          requested: e.requested ?? 0,
          available: e.available ?? 0,
        })))
        toast.error('⚠ Stock changed by an online order! Sale aborted — please review cart quantities.')
        setSubmitting(false)
        return
      }

      // ---- STEP 6: Record Payment ----
      await supabase.from('payments').insert({
        invoice_id: invoice.id,
        amount: totals.grandTotal,
        payment_method: paymentMethod,
        reference: null,
      })

      // ---- STEP 7: Generate PDF & upload ----
      let uploadedPdfUrl = null
      try {
        const pdfBlob = await getInvoicePDFBlob({
          invoice,
          items: invoiceItemsPayload,
          store,
          logoUrl: store?.logo_url || null,
        })
        const pdfPath = `invoices/${invoice.invoice_number}.pdf`
        const { data: uploadData } = await supabase.storage.from('invoices').upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(pdfPath)
          uploadedPdfUrl = publicUrl
          invoice.pdf_url = publicUrl
          await supabase.from('invoices').update({ pdf_url: publicUrl }).eq('id', invoice.id)
        }
      } catch (pdfErr) {
        console.warn('PDF upload failed (non-fatal):', pdfErr)
      }

      // ---- STEP 8: Automatically send PDF through WhatsApp ----
      let whatsappRes = { success: false, status: 'PENDING' }
      try {
        whatsappRes = await sendWhatsAppInvoice({
          invoice,
          pdfUrl: uploadedPdfUrl,
          customerPhone: cleanPhone,
          grandTotal: totals.grandTotal,
          customerId,
        })

        if (whatsappRes.success) {
          toast.success(`Invoice created & sent to WhatsApp!`)
        } else {
          toast.success(`Invoice ${invoice.invoice_number} created!`)
          toast.error(`WhatsApp delivery: ${whatsappRes.error || 'Failed'}`)
        }
      } catch (waErr) {
        console.warn('WhatsApp dispatch warning:', waErr)
        toast.success(`Invoice ${invoice.invoice_number} created!`)
      }

      setSuccessData({
        invoice,
        items: invoiceItemsPayload,
        whatsappResult: whatsappRes,
      })
    } catch (err) {
      toast.error(err.message || 'Failed to complete sale. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Success modal */}
      {successData && (
        <SuccessModal
          invoice={successData.invoice}
          items={successData.items}
          store={store}
          whatsappResult={successData.whatsappResult}
          onClose={() => setSuccessData(null)}
          onNewSale={resetBilling}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* ---- LEFT: Product Search ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Search */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Search Products</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Type name, Product ID or model</span>
            </div>
            <div className="card-body">
              <ProductSearch onAddToCart={addToCart} />
            </div>
          </div>

          {/* Cart */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">
                Cart
                {cart.length > 0 && (
                  <span style={{ marginLeft: 8, background: 'var(--brand-black)', color: 'white', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700, padding: '1px 8px' }}>
                    {cart.length}
                  </span>
                )}
              </span>
              {cart.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setCart([])} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {cart.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div className="empty-state-icon"><ShoppingBag size={22} /></div>
                  <h3>Cart is empty</h3>
                  <p>Search and add products above to start a sale.</p>
                </div>
              ) : (
                <>
                  {cart.map(item => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onQtyChange={updateQty}
                      onRemove={removeFromCart}
                    />
                  ))}

                  {/* Stock errors */}
                  {stockErrors.length > 0 && (
                    <div style={{ marginTop: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>
                        <AlertCircle size={14} /> Stock Validation Failed
                      </div>
                      {stockErrors.map((err, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 3 }}>
                          <strong>{err.name}</strong>: Requested {err.requested} — Only {err.available} available
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ---- RIGHT: Customer + Totals ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Customer */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <User size={15} /> Customer
              </span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Customer Name <span className="required">*</span></label>
                <input
                  className="form-input"
                  placeholder="e.g. Rajan Kumar"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  id="customer-name"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                  WhatsApp Number <span className="required">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  id="customer-phone"
                  type="tel"
                />
                <div className="form-hint">Used for WhatsApp invoice delivery (Stage 3)</div>
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="card">
            <div className="card-header"><span className="card-title">Discount</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={discountPct}
                  onChange={e => setDiscountPct(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--brand-black)' }}
                  id="discount-slider"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={e => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                    style={{ width: 44, border: 'none', padding: '5px 6px', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', textAlign: 'center', outline: 'none' }}
                  />
                  <span style={{ padding: '0 8px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 14, borderLeft: '1.5px solid var(--border)' }}>%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="card">
            <div className="card-header"><span className="card-title">Summary</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {[
                  ['Subtotal', INR(totals.subtotal)],
                  discountPct > 0 ? [`Discount (${discountPct}%)`, '- ' + INR(totals.discountAmount)] : null,
                  ['Taxable Amount', INR(totals.taxableAmount)],
                  ['GST', INR(totals.gstAmount)],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                  <span>Grand Total</span>
                  <span>{INR(totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="card">
            <div className="card-header"><span className="card-title">Payment Method</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPaymentMethod(id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      border: `2px solid ${paymentMethod === id ? 'var(--brand-black)' : 'var(--border-strong)'}`,
                      borderRadius: 'var(--radius)',
                      background: paymentMethod === id ? '#f3f4f6' : 'white',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                      fontFamily: 'inherit',
                    }}
                    id={`payment-${id.toLowerCase()}`}
                  >
                    <Icon size={14} />
                    {label}
                    {paymentMethod === id && (
                      <CheckCircle2 size={13} style={{ marginLeft: 'auto', color: 'var(--success)' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Any remarks for this sale..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Complete Sale Button */}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '14px' }}
            onClick={handleCompleteSale}
            disabled={submitting || cart.length === 0 || !customerName || !customerPhone || hasStockIssues}
            id="complete-sale-btn"
          >
            {submitting
              ? <><div className="btn-spinner" /> Processing Sale...</>
              : <><CheckCircle2 size={17} /> Complete Sale — {INR(totals.grandTotal)}</>
            }
          </button>

          {hasStockIssues && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} />
              Some quantities exceed available stock. Please reduce them.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Billing
