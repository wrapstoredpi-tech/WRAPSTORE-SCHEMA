import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X, Star, Image as ImageIcon, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const IPHONE_MODELS = [
  'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17 Plus', 'iPhone 17',
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 Mini', 'iPhone 13',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 Mini', 'iPhone 12',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone SE (3rd Gen)', 'iPhone SE (2nd Gen)',
]

const IPHONE_SERIES = [
  { label: 'All Models', filter: () => IPHONE_MODELS },
  { label: 'iPhone 13 to 17 Series', filter: () => IPHONE_MODELS.filter(m => /iPhone (1[3-7])/.test(m)) },
  { label: 'iPhone 17 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 17')) },
  { label: 'iPhone 16 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 16')) },
  { label: 'iPhone 15 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 15')) },
  { label: 'iPhone 14 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 14')) },
  { label: 'iPhone 13 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 13')) },
]

const SAMSUNG_MODELS = [
  'Samsung Galaxy S25 Ultra', 'Samsung Galaxy S25+', 'Samsung Galaxy S25',
  'Samsung Galaxy S24 Ultra', 'Samsung Galaxy S24+', 'Samsung Galaxy S24',
  'Samsung Galaxy S23 Ultra', 'Samsung Galaxy S23+', 'Samsung Galaxy S23',
  'Samsung Galaxy S22 Ultra', 'Samsung Galaxy S22+', 'Samsung Galaxy S22',
  'Samsung Galaxy A55', 'Samsung Galaxy A35', 'Samsung Galaxy A15',
  'Samsung Galaxy Z Fold 6', 'Samsung Galaxy Z Flip 6',
]

const SAMSUNG_SERIES = [
  { label: 'All Models', filter: () => SAMSUNG_MODELS },
  { label: 'S25 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S25')) },
  { label: 'S24 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S24')) },
  { label: 'S23 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S23')) },
  { label: 'S22 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S22')) },
  { label: 'A Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('Galaxy A')) },
  { label: 'Z Fold/Flip', filter: () => SAMSUNG_MODELS.filter(m => m.includes('Z Fold') || m.includes('Z Flip')) },
]

const GST_OPTIONS = [0, 5, 12, 18, 28]
const DEFAULT_GENERIC_COLORS = ['Black', 'White', 'Clear', 'Blue', 'Red', 'Purple']

const DEFAULT_CATEGORIES = [
  { id: 'cat-cases', name: 'Mobile Cases', slug: 'mobile-cases' },
  { id: 'cat-accessories', name: 'Accessories', slug: 'accessories' },
]

const parseModels = (val) => {
  if (!val) return []
  if (Array.isArray(val)) return val
  return val.split(',').map(m => m.trim()).filter(Boolean)
}

const AddProduct = ({ prefillData = null, productId = null, onSave = null }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef()

  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [images, setImages] = useState([])       // { file, preview, isPrimary }
  const [existingImages, setExistingImages] = useState([])  // for edit mode
  const [uploadingImages, setUploadingImages] = useState(false)

  const [form, setForm] = useState({
    name: '',
    product_type: '',
    category_id: '',
    subcategory_id: '',
    mobile_brand: '',
    mobile_model: '',
    description: '',
    purchase_price: '',
    selling_price: '',
    discount_percentage: '0',
    gst_percentage: '18',
    initial_stock: '',
    min_stock_level: '5',
    ...(prefillData || {}),
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  useEffect(() => {
    if (form.category_id) {
      supabase.from('subcategories').select('*').eq('category_id', form.category_id).order('sort_order')
        .then(({ data }) => setSubcategories(data || []))
    } else {
      setSubcategories([])
    }
  }, [form.category_id])

  // Auto select initial category when categories load
  useEffect(() => {
    if (categories.length > 0 && !form.category_id) {
      const first = categories[0]
      setForm(prev => ({
        ...prev,
        category_id: prev.category_id || first.id,
        product_type: prev.product_type || first.slug,
        mobile_brand: prev.mobile_brand || (first.name.toLowerCase().includes('case') ? 'Apple' : 'Universal'),
      }))
    }
  }, [categories])

  const activeCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const modelOptions = form.mobile_brand === 'Apple' || form.product_type === 'iphone_case'
    ? IPHONE_MODELS
    : form.mobile_brand === 'Samsung' || form.product_type === 'samsung_case'
    ? SAMSUNG_MODELS
    : []

  const seriesOptions = form.mobile_brand === 'Apple' || form.product_type === 'iphone_case'
    ? IPHONE_SERIES
    : form.mobile_brand === 'Samsung' || form.product_type === 'samsung_case'
    ? SAMSUNG_SERIES
    : []

  const [selectedModels, setSelectedModels] = useState(() => parseModels(prefillData?.mobile_model))
  const [modelSearch, setModelSearch] = useState('')

  // Colour Variants State
  const [availableColors, setAvailableColors] = useState(() => {
    const prefilled = parseModels(prefillData?.color_variants || prefillData?.color)
    return Array.from(new Set([...DEFAULT_GENERIC_COLORS, ...prefilled]))
  })
  const [selectedColors, setSelectedColors] = useState(() => parseModels(prefillData?.color_variants || prefillData?.color))
  const [showAddColorInput, setShowAddColorInput] = useState(false)
  const [newColorInput, setNewColorInput] = useState('')

  useEffect(() => {
    if (prefillData?.color_variants || prefillData?.color) {
      const prefilled = parseModels(prefillData.color_variants || prefillData.color)
      setSelectedColors(prefilled)
      setAvailableColors(prev => Array.from(new Set([...prev, ...prefilled])))
    }
  }, [prefillData?.color_variants, prefillData?.color])

  const toggleColor = (color) => {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    )
  }

  const handleAddCustomColor = () => {
    const trimmed = newColorInput.trim()
    if (!trimmed) return
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    if (!availableColors.includes(formatted)) {
      setAvailableColors(prev => [...prev, formatted])
    }
    if (!selectedColors.includes(formatted)) {
      setSelectedColors(prev => [...prev, formatted])
    }
    setNewColorInput('')
    setShowAddColorInput(false)
  }

  useEffect(() => {
    if (prefillData?.mobile_model !== undefined) {
      setSelectedModels(parseModels(prefillData.mobile_model))
    }
  }, [prefillData?.mobile_model])

  const updateSelectedModels = (newModels) => {
    setSelectedModels(newModels)
    const modelsStr = newModels.join(', ')
    setForm(prev => ({ ...prev, mobile_model: modelsStr }))
    if (errors.mobile_model) setErrors(prev => ({ ...prev, mobile_model: '' }))
  }

  const toggleModel = (model) => {
    if (selectedModels.includes(model)) {
      updateSelectedModels(selectedModels.filter(m => m !== model))
    } else {
      updateSelectedModels([...selectedModels, model])
    }
  }

  const handleSeriesToggle = (seriesFilterFn) => {
    const modelsInSeries = seriesFilterFn()
    const allSelected = modelsInSeries.length > 0 && modelsInSeries.every(m => selectedModels.includes(m))
    if (allSelected) {
      updateSelectedModels(selectedModels.filter(m => !modelsInSeries.includes(m)))
    } else {
      const union = Array.from(new Set([...selectedModels, ...modelsInSeries]))
      updateSelectedModels(union)
    }
  }

  const clearAllModels = () => {
    updateSelectedModels([])
  }

  const set = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleCategorySelect = (cat) => {
    const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const isCase = cat.name.toLowerCase().includes('case') || slug.includes('case')
    const defaultBrand = isCase ? 'Apple' : 'Universal'

    setForm(prev => ({
      ...prev,
      category_id: cat.id,
      product_type: slug,
      mobile_brand: defaultBrand,
      mobile_model: '',
      subcategory_id: '',
    }))
    setSelectedModels([])
    setModelSearch('')
    if (errors.product_type) setErrors(prev => ({ ...prev, product_type: '' }))
    if (errors.category_id) setErrors(prev => ({ ...prev, category_id: '' }))
    if (errors.mobile_model) setErrors(prev => ({ ...prev, mobile_model: '' }))
  }

  // Image handling
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      isPrimary: images.length === 0 && i === 0,
      id: `new-${Date.now()}-${i}`,
    }))
    setImages(prev => {
      const updated = [...prev, ...newImages]
      if (!updated.some(img => img.isPrimary)) updated[0].isPrimary = true
      return updated
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) {
      const event = { target: { files } }
      handleFileSelect(event)
    }
  }

  const setPrimary = (id) => setImages(prev => prev.map(img => ({ ...img, isPrimary: img.id === id })))
  const removeImage = (id) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id)
      if (filtered.length > 0 && !filtered.some(img => img.isPrimary)) {
        filtered[0].isPrimary = true
      }
      return filtered
    })
  }

  // Upload images to Supabase Storage
  const uploadImages = async (productUuid) => {
    const results = []
    for (const img of images) {
      const ext = img.file.name.split('.').pop()
      const path = `products/${productUuid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, img.file, { cacheControl: '3600', upsert: false })

      if (uploadErr) {
        console.warn('Supabase storage upload error:', uploadErr)
        // Fallback to Data URL if storage bucket is missing or unconfigured
        try {
          const base64Url = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(img.file)
          })
          results.push({
            product_id: productUuid,
            storage_path: path,
            public_url: base64Url,
            is_primary: img.isPrimary,
            sort_order: results.length,
            file_name: img.file.name,
            file_size: img.file.size,
          })
        } catch (e) {
          toast.error(`Failed to process image: ${img.file.name}`)
        }
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)

      results.push({
        product_id: productUuid,
        storage_path: path,
        public_url: publicUrl,
        is_primary: img.isPrimary,
        sort_order: results.length,
        file_name: img.file.name,
        file_size: img.file.size,
      })
    }
    return results
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.product_type && !form.category_id) e.product_type = 'Product category is required'
    if (!form.selling_price || Number(form.selling_price) <= 0) e.selling_price = 'Valid selling price required'
    if (!form.purchase_price || Number(form.purchase_price) < 0) e.purchase_price = 'Valid purchase price required'
    const requiresModel = (form.mobile_brand === 'Apple' || form.mobile_brand === 'Samsung') && modelOptions.length > 0
    if (requiresModel && selectedModels.length === 0) e.mobile_model = 'Select at least one compatible mobile model'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) { toast.error('Please fix the errors above.'); return }

    setSaving(true)
    try {
      // Ensure product_type matches allowed database check constraint values: ('iphone_case', 'samsung_case', 'mobile_sticker')
      const resolveProductType = () => {
        const rawType = (form.product_type || '').toLowerCase()
        if (['iphone_case', 'samsung_case', 'mobile_sticker'].includes(rawType)) return rawType
        if (rawType.includes('sticker')) return 'mobile_sticker'
        if (form.mobile_brand === 'Samsung') return 'samsung_case'
        if (form.mobile_brand === 'Apple') return 'iphone_case'
        return 'iphone_case'
      }

      const colorsStr = selectedColors.length > 0 ? selectedColors.join(', ') : null

      const payload = {
        name: form.name.trim(),
        product_type: resolveProductType(),
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        mobile_brand: form.mobile_brand || null,
        mobile_model: selectedModels.length > 0 ? selectedModels.join(', ') : (form.mobile_model || null),
        color_variants: colorsStr,
        description: form.description || null,
        purchase_price: Number(form.purchase_price),
        selling_price: Number(form.selling_price),
        discount_percentage: Number(form.discount_percentage) || 0,
        gst_percentage: Number(form.gst_percentage) || 18,
        current_stock: productId ? undefined : Number(form.initial_stock) || 0,
        min_stock_level: Number(form.min_stock_level) || 5,
        created_by: user?.id,
        approval_status: 'PENDING_APPROVAL',
      }

      // Remove undefined keys
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      let productUuid = productId

      if (productId) {
        // Edit mode
        let { data, error } = await supabase.from('products').update(payload).eq('id', productId)
        if (error && (error.message?.includes('color_variants') || error.code === 'PGRST204')) {
          delete payload.color_variants
          if (colorsStr && !payload.description?.includes('Colour Variants:')) {
            payload.description = payload.description ? `${payload.description}\n\nColour Variants: ${colorsStr}` : `Colour Variants: ${colorsStr}`
          }
          const retry = await supabase.from('products').update(payload).eq('id', productId)
          if (retry.error) throw retry.error
        } else if (error) {
          throw error
        }
      } else {
        // Create mode
        let { data, error } = await supabase.from('products').insert(payload).select().single()
        if (error && (error.message?.includes('color_variants') || error.code === 'PGRST204')) {
          delete payload.color_variants
          if (colorsStr && !payload.description?.includes('Colour Variants:')) {
            payload.description = payload.description ? `${payload.description}\n\nColour Variants: ${colorsStr}` : `Colour Variants: ${colorsStr}`
          }
          const retry = await supabase.from('products').insert(payload).select().single()
          if (retry.error) throw retry.error
          data = retry.data
        } else if (error) {
          throw error
        }
        productUuid = data.id

        // Record initial stock movement
        if (Number(form.initial_stock) > 0) {
          await supabase.from('inventory_movements').insert({
            product_id: productUuid,
            movement_type: 'INITIAL_STOCK',
            quantity: Number(form.initial_stock),
            previous_stock: 0,
            new_stock: Number(form.initial_stock),
            reason: 'Initial stock on product creation',
            performed_by: user?.id,
          })
        }
      }

      // Upload images
      if (images.length > 0) {
        setUploadingImages(true)
        const imageRecords = await uploadImages(productUuid)
        if (imageRecords.length > 0) {
          await supabase.from('product_images').insert(imageRecords)
        }
        setUploadingImages(false)
      }

      toast.success(productId ? 'Product updated! Awaiting approval.' : 'Product added! Awaiting approval.')

      if (onSave) onSave()
      else navigate('/products')
    } catch (err) {
      toast.error(err.message || 'Failed to save product')
      setUploadingImages(false)
    } finally {
      setSaving(false)
    }
  }

  const isLoading = saving || uploadingImages

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-ghost" onClick={() => onSave ? onSave() : navigate('/products')}>
          <ArrowLeft size={14} /> Back to Products
        </button>
      </div>

      <form onSubmit={handleSubmit} id="add-product-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Basic Info */}
            <div className="card">
              <div className="card-header"><span className="card-title">Basic Information</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Product Name <span className="required">*</span></label>
                  <input
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="e.g. iPhone 16 Pro Max Transparent Case"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    id="product-name"
                  />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Product Category <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {activeCategories.map(cat => {
                      const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                      const isSelected = form.category_id === cat.id || form.product_type === slug || form.product_type === cat.id
                      return (
                        <label
                          key={cat.id || slug}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 14px',
                            border: `2px solid ${isSelected ? 'var(--brand-black)' : 'var(--border-strong)'}`,
                            borderRadius: 'var(--radius)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all var(--transition)',
                            background: isSelected ? '#f3f4f6' : 'white',
                          }}
                          onClick={() => handleCategorySelect(cat)}
                        >
                          <input
                            type="radio"
                            name="product_category"
                            value={cat.id}
                            checked={isSelected}
                            onChange={() => handleCategorySelect(cat)}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            border: `2px solid ${isSelected ? 'var(--brand-black)' : 'var(--border-strong)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-black)' }} />}
                          </div>
                          {cat.name}
                        </label>
                      )
                    })}
                  </div>
                  {errors.product_type && <div className="form-error">{errors.product_type}</div>}
                </div>

                {/* Mobile Brand & Model Compatibility */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Brand Compatibility</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['Apple', 'Samsung', 'Universal'].map(b => (
                          <button
                            key={b}
                            type="button"
                            className={`btn btn-sm ${form.mobile_brand === b ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => {
                              set('mobile_brand', b)
                              setSelectedModels([])
                            }}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.mobile_brand !== 'Universal' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>
                            Compatible Mobile Models <span className="required">*</span>
                          </label>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: selectedModels.length > 0 ? '#10b981' : 'var(--text-muted)' }}>
                            {selectedModels.length} Selected
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                    {/* Multi-Select Component Container */}
                    {form.mobile_brand !== 'Universal' && modelOptions.length > 0 && (
                      <div style={{
                        border: `1.5px solid ${errors.mobile_model ? 'var(--danger)' : 'var(--border-strong)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '12px',
                        background: '#fafafa',
                      }}>
                        {/* Quick Series Select Buttons */}
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Quick Series Select
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {seriesOptions.map((series, idx) => {
                              const modelsInSeries = series.filter()
                              const isFullySelected = modelsInSeries.length > 0 && modelsInSeries.every(m => selectedModels.includes(m))
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSeriesToggle(series.filter)}
                                  style={{
                                    fontSize: '11px',
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-full)',
                                    border: isFullySelected ? '1px solid #10b981' : '1px solid #d1d5db',
                                    background: isFullySelected ? '#ecfdf5' : '#ffffff',
                                    color: isFullySelected ? '#047857' : '#374151',
                                    fontWeight: isFullySelected ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {isFullySelected ? '✓ ' : '+ '}{series.label}
                                </button>
                              )
                            })}
                            {selectedModels.length > 0 && (
                              <button
                                type="button"
                                onClick={clearAllModels}
                                style={{
                                  fontSize: '11px',
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-full)',
                                  border: '1px solid #fca5a5',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Clear All ({selectedModels.length})
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Selected Models Badges */}
                        {selectedModels.length > 0 && (
                          <div style={{
                            display: 'flex',
                            gap: '6px',
                            flexWrap: 'wrap',
                            maxHeight: '85px',
                            overflowY: 'auto',
                            padding: '8px',
                            background: '#ffffff',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                            marginBottom: '10px',
                          }}>
                            {selectedModels.map(m => (
                              <span
                                key={m}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#111827',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                }}
                              >
                                {m}
                                <X
                                  size={12}
                                  style={{ cursor: 'pointer', opacity: 0.8 }}
                                  onClick={() => toggleModel(m)}
                                />
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Search Filter Input */}
                        <div style={{ marginBottom: '8px' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={`Search ${form.mobile_brand || 'mobile'} models...`}
                            value={modelSearch}
                            onChange={e => setModelSearch(e.target.value)}
                            style={{ fontSize: '12px', padding: '6px 10px', background: '#ffffff' }}
                          />
                        </div>

                        {/* Checkbox Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                          gap: '4px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          padding: '6px',
                          background: '#ffffff',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                        }}>
                          {modelOptions
                            .filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()))
                            .map(m => {
                              const checked = selectedModels.includes(m)
                              return (
                                <label
                                  key={m}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    background: checked ? '#f3f4f6' : 'transparent',
                                    border: checked ? '1px solid #d1d5db' : '1px solid transparent',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: checked ? 600 : 400,
                                    color: checked ? '#111827' : '#4b5563',
                                    userSelect: 'none',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleModel(m)}
                                    style={{ accentColor: '#111827', width: '14px', height: '14px', cursor: 'pointer' }}
                                  />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
                                </label>
                              )
                            })}
                        </div>
                      </div>
                    )}
                    {errors.mobile_model && <div className="form-error">{errors.mobile_model}</div>}
                  </div>

                {/* Colour Variants Selection */}
                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Colour Variants
                    </label>
                    {selectedColors.length > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                        {selectedColors.length} Selected ({selectedColors.join(', ')})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {availableColors.map(color => {
                      const isSelected = selectedColors.includes(color)
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => toggleColor(color)}
                          style={{
                            fontSize: '12px',
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-full)',
                            border: isSelected ? '1.5px solid #111827' : '1px solid #d1d5db',
                            background: isSelected ? '#111827' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#374151',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          {isSelected && <span style={{ fontSize: '11px', fontWeight: 800 }}>✓</span>}
                          {color}
                        </button>
                      )
                    })}

                    {/* + Add New Button / Inline Input */}
                    {showAddColorInput ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Type color name..."
                          value={newColorInput}
                          onChange={e => setNewColorInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddCustomColor()
                            }
                          }}
                          autoFocus
                          style={{ fontSize: '12px', padding: '5px 10px', width: '150px', height: '32px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handleAddCustomColor}
                          style={{ padding: '5px 12px', fontSize: '12px', height: '32px' }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => { setShowAddColorInput(false); setNewColorInput('') }}
                          style={{ padding: '5px 8px', fontSize: '12px', height: '32px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddColorInput(true)}
                        style={{
                          fontSize: '12px',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          border: '1.5px dashed #9ca3af',
                          background: '#f9fafb',
                          color: '#4b5563',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        + Add New
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe the product, its features, materials, compatibility..."
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="card">
              <div className="card-header"><span className="card-title">Category</span></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={form.category_id}
                      onChange={e => { set('category_id', e.target.value); set('subcategory_id', '') }}
                    >
                      <option value="">Select category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Subcategory</label>
                    <select
                      className="form-select"
                      value={form.subcategory_id}
                      onChange={e => set('subcategory_id', e.target.value)}
                      disabled={!form.category_id || subcategories.length === 0}
                    >
                      <option value="">Select subcategory...</option>
                      {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="card">
              <div className="card-header"><span className="card-title">Pricing</span></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Price (₹) <span className="required">*</span></label>
                    <input
                      type="number"
                      className={`form-input ${errors.purchase_price ? 'error' : ''}`}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={form.purchase_price}
                      onChange={e => set('purchase_price', e.target.value)}
                      id="purchase-price"
                    />
                    {errors.purchase_price && <div className="form-error">{errors.purchase_price}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹) <span className="required">*</span></label>
                    <input
                      type="number"
                      className={`form-input ${errors.selling_price ? 'error' : ''}`}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={form.selling_price}
                      onChange={e => set('selling_price', e.target.value)}
                      id="selling-price"
                    />
                    {errors.selling_price && <div className="form-error">{errors.selling_price}</div>}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">GST (%)</label>
                  <select
                    className="form-select"
                    value={form.gst_percentage}
                    onChange={e => set('gst_percentage', e.target.value)}
                  >
                    {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                  </select>
                </div>

                {form.selling_price && (
                  <div style={{ marginTop: '14px', padding: '12px', background: '#f9fafb', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Selling Price:</span>
                      <span style={{ fontWeight: 600 }}>₹{Number(form.selling_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    {Number(form.gst_percentage) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Price + GST ({form.gst_percentage}%):</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{(Number(form.selling_price) * (1 + Number(form.gst_percentage) / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Product Images */}
            <div className="card">
              <div className="card-header"><span className="card-title">Product Images</span></div>
              <div className="card-body">
                {/* Dropzone */}
                <div
                  className="image-dropzone"
                  onClick={() => fileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                >
                  <div className="image-dropzone-icon"><Upload size={22} /></div>
                  <div className="image-dropzone-text">Click or drag & drop images</div>
                  <div className="image-dropzone-hint">JPG, PNG, WebP — Multiple files supported</div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  id="product-images-input"
                />

                {/* Previews */}
                {images.length > 0 && (
                  <div className="image-preview-grid">
                    {images.map(img => (
                      <div key={img.id} className={`image-preview-item ${img.isPrimary ? 'primary' : ''}`}>
                        <img src={img.preview} alt="preview" />
                        {img.isPrimary && <div className="image-primary-badge">Primary</div>}
                        <div className="image-preview-actions">
                          {!img.isPrimary && (
                            <button
                              type="button"
                              className="image-action-btn"
                              onClick={() => setPrimary(img.id)}
                              title="Set as primary"
                            >
                              <Star size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="image-action-btn danger"
                            onClick={() => removeImage(img.id)}
                            title="Remove"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stock */}
            {!productId && (
              <div className="card">
                <div className="card-header"><span className="card-title">Initial Stock</span></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Initial Stock Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      min="0"
                      value={form.initial_stock}
                      onChange={e => set('initial_stock', e.target.value)}
                      id="initial-stock"
                    />
                    <div className="form-hint">Stock will be recorded as initial inventory movement.</div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Minimum Stock Level</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="5"
                      min="0"
                      value={form.min_stock_level}
                      onChange={e => set('min_stock_level', e.target.value)}
                    />
                    <div className="form-hint">Alert when stock falls below this level.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Info */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius)',
              padding: '14px',
              display: 'flex',
              gap: '10px',
              fontSize: '13px',
              color: '#1d4ed8'
            }}>
              <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Approval Required</strong>
                <div style={{ marginTop: 3, color: '#3b82f6' }}>
                  This product will be submitted for Super Admin approval before becoming active in inventory.
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={isLoading}
              id="submit-product-btn"
            >
              {isLoading ? (
                <><div className="btn-spinner" /> {uploadingImages ? 'Uploading images...' : 'Saving...'}</>
              ) : (
                <><Save size={16} /> {productId ? 'Update Product' : 'Submit for Approval'}</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddProduct
