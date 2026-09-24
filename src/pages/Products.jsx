import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Filter, Edit2, Trash2, Eye, Package,
  ArrowUpDown, ChevronLeft, ChevronRight, MoreVertical,
  Smartphone, Image as ImageIcon
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

const APPROVAL_BADGE = {
  PENDING_APPROVAL: { class: 'badge-pending', label: 'Pending' },
  APPROVED: { class: 'badge-success', label: 'Approved' },
  REJECTED: { class: 'badge-danger', label: 'Rejected' },
}

const PAGE_SIZE = 15

const Products = () => {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()

  const getLocalProducts = () => {
    try {
      const stored = localStorage.getItem('wrapstore_custom_products_v1')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const fetchProducts = async () => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(`
        *,
        categories(name),
        subcategories(name),
        product_images(public_url, is_primary)
      `, { count: 'exact' })
      .eq('is_active', true)

    if (search) {
      query = query.or(`name.ilike.%${search}%,product_id.ilike.%${search}%,mobile_model.ilike.%${search}%,mobile_brand.ilike.%${search}%`)
    }
    if (typeFilter) {
      query = query.or(`category_id.eq.${typeFilter},product_type.eq.${typeFilter}`)
    }
    if (statusFilter) query = query.eq('approval_status', statusFilter)

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count, error } = await query
    const dbProds = data || []
    const localProds = getLocalProducts().filter(p => p.is_active !== false)

    const merged = [...dbProds]
    for (const lp of localProds) {
      if (!merged.some(p => p.id === lp.id || p.name.toLowerCase() === lp.name.toLowerCase())) {
        merged.unshift(lp)
      }
    }

    setProducts(merged)
    setTotal((count || 0) + localProds.filter(lp => !dbProds.some(p => p.id === lp.id)).length)
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [search, typeFilter, statusFilter, sortField, sortDir, page])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      // 1. Fetch storage_path for all images of the target product
      const { data: imgRows, error: fetchErr } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('product_id', deleteId)

      if (fetchErr) {
        console.error('Failed to fetch product image storage paths before deletion:', fetchErr)
        toast.error(`Failed to prepare product deletion: ${fetchErr.message}`)
        setDeleting(false)
        return
      }

      const storagePaths = (imgRows || []).map(r => r.storage_path).filter(Boolean)

      // 2. Delete physical files using Supabase Storage API
      if (storagePaths.length > 0) {
        const { data: removeData, error: removeErr } = await supabase
          .storage
          .from('product-images')
          .remove(storagePaths)

        if (removeErr) {
          console.error('Storage deletion failed for paths:', storagePaths, removeErr)
          toast.error(`Storage image deletion failed: ${removeErr.message}. Aborting product deletion.`)
          setDeleting(false)
          return
        }

        console.log('Successfully removed storage objects:', removeData)
      }

      // 3. Only after successful Storage deletion, delete the product record from database
      const { error: dbErr } = await supabase.from('products').delete().eq('id', deleteId)
      if (dbErr) {
        if (dbErr.code === '23503') {
          const { error: softErr } = await supabase.from('products').update({ is_active: false }).eq('id', deleteId)
          if (softErr) {
            toast.error(softErr.message)
          } else {
            toast.success('Product is linked to sales records, so it was archived.')
            setDeleteId(null)
            fetchProducts()
          }
        } else {
          toast.error(dbErr.message)
        }
      } else {
        toast.success('Product and associated images deleted successfully.')
        setDeleteId(null)
        fetchProducts()
      }
    } catch (err) {
      console.error('Unexpected error during product deletion:', err)
      toast.error('An unexpected error occurred while deleting the product.')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const formatCurrency = (v) => '₹' + Number(v).toLocaleString('en-IN')

  const getStockStatus = (p) => {
    if (p.current_stock === 0) return { label: 'OUT OF STOCK', class: 'badge-danger' }
    if (p.current_stock <= p.min_stock_level) return { label: 'LOW STOCK', class: 'badge-warning' }
    return { label: 'IN STOCK', class: 'badge-success' }
  }

  const getPrimaryImage = (images) =>
    images?.find(i => i.is_primary)?.public_url || images?.[0]?.public_url || null

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Products</div>
          <div className="section-subtitle">{total} products total</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/products/add')} id="add-product-btn">
          <Plus size={14} /> Add Product
        </button>
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
            id="product-search"
          />
        </div>

        <select
          className="filter-select"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          id="type-filter"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          id="status-filter"
        >
          <option value="">All Status</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="REJECTED">Rejected</option>
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
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', width: '100%' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>Image</th>
                    <th onClick={() => handleSort('product_id')} style={{ width: 110 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Product ID <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('name')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Product Name <ArrowUpDown size={11} /></span>
                    </th>
                    <th style={{ width: 140 }}>Category</th>
                    <th style={{ width: 180 }}>Brand / Models</th>
                    <th onClick={() => handleSort('selling_price')} style={{ width: 110 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Price <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('current_stock')} style={{ width: 100 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Stock <ArrowUpDown size={11} /></span>
                    </th>
                    <th style={{ width: 120 }}>Stock Status</th>
                    <th style={{ width: 130 }}>Approval</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const imgUrl = getPrimaryImage(p.product_images)
                    const stockStatus = getStockStatus(p)
                    const appStatus = APPROVAL_BADGE[p.approval_status] || APPROVAL_BADGE.PENDING_APPROVAL

                    return (
                      <tr key={p.id}>
                        <td>
                          <ProductImageHover src={imgUrl} images={p.product_images || p.images} title={p.name} alt={p.name} size={40} />
                        </td>
                        <td>
                          <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                            {p.product_id || 'PENDING'}
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
                          {p.approval_status === 'REJECTED' && p.rejection_reason && (
                            <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 2 }}>
                              ✕ {p.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="product-type-tag">
                            <Smartphone size={10} />
                            {formatProductType(p)}
                          </span>
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
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{formatCurrency(p.selling_price)}</div>
                          {p.gst_percentage > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{p.gst_percentage}% GST</div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.current_stock}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>min {p.min_stock_level}</div>
                        </td>
                        <td>
                          <span className={`badge ${stockStatus.class}`}>{stockStatus.label}</span>
                        </td>
                        <td>
                          <span className={`badge ${appStatus.class}`}>{appStatus.label}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => navigate(`/products/edit/${p.id}`)}
                              title="Edit product"
                            >
                              <Edit2 size={13} />
                            </button>
                            {isSuperAdmin && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => setDeleteId(p.id)}
                                title="Remove product"
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
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
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} products
                </div>
                <div className="pagination-buttons">
                  <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + Math.max(1, page - 2)
                    if (p > totalPages) return null
                    return (
                      <button
                        key={p}
                        className={`pagination-btn ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
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

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Product</span>
            </div>
            <div className="modal-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete this product? It will be permanently deleted from the database.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><div className="btn-spinner" /> Deleting...</> : <><Trash2 size={13} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products
