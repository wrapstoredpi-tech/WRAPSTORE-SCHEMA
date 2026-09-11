import React, { useState, useEffect, useMemo } from 'react'
import {
  ShoppingBag, Plus, Search, Filter, Edit2, Trash2,
  Calendar, RefreshCw, DollarSign, TrendingUp,
  Package, User, Globe, ArrowUpRight, CheckCircle2,
  Layers, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CHANNELS = [
  { id: 'Website', label: 'Website', color: '#3b82f6', bg: '#eff6ff' },
  { id: 'Amazon', label: 'Amazon', color: '#f59e0b', bg: '#fef3c7' },
  { id: 'Flipkart', label: 'Flipkart', color: '#10b981', bg: '#ecfdf5' },
  { id: 'Instagram', label: 'Instagram', color: '#ec4899', bg: '#fce7f3' },
  { id: 'WhatsApp', label: 'WhatsApp', color: '#22c55e', bg: '#f0fdf4' },
  { id: 'Other', label: 'Other / Direct', color: '#6b7280', bg: '#f3f4f6' },
]

const LOCAL_STORAGE_KEY = 'wrapstore_online_sales_local_v1'

const OnlineSales = () => {
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [dateRange, setDateRange] = useState('month') // 'today', 'yesterday', 'week', 'month', 'all', 'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingSale, setDeletingSale] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    channel: 'Website',
    unitPrice: '',
    totalAmount: '',
    customerName: '',
    saleDate: new Date().toISOString().split('T')[0],
    notes: '',
  })

  // Fetch Products & Sales
  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch active products
      const { data: prodData } = await supabase
        .from('products')
        .select(`
          id, name, product_id, mobile_model, current_stock, selling_price, min_stock_level,
          product_images(public_url, is_primary)
        `)
        .eq('is_active', true)
        .order('name')

      setProducts(prodData || [])

      // 2. Fetch Online Sales
      const { data: salesData, error: salesErr } = await supabase
        .from('online_sales')
        .select(`
          *,
          products(id, name, product_id, mobile_model, current_stock, product_images(public_url, is_primary))
        `)
        .order('sale_date', { ascending: false })

      if (!salesErr && salesData) {
        setSales(salesData)
      } else {
        // Fallback to local storage if database table is not created yet
        const local = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (local) {
          try {
            setSales(JSON.parse(local))
          } catch {
            setSales([])
          }
        }
      }
    } catch (err) {
      console.error('Error fetching online sales:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Save to local storage sync
  const updateLocalSales = (newSales) => {
    setSales(newSales)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSales))
    } catch (e) {
      console.warn('Failed to save to local storage', e)
    }
  }

  // Handle Product Change in Form
  const handleProductChange = (prodId) => {
    const selected = products.find(p => p.id === prodId)
    const price = selected ? selected.selling_price || 0 : 0
    const qty = Number(formData.quantity) || 1
    setFormData(prev => ({
      ...prev,
      productId: prodId,
      unitPrice: price,
      totalAmount: price * qty,
    }))
  }

  // Handle Quantity Change
  const handleQtyChange = (qtyVal) => {
    const qty = Math.max(1, Number(qtyVal) || 1)
    const price = Number(formData.unitPrice) || 0
    setFormData(prev => ({
      ...prev,
      quantity: qty,
      totalAmount: price * qty,
    }))
  }

  // Handle Unit Price Change
  const handlePriceChange = (priceVal) => {
    const price = Number(priceVal) || 0
    const qty = Number(formData.quantity) || 1
    setFormData(prev => ({
      ...prev,
      unitPrice: priceVal,
      totalAmount: price * qty,
    }))
  }

  // Open Modal for New Sale
  const handleOpenAddModal = () => {
    const defaultProd = products[0]
    const price = defaultProd ? defaultProd.selling_price || 0 : ''
    setEditingSale(null)
    setFormData({
      productId: defaultProd ? defaultProd.id : '',
      quantity: 1,
      channel: 'Website',
      unitPrice: price,
      totalAmount: price ? price * 1 : '',
      customerName: '',
      saleDate: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setShowModal(true)
  }

  // Open Modal for Editing Sale
  const handleOpenEditModal = (sale) => {
    setEditingSale(sale)
    setFormData({
      productId: sale.product_id,
      quantity: sale.quantity,
      channel: sale.channel || 'Website',
      unitPrice: sale.unit_price,
      totalAmount: sale.total_amount,
      customerName: sale.customer_name || '',
      saleDate: sale.sale_date ? sale.sale_date.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: sale.notes || '',
    })
    setShowModal(true)
  }

  // Submit Form (Create / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.productId) {
      toast.error('Please select a product')
      return
    }

    const qty = Number(formData.quantity)
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    const selectedProd = products.find(p => p.id === formData.productId)
    if (!selectedProd) {
      toast.error('Product not found')
      return
    }

    setSaving(true)
    try {
      if (editingSale) {
        // ---- EDIT EXISTING ONLINE SALE ----
        const oldQty = Number(editingSale.quantity)
        const oldProdId = editingSale.product_id
        const newProdId = formData.productId

        // 1. Adjust Inventory Stock
        if (oldProdId === newProdId) {
          const qtyDiff = qty - oldQty
          const updatedStock = Math.max(0, selectedProd.current_stock - qtyDiff)
          await supabase.from('products').update({ current_stock: updatedStock }).eq('id', newProdId)
          
          // Log movement
          if (qtyDiff !== 0) {
            await supabase.from('inventory_movements').insert({
              product_id: newProdId,
              movement_type: qtyDiff > 0 ? 'REMOVE_STOCK' : 'ADD_STOCK',
              quantity_change: -qtyDiff,
              previous_stock: selectedProd.current_stock,
              new_stock: updatedStock,
              notes: `Online Sale Edit (${formData.channel})`,
              performed_by: user?.id || null,
            })
          }
        } else {
          // Changed product: restore old product stock, deduct new product stock
          const oldProd = products.find(p => p.id === oldProdId)
          if (oldProd) {
            const restoredStock = oldProd.current_stock + oldQty
            await supabase.from('products').update({ current_stock: restoredStock }).eq('id', oldProdId)
          }

          const newStock = Math.max(0, selectedProd.current_stock - qty)
          await supabase.from('products').update({ current_stock: newStock }).eq('id', newProdId)

          // Log movement
          await supabase.from('inventory_movements').insert({
            product_id: newProdId,
            movement_type: 'REMOVE_STOCK',
            quantity_change: -qty,
            previous_stock: selectedProd.current_stock,
            new_stock: newStock,
            notes: `Online Sale Item Swapped (${formData.channel})`,
            performed_by: user?.id || null,
          })
        }

        // 2. Update Online Sale Record
        const payload = {
          product_id: formData.productId,
          quantity: qty,
          channel: formData.channel,
          unit_price: Number(formData.unitPrice) || 0,
          total_amount: Number(formData.totalAmount) || 0,
          customer_name: formData.customerName,
          sale_date: new Date(formData.saleDate).toISOString(),
          notes: formData.notes,
          updated_at: new Date().toISOString(),
        }

        const { error: updateErr } = await supabase.from('online_sales').update(payload).eq('id', editingSale.id)

        // Fallback local update
        const updatedSales = sales.map(s => {
          if (s.id === editingSale.id) {
            return {
              ...s,
              ...payload,
              products: selectedProd,
            }
          }
          return s
        })
        updateLocalSales(updatedSales)

        toast.success('Online sale updated & inventory stock adjusted!')
      } else {
        // ---- CREATE NEW ONLINE SALE ----
        // 1. Deduct Product Stock
        const newStock = Math.max(0, selectedProd.current_stock - qty)
        await supabase.from('products').update({ current_stock: newStock }).eq('id', formData.productId)

        // 2. Log Movement Audit
        await supabase.from('inventory_movements').insert({
          product_id: formData.productId,
          movement_type: 'REMOVE_STOCK',
          quantity_change: -qty,
          previous_stock: selectedProd.current_stock,
          new_stock: newStock,
          notes: `Online Sale (${formData.channel}) - ${formData.customerName || 'Direct'}`,
          performed_by: user?.id || null,
        })

        // 3. Insert Online Sale Record
        const newRecord = {
          id: 'os-' + Date.now(),
          product_id: formData.productId,
          quantity: qty,
          channel: formData.channel,
          unit_price: Number(formData.unitPrice) || 0,
          total_amount: Number(formData.totalAmount) || 0,
          customer_name: formData.customerName,
          sale_date: new Date(formData.saleDate).toISOString(),
          notes: formData.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { data: inserted, error: insertErr } = await supabase.from('online_sales').insert(newRecord).select('*, products(*)').single()

        if (!insertErr && inserted) {
          setSales(prev => [inserted, ...prev])
        } else {
          // Local fallback
          const localRecord = {
            ...newRecord,
            products: selectedProd,
          }
          updateLocalSales([localRecord, ...sales])
        }

        toast.success('Online sale recorded & inventory deducted!')
      }

      setShowModal(false)
      fetchData() // Refresh list & stock counts
    } catch (err) {
      console.error('Error saving online sale:', err)
      toast.error('Failed to save online sale')
    } finally {
      setSaving(false)
    }
  }

  // Delete Online Sale
  const handleDelete = async () => {
    if (!deletingSale) return
    setSaving(true)
    try {
      const saleProd = products.find(p => p.id === deletingSale.product_id)
      
      // 1. Restore stock to product
      if (saleProd) {
        const restoredStock = saleProd.current_stock + Number(deletingSale.quantity)
        await supabase.from('products').update({ current_stock: restoredStock }).eq('id', saleProd.id)

        // Log movement
        await supabase.from('inventory_movements').insert({
          product_id: saleProd.id,
          movement_type: 'ADD_STOCK',
          quantity_change: Number(deletingSale.quantity),
          previous_stock: saleProd.current_stock,
          new_stock: restoredStock,
          notes: `Cancelled Online Sale (${deletingSale.channel})`,
          performed_by: user?.id || null,
        })
      }

      // 2. Delete from DB / Local
      await supabase.from('online_sales').delete().eq('id', deletingSale.id)

      const remaining = sales.filter(s => s.id !== deletingSale.id)
      updateLocalSales(remaining)

      toast.success('Online sale deleted & inventory restored!')
      setDeletingSale(null)
      fetchData()
    } catch (err) {
      console.error('Error deleting online sale:', err)
      toast.error('Failed to delete online sale')
    } finally {
      setSaving(false)
    }
  }

  // Calculate date range bounds
  const getBounds = () => {
    const now = new Date()
    let start = null
    let end = null

    if (dateRange === 'today') {
      start = new Date()
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'yesterday') {
      start = new Date()
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'week') {
      start = new Date()
      const day = now.getDay() || 7
      start.setDate(now.getDate() - day + 1)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (dateRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (dateRange === 'custom') {
      if (customStart) start = new Date(customStart + 'T00:00:00')
      if (customEnd) end = new Date(customEnd + 'T23:59:59')
    }

    return { start, end }
  }

  // Filter Sales by Date Range
  const dateFilteredSales = useMemo(() => {
    const { start, end } = getBounds()
    if (!start && !end) return sales

    return sales.filter(s => {
      const sDate = new Date(s.sale_date || s.created_at)
      if (start && sDate < start) return false
      if (end && sDate > end) return false
      return true
    })
  }, [sales, dateRange, customStart, customEnd])

  // Filtered Sales (Date range + Search + Channel)
  const filteredSales = useMemo(() => {
    return dateFilteredSales.filter(s => {
      const prodName = s.products?.name || s.product_name || ''
      const prodCode = s.products?.product_id || ''
      const model = s.products?.mobile_model || ''
      const customer = s.customer_name || ''
      const notes = s.notes || ''
      const channel = s.channel || ''

      const matchesSearch =
        !search ||
        prodName.toLowerCase().includes(search.toLowerCase()) ||
        prodCode.toLowerCase().includes(search.toLowerCase()) ||
        model.toLowerCase().includes(search.toLowerCase()) ||
        customer.toLowerCase().includes(search.toLowerCase()) ||
        notes.toLowerCase().includes(search.toLowerCase())

      const matchesChannel = !channelFilter || channelFilter === 'ALL' || channel === channelFilter

      return matchesSearch && matchesChannel
    })
  }, [dateFilteredSales, search, channelFilter])

  // Summary Metrics (Computed from Date Filtered Sales)
  const metrics = useMemo(() => {
    const totalRev = dateFilteredSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0)
    const totalUnits = dateFilteredSales.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0)
    const totalTx = dateFilteredSales.length

    // Channel breakdown
    const channelCounts = {}
    dateFilteredSales.forEach(s => {
      const ch = s.channel || 'Website'
      channelCounts[ch] = (channelCounts[ch] || 0) + 1
    })

    let topChannel = 'Website'
    let maxCount = 0
    Object.entries(channelCounts).forEach(([ch, count]) => {
      if (count > maxCount) {
        maxCount = count
        topChannel = ch
      }
    })

    return { totalRev, totalUnits, totalTx, topChannel }
  }, [dateFilteredSales])

  const formatCurrency = (val) => '₹' + Number(val || 0).toLocaleString('en-IN')

  const getPrimaryImage = (images) =>
    images?.find(i => i.is_primary)?.public_url || images?.[0]?.public_url || null

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Online Sale</div>
          <div className="section-subtitle">Record & manage sales from online channels and sync inventory</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchData} title="Refresh data">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal} id="add-online-sale-btn">
            <Plus size={14} /> Record Online Sale
          </button>
        </div>
      </div>

      {/* Date Range Bar (on top of 4 cards) */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Calendar size={15} color="var(--text-muted)" style={{ marginRight: 4 }} />
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`btn btn-sm ${dateRange === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius)' }}
                onClick={() => setDateRange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                className="filter-select"
                style={{ padding: '4px 8px', fontSize: 12 }}
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="filter-select"
                style={{ padding: '4px 8px', fontSize: 12 }}
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ecfdf5' }}>
            <TrendingUp size={20} color="#10b981" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">TOTAL ONLINE REVENUE</div>
            <div className="stat-value">{formatCurrency(metrics.totalRev)}</div>
            <div className="stat-sub">From {metrics.totalTx} online sales</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff' }}>
            <Package size={20} color="#3b82f6" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">UNITS SOLD ONLINE</div>
            <div className="stat-value">{metrics.totalUnits}</div>
            <div className="stat-sub">Stock deducted from inventory</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7' }}>
            <ShoppingBag size={20} color="#f59e0b" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">TOTAL TRANSACTIONS</div>
            <div className="stat-value">{metrics.totalTx}</div>
            <div className="stat-sub">Fulfilled online orders</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fce7f3' }}>
            <Globe size={20} color="#ec4899" strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-label">TOP CHANNEL</div>
            <div className="stat-value">{metrics.topChannel}</div>
            <div className="stat-sub">Highest sale volume</div>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by product, ID, model, customer, order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
        >
          <option value="">All Channels</option>
          {CHANNELS.map(ch => (
            <option key={ch.id} value={ch.id}>{ch.label}</option>
          ))}
        </select>
      </div>

      {/* Sales Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Loading online sales...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={40} strokeWidth={1.2} style={{ color: 'var(--text-tertiary)' }} />
            <div className="empty-title">No Online Sales Recorded</div>
            <div className="empty-subtitle">
              {search || channelFilter ? 'No sales match your current search filters.' : 'Click "Record Online Sale" to log sales made on Website, Amazon, Instagram, etc.'}
            </div>
            <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ marginTop: '12px' }}>
              <Plus size={14} /> Record Online Sale
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>PRODUCT</th>
                  <th>ID CODE</th>
                  <th>CHANNEL</th>
                  <th style={{ textAlign: 'center' }}>QTY</th>
                  <th style={{ textAlign: 'right' }}>UNIT PRICE</th>
                  <th style={{ textAlign: 'right' }}>TOTAL</th>
                  <th>CUSTOMER / REF</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const prod = sale.products || {}
                  const imgUrl = getPrimaryImage(prod.product_images)
                  const channelObj = CHANNELS.find(c => c.id === sale.channel) || { label: sale.channel || 'Website', color: '#6b7280', bg: '#f3f4f6' }
                  const dateFormatted = new Date(sale.sale_date || sale.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })

                  return (
                    <tr key={sale.id}>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dateFormatted}</div>
                        <div style={{ fontSize: '11px' }}>
                          {new Date(sale.sale_date || sale.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {imgUrl ? (
                            <img src={imgUrl} alt={prod.name} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                              <Package size={18} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name || sale.product_name || 'Product'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{prod.mobile_model || '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="code-badge">{prod.product_id || 'WS-00000'}</span>
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: channelObj.bg,
                          color: channelObj.color,
                        }}>
                          {channelObj.label}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
                        {sale.quantity}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatCurrency(sale.unit_price)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {formatCurrency(sale.total_amount)}
                      </td>

                      <td style={{ fontSize: '12px' }}>
                        {sale.customer_name ? (
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sale.customer_name}</div>
                        ) : (
                          <div style={{ color: 'var(--text-tertiary)' }}>Direct Customer</div>
                        )}
                        {sale.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{sale.notes}</div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="icon-btn"
                            title="Edit Online Sale"
                            onClick={() => handleOpenEditModal(sale)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="icon-btn icon-btn-danger"
                            title="Delete Online Sale & Restore Inventory"
                            onClick={() => setDeletingSale(sale)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <span className="modal-title">
                {editingSale ? 'Edit Online Sale' : 'Record Online Sale'}
              </span>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Product Selector */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Select Product <span className="required">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.productId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Select a Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.product_id || 'WS-0000'}) — Stock: {p.current_stock} units
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Product Stock Preview */}
                {formData.productId && (
                  (() => {
                    const sel = products.find(p => p.id === formData.productId)
                    if (!sel) return null
                    return (
                      <div style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border-strong)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Package size={16} color="var(--brand-black)" />
                          <span>
                            Current Stock: <strong style={{ color: sel.current_stock === 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                              {sel.current_stock} units
                            </strong>
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          Selling Price: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sel.selling_price)}</strong>
                        </div>
                      </div>
                    )
                  })()
                )}

                {/* Sales Channel Pill Selector */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Sales Channel <span className="required">*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {CHANNELS.map(ch => {
                      const isSelected = formData.channel === ch.id
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, channel: ch.id }))}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: isSelected ? `2px solid ${ch.color}` : '1.5px solid var(--border-strong)',
                            background: isSelected ? ch.bg : 'white',
                            color: isSelected ? ch.color : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isSelected && <CheckCircle2 size={13} />}
                          {ch.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="form-row">
                  {/* Quantity */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      Quantity Sold <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={formData.quantity}
                      onChange={(e) => handleQtyChange(e.target.value)}
                      required
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Unit Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.unitPrice}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-row">
                  {/* Total Amount */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Total Sale Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      style={{ fontWeight: 700, color: 'var(--text-primary)' }}
                      value={formData.totalAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Sale Date */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Sale Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.saleDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, saleDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-row">
                  {/* Customer Name */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Customer / Buyer Details</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. John Doe, @insta_handle"
                      value={formData.customerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    />
                  </div>

                  {/* Order Reference */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Order Ref # / Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Order #1049, Tracking #"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Stock Deduction Note */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} flexShrink={0} />
                  <span>
                    Saving will deduct <strong>{formData.quantity || 1} unit(s)</strong> from available stock.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <><div className="btn-spinner" /> Saving...</>
                  ) : editingSale ? (
                    <><Edit2 size={13} /> Update Sale</>
                  ) : (
                    <><Plus size={13} /> Record Sale</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingSale && (
        <div className="modal-overlay" onClick={() => setDeletingSale(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Online Sale</span>
            </div>
            <div className="modal-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete this online sale?
              <br />
              <strong style={{ color: 'var(--success)', marginTop: '8px', display: 'block' }}>
                ✓ {deletingSale.quantity} unit(s) will be automatically restored back to inventory stock.
              </strong>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingSale(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? <><div className="btn-spinner" /> Restoring...</> : <><Trash2 size={13} /> Delete & Restore Stock</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OnlineSales
