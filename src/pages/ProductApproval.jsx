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

  const updateLocalProductStatus = (id, newStatus, reason = null) => {
    try {
      const local = getLocalProducts()
      const updated = local.map(p => {
        if (p.id === id) {
          return {
            ...p,
            approval_status: newStatus,
            rejection_reason: reason,
            updated_at: new Date().toISOString(),
          }
        }
        return p
      })
      localStorage.setItem('wrapstore_custom_products_v1', JSON.stringify(updated))
    } catch (e) {
      console.warn('Error updating local product status:', e)
    }
  }

  const fetchPending = async () => {
    setLoading(true)
    let dbProds = []
    try {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          subcategories(name),
          product_images(public_url, is_primary)
        `)
        .eq('approval_status', 'PENDING_APPROVAL')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      dbProds = data || []
    } catch (e) {
      console.warn('Error fetching pending products from DB:', e)
    }

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

    let validApprovedBy = null
    if (isValidUuid(user?.id)) {
      try {
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', user.id).single()
        if (prof?.id) validApprovedBy = prof.id
      } catch {
        validApprovedBy = null
      }
    }

    const payload = {
      approval_status: 'APPROVED',
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    }
    if (validApprovedBy) payload.approved_by = validApprovedBy

    let { error } = await supabase.from('products').update(payload).eq('id', productId)

    if (error && (error.message?.includes('approved_by') || error.message?.includes('foreign key constraint') || error.code === '23503')) {
      delete payload.approved_by
      const retry = await supabase.from('products').update(payload).eq('id', productId)
      error = retry.error
    }

    // Always update local storage product state if present
    updateLocalProductStatus(productId, 'APPROVED')

    if (error) {
      console.warn('DB approve update error:', error.message)
    }
    toast.success('Product approved!')

    fetchPending()
    setProcessing(null)
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason.')
      return
    }
    setProcessing(rejectModal)

    let validApprovedBy = null
    if (isValidUuid(user?.id)) {
      try {
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', user.id).single()
        if (prof?.id) validApprovedBy = prof.id
      } catch {
        validApprovedBy = null
      }
    }

    const payload = {
      approval_status: 'REJECTED',
      rejection_reason: rejectionReason.trim(),
      approved_at: new Date().toISOString(),
    }
    if (validApprovedBy) payload.approved_by = validApprovedBy

    let { error } = await supabase.from('products').update(payload).eq('id', rejectModal)

    if (error && (error.message?.includes('approved_by') || error.message?.includes('foreign key constraint') || error.code === '23503')) {
      delete payload.approved_by
      const retry = await supabase.from('products').update(payload).eq('id', rejectModal)
      error = retry.error
    }

    // Always update local storage product state if present
    updateLocalProductStatus(rejectModal, 'REJECTED', rejectionReason.trim())

    if (error) {
      console.warn('DB reject update error:', error.message)
    }
    toast.success('Product rejected with reason.')

    setRejectModal(null)
    setRejectionReason('')
    fetchPending()
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
                  {/* Image with Hover & Multi-Image Gallery Preview */}
                  <ProductImageHover src={imgUrl} images={p.product_images || p.images} title={p.name} alt={p.name} size={56} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                        {p.product_id || 'Pending ID'}
                      </code>
                      <span className="product-type-tag">{formatProductType(p)}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Submitted by {p.profiles?.full_name || p.profiles?.email || 'Store Manager'} ·{' '}
                      {new Date(p.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {p.mobile_model && ` · ${p.mobile_model}`}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div style={{ textAlign: 'right', marginRight: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹{Number(p.selling_price || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Stock: {p.current_stock || 0}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#10b981', color: '#ffffff', borderColor: '#10b981' }}
                      onClick={() => handleApprove(p.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <div className="btn-spinner" /> : <><CheckCircle2 size={13} /> Approve</>}
                    </button>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setRejectModal(p.id)}
                      disabled={isProcessing}
                    >
                      <XCircle size={13} /> Reject
                    </button>

                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => toggleExpand(p.id)}
                      title={isOpen ? 'Collapse' : 'Expand details'}
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isOpen && (
                  <div style={{
                    padding: '16px 20px',
                    background: '#f9fafb',
                    borderTop: '1px solid var(--border)',
                    fontSize: '13px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                  }}>
                    {/* Uploaded Images Gallery Grid */}
                    {((p.product_images && p.product_images.length > 0) || (p.images && p.images.length > 0)) && (
                      <div style={{ gridColumn: '1 / -1', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '12px', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ImageIcon size={14} color="#3b82f6" />
                          Uploaded Images ({(p.product_images || p.images).length})
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {(p.product_images || p.images).map((img, idx) => {
                            const url = typeof img === 'string' ? img : (img.public_url || img.preview)
                            const isPrimary = img.is_primary || idx === 0
                            return (
                              <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <ProductImageHover
                                  src={url}
                                  images={p.product_images || p.images}
                                  title={`${p.name} - Image ${idx + 1}`}
                                  size={64}
                                />
                                {isPrimary ? (
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    background: '#111827',
                                    color: '#ffffff',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    marginTop: '4px',
                                  }}>
                                    Primary
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Img {idx + 1}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 4 }}>
                        Category & Type
                      </div>
                      <div>{p.categories?.name || p.product_type}</div>
                      {p.subcategories?.name && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sub: {p.subcategories.name}</div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 4 }}>
                        Brand & Models
                      </div>
                      <div>{p.mobile_brand || 'Universal'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{p.mobile_model || 'All models'}</div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 4 }}>
                        Pricing Details
                      </div>
                      <div>Purchase: ₹{Number(p.purchase_price || 0).toLocaleString('en-IN')}</div>
                      <div>Selling: ₹{Number(p.selling_price || 0).toLocaleString('en-IN')}</div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 4 }}>
                        Stock Levels
                      </div>
                      <div>Current Stock: {p.current_stock || 0} units</div>
                      <div>Min Alert: {p.min_stock_level || 5} units</div>
                    </div>

                    {p.description && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 4 }}>
                          Description
                        </div>
                        <div>{p.description}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Reject Product</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setRejectModal(null)}>
                <XCircle size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  Rejection Reason <span className="required">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. Incorrect pricing structure, missing high-res images..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
              >
                Reject Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductApproval
