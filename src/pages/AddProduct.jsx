import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, X, Star, Image as ImageIcon, Save, Info, Edit3, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fetchMergedCategories } from '../lib/categoryStorage'

const IPHONE_MODELS = [
  'iPhone 18 Pro Max', 'iPhone 18 Pro', 'iPhone 18 Plus', 'iPhone 18',
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
  { label: 'iPhone 13 to 18 Series', filter: () => IPHONE_MODELS.filter(m => /iPhone (1[3-8])/.test(m)) },
  { label: 'iPhone 18 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 18')) },
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
  'Samsung Galaxy A55', 'Samsung Galaxy A35', 'Samsung Galaxy Z Fold6', 'Samsung Galaxy Z Flip6',
]

const SAMSUNG_SERIES = [
  { label: 'All Samsung', filter: () => SAMSUNG_MODELS },
  { label: 'Galaxy S25 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S25')) },
  { label: 'Galaxy S24 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S24')) },
  { label: 'Galaxy S23 Series', filter: () => SAMSUNG_MODELS.filter(m => m.includes('S23')) },
]

const DEFAULT_CATEGORIES = [
  { id: 'cat-cases', name: 'Mobile Cases', slug: 'iphone_case' },
  { id: 'cat-access', name: 'Access', slug: 'accessories' },
  { id: 'cat-gadgets', name: 'Gadgets', slug: 'accessories' },
]

const DEFAULT_GENERIC_COLORS = ['Black', 'White', 'Clear', 'Blue', 'Red', 'Purple']

const parseModels = (val) => {
  if (!val) return []
  if (Array.isArray(val)) return val
  return String(val).split(',').map(s => s.trim()).filter(Boolean)
}

const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

const AddProduct = ({ prefillData = null, onSave = null }) => {
  const navigate = useNavigate()
  const { id: productId } = useParams()
  const { user } = useAuth()

  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [images, setImages] = useState([]) // Array of { file, preview, isPrimary, id }
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const variantFileRef = useRef()

  // Product Variants Builder State
  const [variantsList, setVariantsList] = useState([])
  const [editingVariantId, setEditingVariantId] = useState(null)
  const [variantDraft, setVariantDraft] = useState({
    name: '',
    description: '',
    purchase_price: '',
    mrp: '',
    selling_price: '',
    quantity: '',
    images: [],
  })

  const handleVariantImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const newImgs = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: `vimg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }))
    setVariantDraft(prev => ({
      ...prev,
      images: [...prev.images, ...newImgs]
    }))
  }

  const removeVariantImage = (id) => {
    setVariantDraft(prev => ({
      ...prev,
      images: prev.images.filter(img => img.id !== id)
    }))
  }

  const handleAddOrUpdateVariant = () => {
    if (!variantDraft.name.trim() && !variantDraft.purchase_price && !variantDraft.selling_price) {
      toast.error('Please enter variant details before adding.')
      return
    }

    if (editingVariantId) {
      setVariantsList(prev => prev.map(v => v.id === editingVariantId ? { ...variantDraft, id: editingVariantId } : v))
      setEditingVariantId(null)
      toast.success('Product variant updated!')
    } else {
      const newVar = {
        ...variantDraft,
        id: `variant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: variantDraft.name.trim() || `Variant ${variantsList.length + 1}`,
      }
      setVariantsList(prev => [...prev, newVar])
      toast.success('Product variant added!')
    }

    setVariantDraft({
      name: '',
      description: '',
      purchase_price: '',
      mrp: '',
      selling_price: '',
      quantity: '',
      images: [],
    })
  }

  const handleEditVariant = (variant) => {
    setEditingVariantId(variant.id)
    setVariantDraft({ ...variant })
  }

  const handleDeleteVariant = (variantId) => {
    setVariantsList(prev => prev.filter(v => v.id !== variantId))
    if (editingVariantId === variantId) {
      setEditingVariantId(null)
      setVariantDraft({
        name: '',
        description: '',
        purchase_price: '',
        mrp: '',
        selling_price: '',
        quantity: '',
        images: [],
      })
    }
    toast.success('Variant removed')
  }

  const [form, setForm] = useState({
    name: '',
    product_type: '',
    category_id: '',
    subcategory_id: '',
    mobile_brand: '',
    mobile_model: '',
    description: '',
    selling_price: '',
    gst_percentage: '18',
    initial_stock: '',
    min_stock_level: '5',
    ...(prefillData || {}),
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchMergedCategories().then(res => setCategories(res.categories || []))
  }, [])

  useEffect(() => {
    if (form.category_id) {
      const selectedCat = categories.find(c => c.id === form.category_id)
      if (selectedCat && selectedCat.subcategories) {
        setSubcategories(selectedCat.subcategories)
      } else if (isValidUuid(form.category_id)) {
        supabase.from('subcategories').select('*').eq('category_id', form.category_id).order('sort_order')
          .then(({ data }) => setSubcategories(data || []))
      } else {
        setSubcategories([])
      }
    } else {
      setSubcategories([])
    }
  }, [form.category_id, categories])

  // Auto select initial category when categories load
  useEffect(() => {
    if (categories.length > 0) {
      const validCategory = categories.find(c => isValidUuid(c.id) && (c.id === form.category_id || c.slug === form.product_type)) || categories.find(c => isValidUuid(c.id))
      if (validCategory && isValidUuid(validCategory.id)) {
        setForm(prev => ({
          ...prev,
          category_id: validCategory.id,
          product_type: validCategory.slug || prev.product_type || 'iphone_case',
          mobile_brand: prev.mobile_brand || (validCategory.name.toLowerCase().includes('case') ? 'Apple' : 'Universal'),
        }))
      }
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
  }, [prefillData])

  // Fetch product for edit mode
  useEffect(() => {
    if (!productId) return
    setIsLoading(true)
    supabase
      .from('products')
      .select('*, product_images(*)')
      .eq('id', productId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('Product not found')
          navigate('/products')
          return
        }
        setForm({
          name: data.name || '',
          product_type: data.product_type || '',
          category_id: data.category_id || '',
          subcategory_id: data.subcategory_id || '',
          mobile_brand: data.mobile_brand || '',
          mobile_model: data.mobile_model || '',
          description: data.description || '',
          purchase_price: data.purchase_price || '',
          selling_price: data.selling_price || '',
          discount_percentage: data.discount_percentage || '0',
          gst_percentage: data.gst_percentage || '18',
          initial_stock: data.current_stock || '',
          min_stock_level: data.min_stock_level || '5',
        })
        setSelectedModels(parseModels(data.mobile_model))
        setSelectedColors(parseModels(data.color_variants))
        if (data.product_images?.length) {
          setImages(data.product_images.map(img => ({
            id: img.id,
            preview: img.public_url,
            isPrimary: img.is_primary,
            existing: true,
          })))
        }
        setIsLoading(false)
      })
  }, [productId, navigate])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleCategorySelect = (catObj) => {
    const slug = catObj.slug || catObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    setForm(f => ({
      ...f,
      category_id: catObj.id,
      product_type: slug,
      subcategory_id: '',
      mobile_brand: f.mobile_brand || (catObj.name.toLowerCase().includes('case') ? 'Apple' : 'Universal'),
    }))
  }

  // Model Selection Handlers
  const toggleModel = (m) => {
    setSelectedModels(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const handleSeriesToggle = (filterFn) => {
    const modelsInSeries = filterFn()
    const allSelected = modelsInSeries.every(m => selectedModels.includes(m))
    if (allSelected) {
      setSelectedModels(prev => prev.filter(m => !modelsInSeries.includes(m)))
    } else {
      setSelectedModels(prev => Array.from(new Set([...prev, ...modelsInSeries])))
    }
  }

  const clearAllModels = () => setSelectedModels([])

  // Color Selection Handlers
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

  // Upload images helper
  const uploadImages = async (productUuid, targetImages = images) => {
    const results = []
    if (!targetImages || targetImages.length === 0) return results

    for (let i = 0; i < targetImages.length; i++) {
      const img = targetImages[i]
      const isPrimary = img.isPrimary || i === 0

      if (img.existing) {
        results.push({
          product_id: productUuid,
          storage_path: '',
          public_url: img.preview,
          is_primary: isPrimary,
          sort_order: i,
          file_name: 'existing-image.png',
          file_size: 0,
        })
        continue
      }

      const ext = (img.file?.name || 'image.png').split('.').pop()
      const path = `products/${productUuid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      if (img.file) {
        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(path, img.file, { contentType: img.file.type || 'image/jpeg', cacheControl: '3600', upsert: false })

        if (uploadErr) {
          console.error('Supabase storage upload error:', uploadErr)
          toast.error(`Image upload failed: ${uploadErr.message}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
        results.push({
          product_id: productUuid,
          storage_path: path,
          public_url: publicUrl,
          is_primary: isPrimary,
          sort_order: i,
          file_name: img.file.name,
          file_size: img.file.size,
        })
      } else if (img.preview && !img.preview.startsWith('data:image/')) {
        results.push({
          product_id: productUuid,
          storage_path: path,
          public_url: img.preview,
          is_primary: isPrimary,
          sort_order: i,
          file_name: 'product-image.png',
          file_size: 0,
        })
      }
    }
    return results
  }

  const validate = () => {
    const e = {}
    if (!form.product_type && !form.category_id) e.product_type = 'Product category is required'
    // Validate variants
    const effectiveVars = variantsList.length > 0 ? variantsList : (
      (variantDraft.name || variantDraft.purchase_price || variantDraft.selling_price || variantDraft.mrp) ? [variantDraft] : []
    )

    if (effectiveVars.length === 0) {
      e.variants = 'Please add at least one product variant with pricing details'
    } else {
      for (const v of effectiveVars) {
        if (!v.selling_price || Number(v.selling_price) <= 0) {
          e.selling_price = 'Valid selling price required in variant'
          break
        }
      }
    }
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
      const resolveProductType = () => {
        const rawType = (form.product_type || '').toLowerCase()
        if (['iphone_case', 'samsung_case', 'mobile_sticker'].includes(rawType)) return rawType
        if (rawType.includes('sticker')) return 'mobile_sticker'
        if (form.mobile_brand === 'Samsung') return 'samsung_case'
        if (form.mobile_brand === 'Apple') return 'iphone_case'
        return 'iphone_case'
      }

      const colorsStr = selectedColors.length > 0 ? selectedColors.join(', ') : null

      const generateProductName = (varName = '') => {
        if (varName && varName.trim()) return varName.trim()
        if (form.name && form.name.trim()) return form.name.trim()
        const brand = form.mobile_brand && form.mobile_brand !== 'Universal' ? form.mobile_brand : ''
        const catObj = activeCategories.find(c => c.id === form.category_id)
        const catName = catObj ? catObj.name : 'Product'
        let modelSummary = ''
        if (selectedModels.length === 1) {
          modelSummary = selectedModels[0]
        } else if (selectedModels.length > 1) {
          modelSummary = `${selectedModels[0]} +${selectedModels.length - 1} models`
        }
        const parts = [brand, modelSummary, catName].filter(Boolean)
        return parts.join(' ') || 'New Product'
      }

      // Check effective variants list
      let effectiveVariants = [...variantsList]
      if (effectiveVariants.length === 0 && (variantDraft.name || variantDraft.purchase_price || variantDraft.selling_price || variantDraft.mrp)) {
        effectiveVariants.push({
          ...variantDraft,
          id: `variant-auto-${Date.now()}`,
          name: variantDraft.name.trim() || generateProductName(),
        })
      }

      if (effectiveVariants.length === 0) {
        toast.error('Please add at least one product variant.')
        setSaving(false)
        return
      }

      // Ensure category_id and subcategory_id are valid UUIDs or null
      let resolvedCategoryId = isValidUuid(form.category_id) ? form.category_id : null
      if (!resolvedCategoryId && categories.length > 0) {
        const dbCat = categories.find(c => isValidUuid(c.id) && (c.slug === form.product_type || c.id === form.category_id))
          || categories.find(c => isValidUuid(c.id))
        if (dbCat) resolvedCategoryId = dbCat.id
      }

      let resolvedSubcategoryId = isValidUuid(form.subcategory_id) ? form.subcategory_id : null
      if (!resolvedSubcategoryId && subcategories.length > 0) {
        const dbSub = subcategories.find(s => isValidUuid(s.id))
        if (dbSub) resolvedSubcategoryId = dbSub.id
      }

      // Verify created_by ID against DB profiles table to prevent products_created_by_fkey error
      let validCreatedBy = null
      if (isValidUuid(user?.id)) {
        try {
          const { data: profileCheck } = await supabase.from('profiles').select('id').eq('id', user.id).single()
          if (profileCheck?.id) validCreatedBy = profileCheck.id
        } catch {
          validCreatedBy = null
        }
      }

      const getLocalProducts = () => {
        try {
          const stored = localStorage.getItem('wrapstore_custom_products_v1')
          return stored ? JSON.parse(stored) : []
        } catch {
          return []
        }
      }

      const saveLocalProduct = (p) => {
        const local = getLocalProducts()
        const idx = local.findIndex(item => item.id === p.id)
        if (idx !== -1) local[idx] = p
        else local.unshift(p)
        localStorage.setItem('wrapstore_custom_products_v1', JSON.stringify(local))
      }

      let createdCount = 0

      // Iterate through variants and create EACH variant as a single standalone product
      for (let i = 0; i < effectiveVariants.length; i++) {
        const v = effectiveVariants[i]
        const purchasePrice = Number(v.purchase_price || 0)
        const sellingPrice = Number(v.selling_price || 0)
        const mrpPrice = Number(v.mrp || 0)
        const quantity = Number(v.quantity || 0)
        const prodName = generateProductName(v.name)

        const payload = {
          name: prodName,
          product_type: resolveProductType(),
          category_id: resolvedCategoryId,
          subcategory_id: resolvedSubcategoryId,
          mobile_brand: form.mobile_brand || null,
          mobile_model: selectedModels.length > 0 ? selectedModels.join(', ') : (form.mobile_model || null),
          color_variants: colorsStr,
          description: v.description || form.description || null,
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          mrp: mrpPrice,
          discount_percentage: Number(form.discount_percentage) || 0,
          gst_percentage: isNaN(Number(form.gst_percentage)) ? 0 : Number(form.gst_percentage),
          current_stock: quantity,
          min_stock_level: Number(form.min_stock_level) || 5,
          approval_status: 'PENDING_APPROVAL',
        }

        if (validCreatedBy) {
          payload.created_by = validCreatedBy
        }

        let productUuid = null
        let isLocalFallback = false

        let { data, error } = await supabase.from('products').insert(payload).select().single()

        if (error) {
          console.warn('DB Insert error for product variant:', error.message)
          // Strip foreign key or optional fields if DB rejected them
          let currentPayload = { ...payload }
          delete currentPayload.created_by

          if (error.message?.includes('mrp') || error.code === 'PGRST204') {
            delete currentPayload.mrp
            if (mrpPrice > 0 && !currentPayload.description?.includes('MRP:')) {
              currentPayload.description = currentPayload.description ? `${currentPayload.description}\n\nMRP: ₹${mrpPrice}` : `MRP: ₹${mrpPrice}`
            }
          }
          if (error.message?.includes('color_variants')) {
            delete currentPayload.color_variants
          }

          const retry = await supabase.from('products').insert(currentPayload).select().single()
          if (retry.error) {
            const localUuid = `prod-local-${Date.now()}-${i}`
            const localRecord = {
              id: localUuid,
              product_id: `WS-${Math.floor(100000 + Math.random() * 900000)}`,
              ...currentPayload,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            saveLocalProduct(localRecord)
            productUuid = localUuid
            isLocalFallback = true
          } else {
            data = retry.data
            productUuid = data?.id || `prod-local-${Date.now()}-${i}`
          }
        } else {
          productUuid = data?.id || `prod-local-${Date.now()}-${i}`
        }

        // Record initial stock movement
        if (!isLocalFallback && productUuid && quantity > 0) {
          const movementPayload = {
            product_id: productUuid,
            movement_type: 'INITIAL_STOCK',
            quantity: quantity,
            previous_stock: 0,
            new_stock: quantity,
            reason: 'Initial stock on product creation',
          }
          if (validCreatedBy) movementPayload.performed_by = validCreatedBy
          const movementRes = await supabase.from('inventory_movements').insert(movementPayload)
          if (movementRes.error && movementPayload.performed_by) {
            delete movementPayload.performed_by
            await supabase.from('inventory_movements').insert(movementPayload)
          }
        }

        // Upload images for this product variant
        const targetImgs = (v.images && v.images.length > 0) ? v.images : images
        if (targetImgs && targetImgs.length > 0 && productUuid) {
          setUploadingImages(true)
          const imageRecords = await uploadImages(productUuid, targetImgs)
          if (imageRecords.length > 0) {
            await supabase.from('product_images').insert(imageRecords)
            // Attach to local product record if local fallback was used
            if (isLocalFallback) {
              const localProds = getLocalProducts()
              const idx = localProds.findIndex(p => p.id === productUuid)
              if (idx !== -1) {
                localProds[idx].product_images = imageRecords
                localStorage.setItem('wrapstore_custom_products_v1', JSON.stringify(localProds))
              }
            }
          }
          setUploadingImages(false)
        }

        createdCount++
      }

      toast.success(createdCount === 1 ? '1 product submitted for approval!' : `${createdCount} products submitted for approval!`)

      if (onSave) onSave()
      else navigate('/products')
    } catch (err) {
      toast.error(err.message || 'Failed to save products')
      setUploadingImages(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '40px' }}>
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="section-title">{productId ? 'Edit Product' : 'Add Product'}</div>
          <div className="section-subtitle">{productId ? 'Update product details' : 'Create new product listings'}</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-ghost" onClick={() => onSave ? onSave() : navigate('/products')}>
          <ArrowLeft size={14} /> Back to Products
        </button>
      </div>

      <form onSubmit={handleSubmit} id="add-product-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Basic Info */}
          <div className="card">
            <div className="card-header"><span className="card-title">Basic Information</span></div>
            <div className="card-body">
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

              {/* Brand Compatibility */}
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
            </div>
          </div>

          {/* Variants Tile */}
          <div className="card">
            <div className="card-header"><span className="card-title">Variants</span></div>
            <div className="card-body">
              {/* Compatible Mobile Models */}
              {form.mobile_brand !== 'Universal' && modelOptions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Compatible Mobile Models <span className="required">*</span>
                    </label>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: selectedModels.length > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {selectedModels.length} Selected
                    </span>
                  </div>

                  <div style={{
                    border: `1.5px solid ${errors.mobile_model ? 'var(--danger)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    background: '#fafafa',
                  }}>
                    {/* Quick Series Select Buttons */}
                    <div style={{ marginBottom: '12px' }}>
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

                    {/* Display Selected Models as Multi-Select Buttons */}
                    {selectedModels.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Selected Models
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap',
                          maxHeight: '120px',
                          overflowY: 'auto',
                          padding: '8px',
                          background: '#ffffff',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                        }}>
                          {selectedModels.map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => toggleModel(m)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#111827',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '5px 12px',
                                borderRadius: 'var(--radius-full)',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>✓ {m}</span>
                              <X size={12} style={{ opacity: 0.8 }} />
                            </button>
                          ))}
                        </div>
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
                  {errors.mobile_model && <div className="form-error">{errors.mobile_model}</div>}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {form.mobile_brand === 'Universal'
                    ? 'Universal compatibility selected (no model variants required).'
                    : 'Select a brand compatibility in Basic Information to configure model variants.'}
                </div>
              )}

              {/* Colour Variants Selection */}
              <div className="form-group" style={{ marginBottom: 0 }}>
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

              {/* Product Variant Builder Section */}
              <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Product Variant
                </h3>

                {/* Add Image (Multi Image Select) */}
                <div>
                  <label className="form-label" style={{ marginBottom: '8px' }}>Add Image</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div
                      onClick={() => variantFileRef.current?.click()}
                      style={{
                        width: '96px',
                        height: '96px',
                        background: '#e5e7eb',
                        border: '2px dashed #9ca3af',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        textAlign: 'center',
                        padding: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      title="Click to select images"
                    >
                      <Upload size={18} style={{ color: '#4b5563', marginBottom: '4px' }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#374151', lineHeight: '1.2' }}>
                        (Multi Image Select)
                      </span>
                    </div>
                    <input
                      ref={variantFileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleVariantImageSelect}
                    />

                    {/* Draft Image Previews */}
                    {variantDraft.images && variantDraft.images.map(img => (
                      <div
                        key={img.id}
                        style={{
                          position: 'relative',
                          width: '96px',
                          height: '96px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-strong)',
                          background: '#ffffff',
                        }}
                      >
                        <img src={img.preview} alt="variant-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => removeVariantImage(img.id)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.7)',
                            color: '#ffffff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Name & Description Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 220px', marginBottom: 0 }}>
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Variant Name"
                      value={variantDraft.name}
                      onChange={e => setVariantDraft(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '2 1 340px', marginBottom: 0 }}>
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Variant description..."
                      value={variantDraft.description}
                      onChange={e => setVariantDraft(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Purchase Price, MRP, Selling Price Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 140px', marginBottom: 0 }}>
                    <label className="form-label">Purchase Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={variantDraft.purchase_price}
                      onChange={e => setVariantDraft(prev => ({ ...prev, purchase_price: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 140px', marginBottom: 0 }}>
                    <label className="form-label">MRP</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={variantDraft.mrp}
                      onChange={e => setVariantDraft(prev => ({ ...prev, mrp: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 140px', marginBottom: 0 }}>
                    <label className="form-label">Selling Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={variantDraft.selling_price}
                      onChange={e => setVariantDraft(prev => ({ ...prev, selling_price: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Quantity Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '0 1 200px', marginBottom: 0 }}>
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="0"
                      value={variantDraft.quantity}
                      onChange={e => setVariantDraft(prev => ({ ...prev, quantity: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Add Product Variant Button */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 8px 0' }}>
                  <button
                    type="button"
                    onClick={handleAddOrUpdateVariant}
                    style={{
                      padding: '9px 22px',
                      fontSize: '13px',
                      fontWeight: 700,
                      borderRadius: 'var(--radius)',
                      border: '1.5px solid #111827',
                      background: '#ffffff',
                      color: '#111827',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {editingVariantId ? '✓ Update Product Variant' : '+ Add Product Variant'}
                  </button>
                </div>

                {/* Product Variants List Table */}
                <div style={{
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  background: '#ffffff',
                  marginTop: '8px',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid var(--border-strong)', color: '#111827', fontWeight: 700 }}>
                        <th style={{ padding: '12px 14px' }}>Product Image</th>
                        <th style={{ padding: '12px 14px' }}>Product Name</th>
                        <th style={{ padding: '12px 14px' }}>Purchase Price</th>
                        <th style={{ padding: '12px 14px' }}>MRP</th>
                        <th style={{ padding: '12px 14px' }}>Selling Price</th>
                        <th style={{ padding: '12px 14px' }}>Quantity</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No product variants added yet. Add a variant above to configure products.
                          </td>
                        </tr>
                      ) : (
                        variantsList.map((variant) => (
                          <tr key={variant.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                              {variant.images && variant.images.length > 0 ? (
                                <img
                                  src={variant.images[0].preview}
                                  alt="variant"
                                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
                                />
                              ) : (
                                <div style={{
                                  width: '48px', height: '48px', background: '#d1d5db', borderRadius: '6px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
                                }}>
                                  <ImageIcon size={22} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                              {variant.name}
                              {variant.description && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                                  {variant.description}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                              ₹{Number(variant.purchase_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                              ₹{Number(variant.mrp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#10b981', verticalAlign: 'middle' }}>
                              ₹{Number(variant.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                              <span style={{ fontWeight: 600 }}>{variant.quantity || 0}</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditVariant(variant)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: '#e5e7eb',
                                    border: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Edit variant"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariant(variant.id)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: '#e5e7eb',
                                    border: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Delete variant"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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

          {/* Bottom Action Bar: Approval Info & Submit Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: '#1d4ed8'
            }}>
              <Info size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Approval Required</strong>
                <div style={{ marginTop: '2px', color: '#3b82f6' }}>
                  {variantsList.length > 1
                    ? `Each of the ${variantsList.length} product variants will be added as standalone products and submitted for Super Admin approval.`
                    : 'This product will be submitted for Super Admin approval before becoming active in inventory.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onSave ? onSave() : navigate('/products')}
                style={{ padding: '12px 24px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ padding: '12px 32px', minWidth: '220px', justifyContent: 'center' }}
                disabled={saving || uploadingImages}
                id="submit-product-btn"
              >
                {saving || uploadingImages ? (
                  <><div className="btn-spinner" /> {uploadingImages ? 'Uploading images...' : 'Saving products...'}</>
                ) : (
                  <><Save size={16} /> {productId ? 'Update Product' : 'Submit for Approval'}</>
                )}
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}

export default AddProduct
