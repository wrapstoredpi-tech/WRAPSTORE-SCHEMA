import React, { useEffect, useState } from 'react'
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, Eye,
  Image as ImageIcon, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ProductImageHover from '../components/common/ProductImageHover'

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

const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

const ProductApproval = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(null)
  const { user } = useAuth()

  const getLocalProducts = () => {
    try {
      const stored = localStorage.getItem('wrapstore_custom_products_v1')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const fetchPending = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories(name),
        subcategories(name),
        product_images(public_url, is_primary),
        profiles!products_created_by_fkey(full_name, email)
      `)
      .eq('approval_status', 'PENDING_APPROVAL')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const dbProds = data || []
    const localPending = getLocalProducts().filter(p => p.approval_status === 'PENDING_APPROVAL' && p.is_active !== false)

    const merged = [...dbProds]
    for (const lp of localPending) {
      if (!merged.some(p => p.id === lp.id)) {
        merged.unshift(lp)
      }
    }

    setProducts(merged)
    setLoading(false)
  }

  useEffect(() => { fetchPending() }, [])

  const handleApprove = async (productId) => {
    setProcessing(productId)
    const validUserUuid = isValidUuid(user?.id) ? user.id : null
    const { error } = await supabase.from('products').update({
      approval_status: 'APPROVED',
      approved_by: validUserUuid,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    }).eq('id', productId)

    if (error) toast.error(error.message)
    else {
      toast.success('Product approved!')
      fetchPending()
    }
    setProcessing(null)
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason.')
      return
    }
    setProcessing(rejectModal)
    const validUserUuid = isValidUuid(user?.id) ? user.id : null
    const { error } = await supabase.from('products').update({
      approval_status: 'REJECTED',
      rejection_reason: rejectionReason.trim(),
      approved_by: validUserUuid,
      approved_at: new Date().toISOString(),
    }).eq('id', rejectModal)

    if (error) toast.error(error.message)
    else {
      toast.success('Product rejected with reason.')
      setRejectModal(null)
      setRejectionReason('')
      fetchPending()
    }
    setProcessing(null)
  }

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  const getPrimaryImage = (images) => images?.find(i => i.is_primary)?.public_url || images?.[0]?.public_url || null

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /></div>
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} />
            Product Approvals
          </div>
          <div className="section-subtitle">
            {products.length} product{products.length !== 1 ? 's' : ''} awaiting review
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchPending}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--success-bg)' }}>
            <CheckCircle2 size={24} color="var(--success)" />
          </div>
          <h3>All caught up!</h3>
          <p>No products pending approval at this time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {products.map(p => {
            const isOpen = expanded[p.id]
            const imgUrl = getPrimaryImage(p.product_images)
            const isProcessing = processing === p.id

            return (
              <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Summary Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
                  {/* Image with Hover Preview */}
                  <ProductImageHover src={imgUrl} title={p.name} alt={p.name} size={56} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                        Pending ID
                      </code>
                      <span className="product-type-tag">{formatProductType(p)}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Submitted by {p.profiles?.full_name || p.profiles?.email || 'Unknown'} ·{' '}
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {p.mobile_model && ` · ${p.mobile_model}`}
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px' }}>
                      ₹{Number(p.selling_price).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stock: {p.current_stock}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      className="btn btn-success"
                      onClick={() => handleApprove(p.id)}
                      disabled={isProcessing}
                      id={`approve-${p.id}`}
                    >
                      {isProcessing ? <div className="btn-spinner" /> : <CheckCircle2 size={14} />}
                      Approve
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => { setRejectModal(p.id); setRejectionReason('') }}
                      disabled={isProcessing}
                      id={`reject-${p.id}`}
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => toggleExpand(p.id)}
                      title={isOpen ? 'Collapse' : 'Expand details'}
                    >
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px', background: '#fafafa', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Product Details</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                        {[
                          ['Type', formatProductType(p)],
                          ['Category', p.categories?.name || '—'],
                          ['Subcategory', p.subcategories?.name || '—'],
                          ['Brand', p.mobile_brand || '—'],
                          ['Model', p.mobile_model || '—'],
                          ['Colors', p.color_variants || '—'],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>{k}</span>
                            <span style={{ fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Pricing & Stock</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                        {[
                          ['Purchase Price', `₹${Number(p.purchase_price || 0).toLocaleString('en-IN')}`],
                          ['Selling Price', `₹${Number(p.selling_price || 0).toLocaleString('en-IN')}`],
                          ['Discount', `${p.discount_percentage || 0}%`],
                          ['GST', `${p.gst_percentage || 0}%`],
                          ['Initial Stock', p.current_stock ?? 0],
                          ['Min Stock Level', p.min_stock_level ?? 0],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', minWidth: '100px' }}>{k}</span>
                            <span style={{ fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Images ({p.product_images?.length || 0})</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {p.product_images?.length > 0 ? (
                          p.product_images.map(img => (
                            <div key={img.public_url} style={{ width: 64, height: 64, borderRadius: 'var(--radius)', overflow: 'hidden', border: `2px solid ${img.is_primary ? 'var(--brand-black)' : 'var(--border)'}` }}>
                              <img src={img.public_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No images uploaded</div>
                        )}
                      </div>
                      {p.description && (
                        <div style={{ marginTop: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Description</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p.description}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={16} /> Reject Product
              </span>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                The store manager will see this reason and can edit the product before resubmitting.
              </p>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Rejection Reason <span className="required">*</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. Incorrect pricing, missing product images, wrong category..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing}
                id="confirm-reject-btn"
              >
                {processing ? <><div className="btn-spinner" /> Rejecting...</> : <><XCircle size={13} /> Reject Product</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductApproval
