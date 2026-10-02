import React, { useState, useEffect } from 'react'
import {
  PackagePlus, Plus, Search, Trash2, Check, X,
  ShoppingBag, ShieldCheck, Layers, ArrowLeft,
  Info, History, Tag, Smartphone, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fetchMergedCategories } from '../lib/categoryStorage'
import ProductImageHover from '../components/common/ProductImageHover'

const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)
const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const AddCombo = () => {
  const { user } = useAuth()
  const [combos, setCombos] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  // Category Filter State
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // Combo Form State
  const [comboName, setComboName] = useState('')
  const [description, setDescription] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [selectedItems, setSelectedItems] = useState([]) // Array of { product, allottedQty }
  const [savingCombo, setSavingCombo] = useState(false)

  // Fetch saved combos from localStorage / DB
  const fetchCombos = () => {
    try {
      const stored = localStorage.getItem('wrapstore_combos_v1')
      setCombos(stored ? JSON.parse(stored) : [])
    } catch (e) {
      console.warn('Error reading combos:', e)
      setCombos([])
    }
  }

  // Fetch active inventory products for selection
  const fetchInventory = async () => {
    setLoadingProducts(true)
    try {
      const { data } = await supabase
        .from('products')
        .select('*, categories(id, name, slug), product_images(public_url, is_primary)')
        .eq('approval_status', 'APPROVED')
        .eq('is_active', true)
        .order('name')

      setInventoryProducts(data || [])
    } catch (err) {
      console.error('Failed to fetch inventory for combo:', err)
      toast.error('Failed to load inventory products')
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    fetchCombos()
    fetchInventory()
    fetchMergedCategories().then(res => setCategories(res.categories || []))
  }, [])

  const handleOpenModal = () => {
    setComboName('')
    setDescription('')
    setSellingPrice('')
    setSelectedItems([])
    setProductSearch('')
    setSelectedCategory('ALL')
    setIsModalOpen(true)
  }

  const handleToggleProduct = (product) => {
    setSelectedItems(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.filter(item => item.product.id !== product.id)
      } else {
        return [...prev, { product, allottedQty: 1 }]
      }
    })
  }

  const handleQtyChange = (productId, newQty) => {
    const qty = Math.max(1, Number(newQty) || 1)
    setSelectedItems(prev =>
      prev.map(item => item.product.id === productId ? { ...item, allottedQty: qty } : item)
    )
  }

  // Calculate regular total price of selected items
  const totalRegularValue = selectedItems.reduce(
    (sum, item) => sum + (Number(item.product.selling_price) || 0) * item.allottedQty,
    0
  )

  const handleCreateCombo = async (e) => {
    e.preventDefault()

    if (!comboName.trim()) {
      toast.error('Please enter a combo name')
      return
    }

    if (selectedItems.length === 0) {
      toast.error('Please select at least one product from inventory for the combo')
      return
    }

    const price = Number(sellingPrice)
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid combo selling price')
      return
    }

    setSavingCombo(true)

    try {
      const comboId = `combo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const comboCode = `WS-CMB-${Math.floor(1000 + Math.random() * 9000)}`

      // 1. Log inventory movement for EACH allotted product
      // Note: As specified, main stock is NOT deducted (new_stock = previous_stock)
      const movementEntries = []
      for (const item of selectedItems) {
        const p = item.product
        const allotted = item.allottedQty
        const currentStock = p.current_stock || 0

        movementEntries.push({
          product_id: p.id,
          movement_type: 'MANUAL_ADJUSTMENT',
          quantity: allotted,
          previous_stock: currentStock,
          new_stock: currentStock, // Main inventory stock NOT deducted
          reason: `Combo Stock Allotment: ${comboName.trim()} (${allotted} units allocated)`,
          reference_id: comboId,
          performed_by: isValidUuid(user?.id) ? user.id : null,
        })
      }

      if (movementEntries.length > 0) {
        const { error: movErr } = await supabase
          .from('inventory_movements')
          .insert(movementEntries)

        if (movErr) {
          console.warn('Inventory movement log notice:', movErr.message)
          // Retry without performed_by if FK constraint fails
          const strippedEntries = movementEntries.map(e => {
            const copy = { ...e }
            delete copy.performed_by
            return copy
          })
          await supabase.from('inventory_movements').insert(strippedEntries)
        }
      }

      // 2. Save combo record to local storage (wrapstore_combos_v1)
      const newCombo = {
        id: comboId,
        code: comboCode,
        name: comboName.trim(),
        description: description.trim() || null,
        selling_price: price,
        original_value: totalRegularValue,
        items: selectedItems.map(i => ({
          product_id: i.product.id,
          product_name: i.product.name,
          product_code: i.product.product_id,
          mobile_model: i.product.mobile_model,
          unit_price: i.product.selling_price,
          allotted_qty: i.allottedQty,
          image: i.product.product_images?.find(img => img.is_primary)?.public_url || i.product.product_images?.[0]?.public_url || null,
        })),
        created_at: new Date().toISOString(),
      }

      const existingCombos = combos
      const updatedList = [newCombo, ...existingCombos]
      localStorage.setItem('wrapstore_combos_v1', JSON.stringify(updatedList))
      setCombos(updatedList)

      toast.success(`Combo "${comboName.trim()}" created & ${selectedItems.length} inventory history entries logged!`)
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error creating combo:', err)
      toast.error(err.message || 'Failed to create combo')
    } finally {
      setSavingCombo(false)
    }
  }

  const handleDeleteCombo = async (comboId) => {
    const targetCombo = combos.find(c => c.id === comboId)
    if (!targetCombo) return

    try {
      // 1. Log inventory movement REVERSAL / Deallocation entries for each item
      const reversalEntries = []
      if (targetCombo.items && targetCombo.items.length > 0) {
        for (const item of targetCombo.items) {
          if (!item.product_id || !isValidUuid(item.product_id)) continue

          // Fetch current stock for accuracy
          let currentStock = 0
          try {
            const { data: p } = await supabase
              .from('products')
              .select('current_stock')
              .eq('id', item.product_id)
              .single()
            if (p) currentStock = p.current_stock || 0
          } catch (e) {
            console.warn('Error fetching current stock for reversal:', e)
          }

          reversalEntries.push({
            product_id: item.product_id,
            movement_type: 'MANUAL_ADJUSTMENT',
            quantity: Number(item.allotted_qty) || 0,
            previous_stock: currentStock,
            new_stock: currentStock, // Main inventory stock NOT changed
            reason: `Combo Stock Deallocation / Reversal: ${targetCombo.name} (${item.allotted_qty} units released)`,
            reference_id: comboId,
            performed_by: isValidUuid(user?.id) ? user.id : null,
          })
        }
      }

      if (reversalEntries.length > 0) {
        const { error: revErr } = await supabase
          .from('inventory_movements')
          .insert(reversalEntries)

        if (revErr) {
          console.warn('Reversal inventory movement notice:', revErr.message)
          const strippedReversals = reversalEntries.map(e => {
            const copy = { ...e }
            delete copy.performed_by
            return copy
          })
          await supabase.from('inventory_movements').insert(strippedReversals)
        }
      }

      // 2. Remove combo from localStorage and state
      const updated = combos.filter(c => c.id !== comboId)
      localStorage.setItem('wrapstore_combos_v1', JSON.stringify(updated))
      setCombos(updated)
      toast.success(`Combo "${targetCombo.name}" deleted & inventory history reversed!`)
    } catch (err) {
      console.error('Error deleting combo:', err)
      const updated = combos.filter(c => c.id !== comboId)
      localStorage.setItem('wrapstore_combos_v1', JSON.stringify(updated))
      setCombos(updated)
      toast.success('Combo removed')
    }
  }

  const isProductInCat = (p, cat) => {
    if (!cat || cat.id === 'ALL') return true
    const catName = (cat.name || '').toLowerCase()
    const catSlug = (cat.slug || '').toLowerCase()
    const catId = cat.id

    if (catId && p.category_id === catId) return true
    if (catSlug && p.product_type === catSlug) return true
    if (catName && (p.category_name?.toLowerCase() === catName || p.categories?.name?.toLowerCase() === catName)) return true
    if (catSlug && p.product_type?.toLowerCase().includes(catSlug)) return true
    if (catName && (p.name?.toLowerCase().includes(catName.replace(/s$/, '')) || p.product_type?.toLowerCase().includes(catName.replace(/s$/, '')))) return true
    return false
  }

  // Derive unique active categories list from both categories table & inventory products
  const activeCategoryList = Array.from(
    new Set([
      ...categories.map(c => JSON.stringify({ id: c.id, name: c.name, slug: c.slug })),
      ...inventoryProducts.map(p => {
        const name = p.categories?.name || (
          p.product_type === 'iphone_case' || p.product_type === 'samsung_case' ? 'Mobile Cases' :
          p.product_type === 'mobile_sticker' ? 'Mobile Stickers' :
          p.product_type ? p.product_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other'
        )
        return JSON.stringify({ id: p.category_id || p.product_type || name, name, slug: p.product_type })
      })
    ])
  ).map(s => JSON.parse(s)).filter((c, idx, arr) => c.name && arr.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase()) === idx)

  const filteredProducts = inventoryProducts.filter(p => {
    // Category Filter
    if (selectedCategory !== 'ALL') {
      const catObj = activeCategoryList.find(c => c.id === selectedCategory || c.slug === selectedCategory || c.name === selectedCategory)
      if (catObj && !isProductInCat(p, catObj)) return false
      if (!catObj && p.category_id !== selectedCategory && p.product_type !== selectedCategory) return false
    }

    // Search Query Filter
    if (!productSearch.trim()) return true
    const q = productSearch.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.product_id?.toLowerCase().includes(q) ||
      p.mobile_model?.toLowerCase().includes(q) ||
      p.mobile_brand?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '50px' }}>
      {/* Top Section Header */}
      <div className="section-header" style={{ marginBottom: '24px' }}>
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PackagePlus size={22} color="var(--brand-black)" />
            <span>Product Combos & Bundles</span>
          </div>
          <div className="section-subtitle">
            Create custom product combo offers, allot stock quantities, and track allocation history
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleOpenModal}
          id="create-combo-btn"
          style={{ padding: '10px 18px', fontWeight: 700 }}
        >
          <Plus size={16} /> Create a Combo
        </button>
      </div>



      {/* Combos Listing */}
      {combos.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <PackagePlus size={30} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>No Combos Created Yet</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
            Click <strong>"Create a Combo"</strong> to select products from your current inventory and allot stock quantities.
          </p>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={15} /> Create a Combo
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {combos.map(combo => {
            const savings = combo.original_value > combo.selling_price
              ? combo.original_value - combo.selling_price
              : 0
            const savingsPct = combo.original_value > 0
              ? Math.round((savings / combo.original_value) * 100)
              : 0

            return (
              <div key={combo.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="card-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      background: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      marginRight: '8px'
                    }}>
                      {combo.code}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(combo.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => handleDeleteCombo(combo.id)}
                    title="Remove combo"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px' }}>{combo.name}</h4>
                    {combo.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{combo.description}</p>
                    )}
                  </div>

                  {/* Pricing Badge */}
                  <div style={{
                    background: '#f9fafb',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Combo Offer Price</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--brand-black)' }}>
                        {INR(combo.selling_price)}
                      </div>
                    </div>
                    {combo.original_value > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          Reg: {INR(combo.original_value)}
                        </div>
                        {savingsPct > 0 && (
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                            Save {savingsPct}% ({INR(savings)})
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Included Products */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Included Products ({combo.items?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {combo.items?.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: '#ffffff',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <ProductImageHover src={item.image} title={item.product_name} alt={item.product_name} size={28} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.product_name}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {item.mobile_model || item.product_code}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, background: '#f3f4f6', padding: '2px 7px', borderRadius: '12px', fontSize: '11px' }}>
                            x{item.allotted_qty} allotted
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Log Notice */}
                  <div style={{ marginTop: 'auto', fontSize: '11px', color: '#059669', background: '#ecfdf5', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={12} color="#059669" />
                    <span>Inventory History Logged (Main stock retained)</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE COMBO MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal modal-lg"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <span className="modal-title">Create Product Combo</span>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Select products from inventory, allot quantities, and log to inventory history
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateCombo} id="create-combo-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Basic Combo Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Combo Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. iPhone 16 Pro Max Case + Guard Combo"
                      value={comboName}
                      onChange={e => setComboName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Combo Selling Price (₹) <span className="required">*</span></label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      className="form-input"
                      placeholder="e.g. 599"
                      value={sellingPrice}
                      onChange={e => setSellingPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Combo Description / Details (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Brief highlights or notes about this bundle"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Product Selection Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 2 }}>
                        Select Products from Current Inventory <span className="required">*</span>
                      </label>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Allotted stock will be logged in inventory history without deducting main stock.
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: selectedItems.length > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {selectedItems.length} Products Selected
                    </span>
                  </div>

                  {/* Search Product Bar */}
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search inventory products by name, SKU, or model..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      style={{ paddingLeft: 32, fontSize: '13px', width: '100%' }}
                    />
                  </div>

                  {/* Category Filter Pills Selector */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                        Filter by Category
                      </span>
                      {selectedCategory !== 'ALL' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedCategory('ALL')}
                          style={{ fontSize: '11px', padding: '1px 6px', color: 'var(--text-muted)' }}
                        >
                          Clear Category Filter
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        style={{
                          fontSize: '11px',
                          padding: '5px 12px',
                          borderRadius: 'var(--radius-full)',
                          border: selectedCategory === 'ALL' ? '1.5px solid var(--brand-black)' : '1px solid #d1d5db',
                          background: selectedCategory === 'ALL' ? '#111827' : '#ffffff',
                          color: selectedCategory === 'ALL' ? '#ffffff' : '#374151',
                          fontWeight: selectedCategory === 'ALL' ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        All Categories ({inventoryProducts.length})
                      </button>

                      {activeCategoryList.map(cat => {
                        const count = inventoryProducts.filter(p => isProductInCat(p, cat)).length
                        const isSelected = selectedCategory === cat.id || selectedCategory === cat.slug || selectedCategory === cat.name
                        return (
                          <button
                            key={cat.id || cat.slug || cat.name}
                            type="button"
                            onClick={() => setSelectedCategory(isSelected ? 'ALL' : (cat.id || cat.slug || cat.name))}
                            style={{
                              fontSize: '11px',
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-full)',
                              border: isSelected ? '1.5px solid var(--brand-black)' : '1px solid #d1d5db',
                              background: isSelected ? '#111827' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#374151',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {cat.name} ({count})
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Product List Grid */}
                  <div style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius)',
                    background: '#fafafa',
                    padding: '8px'
                  }}>
                    {loadingProducts ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div className="spinner-sm" style={{ margin: '0 auto 8px' }} />
                        Loading inventory...
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No approved inventory products found.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredProducts.map(product => {
                          const isSelected = selectedItems.some(i => i.product.id === product.id)
                          const primaryImg = product.product_images?.find(i => i.is_primary)?.public_url || product.product_images?.[0]?.public_url

                          return (
                            <div
                              key={product.id}
                              onClick={() => handleToggleProduct(product)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                background: isSelected ? '#ecfdf5' : '#ffffff',
                                border: `1.5px solid ${isSelected ? '#10b981' : 'var(--border)'}`,
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  border: `2px solid ${isSelected ? '#10b981' : '#d1d5db'}`,
                                  background: isSelected ? '#10b981' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                                </div>
                                <ProductImageHover src={primaryImg} title={product.name} alt={product.name} size={32} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {product.name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                                    <code>{product.product_id}</code>
                                    {product.mobile_model && <span>{product.mobile_model}</span>}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '10px' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px' }}>{INR(product.selling_price)}</div>
                                <div style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                                  Stock: {product.current_stock}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Products & Quantity Allotment Section */}
                {selectedItems.length > 0 && (
                  <div style={{ background: '#f9fafb', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-black)', marginBottom: '10px' }}>
                      Allot Quantity from Inventory Stock
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedItems.map((item) => (
                        <div
                          key={item.product.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#ffffff',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            gap: '12px'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.product.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Available Stock: <strong>{item.product.current_stock}</strong> units
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Allot Qty:</label>
                            <input
                              type="number"
                              min="1"
                              max={item.product.current_stock || 9999}
                              value={item.allottedQty}
                              onChange={e => handleQtyChange(item.product.id, e.target.value)}
                              style={{
                                width: '60px',
                                textAlign: 'center',
                                padding: '4px 6px',
                                fontSize: '13px',
                                fontWeight: 700,
                                border: '1.5px solid var(--border-strong)',
                                borderRadius: 'var(--radius-sm)'
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleToggleProduct(item.product)}
                              style={{ color: 'var(--danger)' }}
                              title="Remove item"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pricing Summary Breakdown */}
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Regular Value: </span>
                        <span style={{ fontWeight: 700, textDecoration: 'line-through' }}>{INR(totalRegularValue)}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Combo Offer: </span>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--brand-black)' }}>
                          {sellingPrice ? INR(sellingPrice) : 'Enter Price'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={savingCombo}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCombo || selectedItems.length === 0}
                  id="save-combo-btn"
                >
                  {savingCombo ? (
                    <>
                      <div className="btn-spinner" /> Saving & Logging History...
                    </>
                  ) : (
                    <>
                      <Check size={15} /> Save & Allot Combo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddCombo
