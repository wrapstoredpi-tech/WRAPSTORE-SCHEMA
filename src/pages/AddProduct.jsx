import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, X, Star, Image as ImageIcon, Save, Info, Edit3, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fetchMergedCategories } from '../lib/categoryStorage'
import { getMrp } from '../lib/productUtils'

const IPHONE_MODELS = [
  'iPhone Duo',
  'iPhone 18 Pro Max', 'iPhone 18 Pro', 'iPhone 18 Plus', 'iPhone 18',
  'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17 Plus', 'iPhone 17',
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 Mini', 'iPhone 13',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 Mini', 'iPhone 12',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
  'iPhone SE (3rd Gen)', 'iPhone SE (2nd Gen)', 'iPhone SE (1st Gen)',
  'iPhone 8 Plus', 'iPhone 8',
  'iPhone 7 Plus', 'iPhone 7',
  'iPhone 6s Plus', 'iPhone 6s', 'iPhone 6 Plus', 'iPhone 6',
  'iPhone 5s', 'iPhone 5c', 'iPhone 5',
  'iPhone 4s', 'iPhone 4',
  'iPhone 3GS', 'iPhone 3G', 'iPhone (1st Gen)',
]

const IPHONE_SERIES = [
  { label: 'iPhone 18 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 18')) },
  { label: 'iPhone 17 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 17')) },
  { label: 'iPhone 16 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 16')) },
  { label: 'iPhone 15 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 15')) },
  { label: 'iPhone 14 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 14')) },
  { label: 'iPhone 13 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 13')) },
  { label: 'iPhone 12 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 12')) },
  { label: 'iPhone 11 Series', filter: () => IPHONE_MODELS.filter(m => m.startsWith('iPhone 11')) },
  { label: 'iPhone Duo', filter: () => IPHONE_MODELS.filter(m => m.toLowerCase().includes('duo')) },
]

const IPAD_MODELS = [
  'iPad Pro 13" (M4)', 'iPad Pro 12.9" (6th Gen)', 'iPad Pro 12.9" (5th Gen)', 'iPad Pro 12.9" (4th Gen)', 'iPad Pro 12.9" (3rd Gen)',
  'iPad Pro 11" (M4)', 'iPad Pro 11" (4th Gen)', 'iPad Pro 11" (3rd Gen)', 'iPad Pro 11" (2nd Gen)', 'iPad Pro 11" (1st Gen)',
  'iPad Air 13" (M2)', 'iPad Air 11" (M2)', 'iPad Air (5th Gen 10.9")', 'iPad Air (4th Gen 10.9")', 'iPad Air (3rd Gen 10.5")',
  'iPad Mini (A17 Pro)', 'iPad Mini (6th Gen 8.3")', 'iPad Mini (5th Gen)',
  'iPad (10th Gen 10.9")', 'iPad (9th Gen 10.2")', 'iPad (8th Gen 10.2")', 'iPad (7th Gen 10.2")', 'iPad (6th Gen 9.7")',
]

const IPAD_SERIES = [
  { label: 'All iPad Models', filter: () => IPAD_MODELS },
  { label: 'iPad Pro Series', filter: () => IPAD_MODELS.filter(m => m.includes('iPad Pro')) },
  { label: 'iPad Air Series', filter: () => IPAD_MODELS.filter(m => m.includes('iPad Air')) },
  { label: 'iPad Mini Series', filter: () => IPAD_MODELS.filter(m => m.includes('iPad Mini')) },
  { label: 'iPad Standard Series', filter: () => IPAD_MODELS.filter(m => m.startsWith('iPad (')) },
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

const MAH_OPTIONS = ['5000mah', '10000mah', '15000mah', '20000mah']
const STRAP_MM_OPTIONS = ['38', '40', '41', '42', '44', '45', '46', '49']

const TARGET_COLOUR_SUBCATEGORIES = [
  'power bank',
  'watch strap',
  'ipad case',
  'cables',
  'cable',
  'airpods cases',
  'airpods case',
  'wallet',
  'watch cases',
  'watch case',
  'phone stand',
  'adapters',
  'adapter',
  'lens protector',
]

const isColourVariantSubcategory = (subcatName) => {
  if (!subcatName || typeof subcatName !== 'string') return false
  const nameLower = subcatName.toLowerCase().trim()
  return TARGET_COLOUR_SUBCATEGORIES.some(target => nameLower.includes(target) || target.includes(nameLower))
}

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

  // Tempered Glass Variant State
  const [temperedBorder, setTemperedBorder] = useState('Border')
  const [temperedPrivacy, setTemperedPrivacy] = useState('Normal')

  // Product Variants Builder State
  const [variantsList, setVariantsList] = useState([])
  const [editingVariantId, setEditingVariantId] = useState(null)
  const [variantDraft, setVariantDraft] = useState({
    name: '',
    brand_name: '',
    description: '',
    purchase_price: '0',
    mrp: '',
    selling_price: '',
    quantity: '',
    color: '',
    model: '',
    mah: '',
    strap_mm: '',
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
    if (!variantDraft.name.trim() && !variantDraft.selling_price && !variantDraft.mrp) {
      toast.error('Please enter variant details before adding.')
      return
    }

    const requiresModel = shouldShowModelSelection && (form.mobile_brand === 'Apple' || form.mobile_brand === 'Samsung') && modelOptions.length > 0
    if (requiresModel && !variantDraft.model) {
      toast.error('Please select a Model for this variant.')
      return
    }

    if (isPowerBank && !variantDraft.mah) {
      toast.error('Please select mah for this power bank variant.')
      return
    }

    if (isWatchStrap && !variantDraft.strap_mm) {
      toast.error('Please select Strap mm for this watch strap variant.')
      return
    }

    const temperedVariantName = `${temperedBorder} - ${temperedPrivacy}`
    const assignedColor = isTemperedGlass
      ? temperedVariantName
      : (shouldShowColourVariants ? (variantDraft.color || null) : null)

    const assignedModel = variantDraft.model || null
    const assignedMah = isPowerBank ? (variantDraft.mah || null) : null
    const assignedStrapMm = isWatchStrap ? (variantDraft.strap_mm || null) : null

    if (editingVariantId) {
      setVariantsList(prev => prev.map(v => v.id === editingVariantId ? {
        ...variantDraft,
        color: assignedColor || null,
        model: assignedModel || v.model || null,
        mah: assignedMah || v.mah || null,
        strap_mm: assignedStrapMm || v.strap_mm || null,
        images: (variantDraft.images && variantDraft.images.length > 0) ? variantDraft.images : images,
        id: editingVariantId,
      } : v))
      setEditingVariantId(null)
      toast.success('Product variant updated!')
    } else {
      const defaultProdTitle = form.name && form.name.trim() ? form.name.trim() : (isTemperedGlass ? 'Tempered Glass' : (isWatchStrap ? 'Watch Strap' : 'Product'))
      const strapSuffix = assignedStrapMm ? `${assignedStrapMm}mm` : null
      const varSuffixes = [assignedColor, strapSuffix, assignedMah].filter(Boolean).join(' - ')
      const newVar = {
        ...variantDraft,
        color: assignedColor || null,
        model: assignedModel,
        mah: assignedMah,
        strap_mm: assignedStrapMm,
        images: (variantDraft.images && variantDraft.images.length > 0) ? variantDraft.images : images,
        purchase_price: '0',
        id: (productId || prefillData?.id) && variantsList.length === 0
          ? `variant-existing-${productId || prefillData?.id}`
          : `variant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: variantDraft.name.trim() || (varSuffixes ? `${defaultProdTitle} - ${varSuffixes}` : `${defaultProdTitle} ${variantsList.length + 1}`),
      }
      setVariantsList(prev => [...prev, newVar])
      toast.success('Product variant added!')
    }

    setVariantDraft({
      name: '',
      brand_name: '',
      description: '',
      purchase_price: '0',
      mrp: '',
      selling_price: '',
      quantity: '',
      color: '',
      model: '',
      mah: '',
      strap_mm: '',
      images: [],
    })
  }

  const handleEditVariant = (variant) => {
    setEditingVariantId(variant.id)
    const rawModel = variant.model || variant.mobile_model || ''
    setVariantDraft({
      ...variant,
      model: rawModel,
      color: variant.color || variant.color_variants || '',
      mah: variant.mah || '',
      strap_mm: variant.strap_mm || '',
    })
    setSelectedModels(parseModels(rawModel))
    if (isTemperedGlass && variant.color) {
      if (variant.color.includes('Borderless')) setTemperedBorder('Borderless')
      else if (variant.color.includes('Border')) setTemperedBorder('Border')

      if (variant.color.includes('360 Degree privacy')) setTemperedPrivacy('360 Degree privacy')
      else if (variant.color.includes('Matte Privacy')) setTemperedPrivacy('Matte Privacy')
      else if (variant.color.includes('Normal')) setTemperedPrivacy('Normal')
    }
  }

  const handleDeleteVariant = (variantId) => {
    setVariantsList(prev => prev.filter(v => v.id !== variantId))
    if (editingVariantId === variantId) {
      setEditingVariantId(null)
      setVariantDraft({
        name: '',
        brand_name: '',
        description: '',
        purchase_price: '',
        mrp: '',
        selling_price: '',
        quantity: '',
        color: '',
        model: '',
        mah: '',
        strap_mm: '',
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
    collection: '',
    magsafe: false,
    description: '',
    selling_price: '',
    gst_percentage: '18',
    initial_stock: '',
    min_stock_level: '5',
    ...(prefillData || {}),
    ...(prefillData ? { magsafe: prefillData.magsafe === true || prefillData.magsafe === 'Yes' || prefillData.magsafe === 'true' } : {}),
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

  const selectedCatObj = categories.find(c => c.id === form.category_id || c.slug === form.product_type)
  const categoryName = selectedCatObj?.name || form.product_type || ''

  const selectedSubcatObj = subcategories.find(s => s.id === form.subcategory_id)
  const selectedSubcatName = selectedSubcatObj?.name || (typeof form.subcategory_id === 'string' ? form.subcategory_id : '')

  const isTemperedGlass = /tempered/i.test(selectedSubcatName) || selectedSubcatName.toLowerCase().includes('tempered glass')
  const isIpadCategory = /ipad/i.test(selectedSubcatName) || /ipad/i.test(form.product_type || '') || /ipad/i.test(form.name || '')
  const isMobileCase = (/mobile case|cases/i.test(categoryName) || form.product_type === 'iphone_case' || form.product_type === 'samsung_case') && !isIpadCategory
  const isMobileAccessoryWithModels = /lens|tempered/i.test(selectedSubcatName)
  const isAccessoriesCategory = categoryName.toLowerCase().includes('access') || form.product_type === 'accessories' || form.product_type === 'gadgets' || !isMobileCase
  const shouldShowColourVariants = isMobileCase || isColourVariantSubcategory(selectedSubcatName)

  const isPowerBank = /power\s*bank/i.test(selectedSubcatName) ||
    selectedSubcatName.toLowerCase().includes('power bank') ||
    /power\s*bank/i.test(form.name || '')

  const isWatchStrap = /watch\s*strap/i.test(selectedSubcatName) ||
    selectedSubcatName.toLowerCase().includes('watch strap') ||
    /watch\s*strap/i.test(form.name || '')

  const shouldShowModelSelection = isMobileCase || isIpadCategory || isMobileAccessoryWithModels

  useEffect(() => {
    if (isIpadCategory && form.mobile_brand === 'Universal') {
      setForm(prev => ({ ...prev, mobile_brand: 'Apple' }))
    }
  }, [form.subcategory_id, isIpadCategory])

  const modelOptions = isIpadCategory
    ? IPAD_MODELS
    : (form.mobile_brand === 'Apple' || form.product_type === 'iphone_case'
      ? IPHONE_MODELS
      : form.mobile_brand === 'Samsung' || form.product_type === 'samsung_case'
      ? SAMSUNG_MODELS
      : [])

  const seriesOptions = isIpadCategory
    ? IPAD_SERIES
    : (form.mobile_brand === 'Apple' || form.product_type === 'iphone_case'
      ? IPHONE_SERIES
      : form.mobile_brand === 'Samsung' || form.product_type === 'samsung_case'
      ? SAMSUNG_SERIES
      : [])

  const [selectedModels, setSelectedModels] = useState(() => parseModels(prefillData?.mobile_model))
  const [modelSearch, setModelSearch] = useState('')
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0)

  useEffect(() => {
    if (form.mobile_brand === 'Apple' || form.product_type === 'iphone_case') {
      setActiveSeriesIdx(0) // iPhone 18 Series
    } else if (form.mobile_brand === 'Samsung' || form.product_type === 'samsung_case') {
      setActiveSeriesIdx(0) // Galaxy S25 Series
    } else {
      setActiveSeriesIdx(0)
    }
  }, [form.mobile_brand, form.product_type, isIpadCategory])

  // Colour Variants State
  const [availableColors, setAvailableColors] = useState(() => {
    const prefilled = parseModels(prefillData?.color_variants || prefillData?.color)
    return Array.from(new Set([...DEFAULT_GENERIC_COLORS, ...prefilled]))
  })
  const [selectedColors, setSelectedColors] = useState(() => parseModels(prefillData?.color_variants || prefillData?.color))
  const [showAddColorInput, setShowAddColorInput] = useState(false)
  const [newColorInput, setNewColorInput] = useState('')

  useEffect(() => {
    if (prefillData) {
      const mrpValue = prefillData.mrp || getMrp(prefillData)
      const colorVal = prefillData.color_variants || prefillData.color || ''
      const prefilledColors = parseModels(colorVal)

      setSelectedColors(prefilledColors)
      setAvailableColors(prev => Array.from(new Set([...prev, ...prefilledColors])))

      if (prefillData.mobile_model) {
        setSelectedModels(parseModels(prefillData.mobile_model))
        setVariantDraft(prev => ({ ...prev, model: prefillData.mobile_model }))
      }

      if (prefillData.accessory_variants && prefillData.accessory_variants.length > 0) {
        const mappedVars = prefillData.accessory_variants.map(v => ({
          id: v.id,
          name: v.variant_name || '',
          brand_name: prefillData.brand_name || '',
          description: v.description || '',
          purchase_price: '0',
          mrp: v.mrp?.toString() || '0',
          selling_price: v.selling_price?.toString() || '0',
          quantity: v.quantity?.toString() || '0',
          color: v.attributes?.color || v.variant_name,
          strap_mm: v.attributes?.strap_mm || prefillData.strap_mm || '',
          model: prefillData.mobile_model || '',
          mah: prefillData.mah || '',
          images: (v.accessory_variant_images || []).map(img => ({
            id: img.id,
            preview: img.image_url,
            existing: true,
          })),
        }))
        setVariantsList([])
        if (mappedVars[0]) setVariantDraft({ ...mappedVars[0] })
      } else {
        const initialVariant = {
          id: `variant-existing-${prefillData.id || Date.now()}`,
          name: prefillData.name || '',
          description: prefillData.description || '',
          purchase_price: prefillData.purchase_price?.toString() || '',
          mrp: mrpValue ? mrpValue.toString() : '',
          selling_price: prefillData.selling_price?.toString() || '',
          quantity: (prefillData.current_stock ?? prefillData.initial_stock)?.toString() || '',
          color: colorVal,
          model: prefillData.mobile_model || '',
          mah: prefillData.mah || '',
          strap_mm: prefillData.strap_mm || '',
          images: (prefillData.product_images || []).map(img => ({
            id: img.id,
            preview: img.public_url || img.preview,
            existing: true,
          })),
        }

        setVariantDraft({ ...initialVariant })
        setVariantsList([])
      }
    }
  }, [prefillData])

  // Fetch product for edit mode if prefillData was not passed directly
  useEffect(() => {
    if (!productId || prefillData) return
    setIsLoading(true)

    const loadEditProduct = async () => {
      // 1. Try Mobile Cases table
      const { data: prodData } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('id', productId)
        .maybeSingle()

      if (prodData) {
        const mrpValue = getMrp(prodData)
        const colorVal = prodData.color_variants || ''
        const colors = parseModels(colorVal)

        setForm({
          name: prodData.name || '',
          product_type: prodData.product_type || '',
          category_id: prodData.category_id || '',
          subcategory_id: prodData.subcategory_id || '',
          mobile_brand: prodData.mobile_brand || '',
          mobile_model: prodData.mobile_model || '',
          collection: prodData.collection || '',
          magsafe: prodData.magsafe === true || prodData.magsafe === 'Yes' || prodData.magsafe === 'true',
          description: prodData.description || '',
          purchase_price: prodData.purchase_price?.toString() || '',
          selling_price: prodData.selling_price?.toString() || '',
          discount_percentage: prodData.discount_percentage?.toString() || '0',
          gst_percentage: prodData.gst_percentage != null ? prodData.gst_percentage.toString() : '18',
          initial_stock: prodData.current_stock?.toString() || '',
          min_stock_level: prodData.min_stock_level?.toString() || '5',
        })
        setSelectedModels(parseModels(prodData.mobile_model))
        setSelectedColors(colors)

        const mappedImages = (prodData.product_images || []).map(img => ({
          id: img.id,
          preview: img.public_url,
          isPrimary: img.is_primary,
          existing: true,
        }))

        if (mappedImages.length) setImages(mappedImages)

        const initialVariant = {
          id: `variant-existing-${prodData.id}`,
          name: prodData.name || '',
          description: prodData.description || '',
          purchase_price: prodData.purchase_price?.toString() || '',
          mrp: mrpValue ? mrpValue.toString() : '',
          selling_price: prodData.selling_price?.toString() || '',
          quantity: prodData.current_stock?.toString() || '',
          color: colorVal,
          model: prodData.mobile_model || '',
          mah: prodData.mah || '',
          strap_mm: prodData.strap_mm || '',
          images: mappedImages,
        }

        setVariantDraft({ ...initialVariant })
        setVariantsList([])
        setIsLoading(false)
        return
      }

      // 2. Try Accessories table
      const { data: accData, error: accError } = await supabase
        .from('accessories')
        .select(`
          *,
          categories(name),
          subcategories(name),
          accessory_variants(
            *,
            accessory_variant_images(*)
          ),
          accessory_compatible_models(
            *,
            mobile_models(model_name)
          )
        `)
        .eq('id', productId)
        .maybeSingle()

      if (accError || !accData) {
        toast.error('Product not found')
        navigate('/products')
        return
      }

      const models = accData.accessory_compatible_models?.map(m => m.mobile_models?.model_name).filter(Boolean) || []
      const primaryVar = accData.accessory_variants?.[0]

      setForm({
        name: accData.product_name || '',
        product_type: 'accessories',
        category_id: accData.category_id || '',
        subcategory_id: accData.subcategory_id || '',
        mobile_brand: accData.compatibility_type ? accData.compatibility_type.charAt(0).toUpperCase() + accData.compatibility_type.slice(1) : 'Universal',
        mobile_model: models.join(', '),
        description: accData.description || '',
        purchase_price: '0',
        selling_price: primaryVar?.selling_price?.toString() || '0',
        discount_percentage: '0',
        gst_percentage: '18',
        initial_stock: primaryVar?.quantity?.toString() || '0',
        min_stock_level: '5',
      })
      setSelectedModels(models)

      if (accData.brand_name) {
        setVariantDraft(prev => ({ ...prev, brand_name: accData.brand_name }))
      }

      if (accData.accessory_variants && accData.accessory_variants.length > 0) {
        const mappedVars = accData.accessory_variants.map(v => ({
          id: v.id,
          name: v.variant_name || '',
          brand_name: accData.brand_name || '',
          description: v.description || '',
          purchase_price: '0',
          mrp: v.mrp?.toString() || '0',
          selling_price: v.selling_price?.toString() || '0',
          quantity: v.quantity?.toString() || '0',
          color: v.attributes?.color || v.variant_name,
          strap_mm: v.attributes?.strap_mm || accData.strap_mm || '',
          images: (v.accessory_variant_images || []).map(img => ({
            id: img.id,
            preview: img.image_url,
            existing: true,
          })),
        }))
        setVariantsList([])
        if (mappedVars[0]) setVariantDraft({ ...mappedVars[0] })

        const extractedColors = mappedVars.map(v => v.color).filter(Boolean)
        if (extractedColors.length > 0) {
          setSelectedColors(extractedColors)
          setAvailableColors(prev => Array.from(new Set([...DEFAULT_GENERIC_COLORS, ...prev, ...extractedColors])))
        }

        const allImgs = mappedVars.flatMap(v => v.images)
        if (allImgs.length > 0) setImages(allImgs)
      }

      setIsLoading(false)
    }

    loadEditProduct()
  }, [productId, prefillData, navigate])

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

  // Model Selection Handlers (supports multiple models)
  const toggleModel = (m) => {
    const current = parseModels(variantDraft.model)
    const updated = current.includes(m)
      ? current.filter(x => x !== m)
      : [...current, m]
    const updatedStr = updated.join(', ')
    setVariantDraft(prev => ({ ...prev, model: updatedStr }))
    setSelectedModels(updated)
  }

  const handleSeriesToggle = (filterFn) => {
    const current = parseModels(variantDraft.model)
    const modelsInSeries = typeof filterFn === 'function' ? filterFn() : []
    const allSelected = modelsInSeries.length > 0 && modelsInSeries.every(m => current.includes(m))
    const updated = allSelected
      ? current.filter(m => !modelsInSeries.includes(m))
      : Array.from(new Set([...current, ...modelsInSeries]))
    const updatedStr = updated.join(', ')
    setVariantDraft(prev => ({ ...prev, model: updatedStr }))
    setSelectedModels(updated)
  }

  const clearAllModels = () => {
    setVariantDraft(prev => ({ ...prev, model: '' }))
    setSelectedModels([])
  }

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
    setVariantDraft(prev => ({ ...prev, color: formatted }))
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

      // Skip existing images that are already uploaded and saved in database
      if (img.existing) {
        continue
      }

      if (img.file) {
        const ext = (img.file.name || 'image.png').split('.').pop()
        const path = `products/${productUuid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

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
    const requiresModel = shouldShowModelSelection && (form.mobile_brand === 'Apple' || form.mobile_brand === 'Samsung') && modelOptions.length > 0
    if (requiresModel) {
      const hasMissingModel = effectiveVars.some(v => !v.model && !v.mobile_model)
      if (hasMissingModel) e.mobile_model = 'Select a compatible model for each variant'
    }
    if (isPowerBank) {
      const hasMissingMah = effectiveVars.some(v => !v.mah)
      if (hasMissingMah) e.mah = 'Select mah for each power bank variant'
    }
    if (isWatchStrap) {
      const hasMissingStrapMm = effectiveVars.some(v => !v.strap_mm)
      if (hasMissingStrapMm) e.strap_mm = 'Select Strap mm for each watch strap variant'
    }
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
        if (isAccessoriesCategory || rawType.includes('access') || rawType === 'accessories') return 'accessories'
        if (['iphone_case', 'samsung_case', 'mobile_sticker'].includes(rawType)) return rawType
        if (rawType.includes('sticker')) return 'mobile_sticker'
        if (form.mobile_brand === 'Samsung') return 'samsung_case'
        if (form.mobile_brand === 'Apple') return 'iphone_case'
        return 'iphone_case'
      }

      const generateProductName = (varName = '') => {
        let baseName = form.name && form.name.trim() ? form.name.trim() : ''
        if (!baseName) {
          const catObj = activeCategories.find(c => c.id === form.category_id)
          baseName = catObj ? catObj.name : 'Product'
        }

        const vName = varName && varName.trim() ? varName.trim() : ''
        if (vName && vName.toLowerCase() !== baseName.toLowerCase() && !baseName.toLowerCase().includes(vName.toLowerCase())) {
          return `${baseName} - ${vName}`
        }

        return baseName
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

      // ============================================================
      // EXISTING MOBILE CASES SAVE FLOW (UNTOUCHED & PRESERVED)
      // ============================================================
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
        const targetId = (productId || prefillData?.id) && i === 0 ? (productId || prefillData?.id) : null
        const purchasePrice = 0
        const sellingPrice = Number(v.selling_price || 0)
        const mrpPrice = Number(v.mrp || 0)
        const quantity = Number(v.quantity || 0)

        // Assign unique color for THIS variant instance (null if no color chosen)
        const variantColor = v.color || v.color_variant || v.color_variants || null

        // Assign unique model for THIS variant instance
        const variantModel = v.model || v.mobile_model || (selectedModels.length > 0 ? (selectedModels[i] || selectedModels[0]) : (form.mobile_model || null))

        // Assign mah for THIS variant instance if it's a power bank
        const variantMah = v.mah || (isPowerBank ? variantDraft.mah : null) || null

        // Assign strap_mm for THIS variant instance if it's a watch strap
        const variantStrapMm = v.strap_mm || (isWatchStrap ? variantDraft.strap_mm : null) || null

        const prodName = (targetId && v.name && v.name.trim()) ? v.name.trim() : (v.name && v.name.trim() ? v.name.trim() : generateProductName(v.name))

        const payload = {
          name: prodName,
          product_type: resolveProductType(),
          category_id: resolvedCategoryId,
          subcategory_id: resolvedSubcategoryId,
          mobile_brand: v.brand_name || form.mobile_brand || null,
          mobile_model: variantModel,
          color_variants: variantColor,
          mah: variantMah,
          strap_mm: variantStrapMm,
          collection: form.collection && form.collection.trim() ? form.collection.trim() : null,
          magsafe: Boolean(form.magsafe),
          description: v.description || form.description || null,
          purchase_price: 0,
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

        let data, error
        if (targetId) {
          const res = await supabase.from('products').update(payload).eq('id', targetId).select().single()
          data = res.data
          error = res.error
        } else {
          const res = await supabase.from('products').insert(payload).select().single()
          data = res.data
          error = res.error
        }

        if (error) {
          console.warn('DB Insert error for product variant:', error.message)
          // Strip foreign key or optional fields if DB rejected them
          let currentPayload = { ...payload }
          delete currentPayload.created_by

          if (error.message?.includes('magsafe') || error.code === 'PGRST204') {
            delete currentPayload.magsafe
          }
          if (error.message?.includes('mah') || error.code === 'PGRST204') {
            delete currentPayload.mah
          }
          if (error.message?.includes('strap_mm') || error.code === 'PGRST204') {
            delete currentPayload.strap_mm
          }
          if (error.message?.includes('mrp') || error.code === 'PGRST204') {
            delete currentPayload.mrp
            if (mrpPrice > 0 && !currentPayload.description?.includes('MRP:')) {
              currentPayload.description = currentPayload.description ? `${currentPayload.description}\n\nMRP: ₹${mrpPrice}` : `MRP: ₹${mrpPrice}`
            }
          }
          if (error.message?.includes('color_variants')) {
            delete currentPayload.color_variants
          }
          if (error.message?.includes('collection')) {
            delete currentPayload.collection
          }

          const retry = targetId
            ? await supabase.from('products').update(currentPayload).eq('id', targetId).select().single()
            : await supabase.from('products').insert(currentPayload).select().single()
          if (retry.error) {
            const localUuid = `prod-local-${Date.now()}-${i}`
            const localRecord = {
              id: localUuid,
              product_id: `WS-${Math.floor(100000 + Math.random() * 900000)}`,
              ...currentPayload,
              mah: variantMah,
              strap_mm: variantStrapMm,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            saveLocalProduct(localRecord)
            productUuid = localUuid
            isLocalFallback = true
          } else {
            data = retry.data
            productUuid = data?.id || `prod-local-${Date.now()}-${i}`
            // Also cache locally with mah & strap_mm
            saveLocalProduct({
              id: productUuid,
              product_id: data?.product_id || `WS-${Math.floor(100000 + Math.random() * 900000)}`,
              ...payload,
              mah: variantMah,
              strap_mm: variantStrapMm,
              created_at: data?.created_at || new Date().toISOString(),
              updated_at: data?.updated_at || new Date().toISOString(),
            })
          }
        } else {
          productUuid = data?.id || `prod-local-${Date.now()}-${i}`
          // Cache locally with mah & strap_mm
          saveLocalProduct({
            id: productUuid,
            product_id: data?.product_id || `WS-${Math.floor(100000 + Math.random() * 900000)}`,
            ...payload,
            mah: variantMah,
            strap_mm: variantStrapMm,
            created_at: data?.created_at || new Date().toISOString(),
            updated_at: data?.updated_at || new Date().toISOString(),
          })
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

          // If updating an existing product, clean up removed image rows if any were deleted
          if (targetId) {
            const keepImageIds = targetImgs.filter(img => img.existing && img.id).map(img => img.id)
            const keepUrls = targetImgs.filter(img => img.existing && img.preview).map(img => img.preview)

            const { data: existingDbImages } = await supabase.from('product_images').select('id, public_url').eq('product_id', productUuid)
            if (existingDbImages && existingDbImages.length > 0) {
              const toRemove = existingDbImages.filter(dbImg => !keepImageIds.includes(dbImg.id) && !keepUrls.includes(dbImg.public_url))
              if (toRemove.length > 0) {
                const removeIds = toRemove.map(r => r.id)
                await supabase.from('product_images').delete().in('id', removeIds)
              }
            }
          }

          // Upload only newly added images
          const newImageRecords = await uploadImages(productUuid, targetImgs)
          if (newImageRecords.length > 0) {
            await supabase.from('product_images').insert(newImageRecords)
            // Attach to local product record if local fallback was used
            if (isLocalFallback) {
              const localProds = getLocalProducts()
              const idx = localProds.findIndex(p => p.id === productUuid)
              if (idx !== -1) {
                localProds[idx].product_images = [...(localProds[idx].product_images || []), ...newImageRecords]
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

              {/* Brand Compatibility & Category / Subcategory */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '24px' }}>
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

                <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                  <label className="form-label">Category</label>
                  <select
                    id="category-select"
                    className="form-select"
                    value={form.category_id}
                    onChange={e => { set('category_id', e.target.value); set('subcategory_id', '') }}
                  >
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                  <label className="form-label">Subcategory</label>
                  <select
                    id="subcategory-select"
                    className="form-select"
                    value={form.subcategory_id}
                    onChange={e => {
                      set('subcategory_id', e.target.value)
                      setSelectedModels([])
                    }}
                    disabled={!form.category_id || subcategories.length === 0}
                  >
                    <option value="">Select subcategory...</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
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

                {/* Colour Variants, Model, mAh & Strap mm Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: ((shouldShowColourVariants || isTemperedGlass) && (shouldShowModelSelection || isPowerBank || isWatchStrap))
                    ? 'repeat(auto-fit, minmax(320px, 1fr))'
                    : '1fr',
                  gap: '24px',
                  alignItems: 'flex-start',
                }}>
                  {/* Colour / Tempered Glass Variants Selection */}
                  {isTemperedGlass ? (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Variants
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#fafafa', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        {/* 1st Selection: Dropdown for Border / Borderless */}
                        <div style={{ flex: '0 1 200px' }}>
                          <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                            Border Option
                          </label>
                          <select
                            className="form-select"
                            value={temperedBorder}
                            onChange={e => setTemperedBorder(e.target.value)}
                            style={{ fontSize: '13px', height: '38px', background: '#ffffff' }}
                          >
                            <option value="Border">Border</option>
                            <option value="Borderless">Borderless</option>
                          </select>
                        </div>

                        {/* 2nd Selection: Privacy Selection Buttons */}
                        <div style={{ flex: '1 1 340px' }}>
                          <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                            Privacy Option
                          </label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {['Normal', '360 Degree privacy', 'Matte Privacy'].map(type => {
                              const isSelected = temperedPrivacy === type
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setTemperedPrivacy(type)}
                                  style={{
                                    fontSize: '12px',
                                    padding: '7px 14px',
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
                                  {type}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : shouldShowColourVariants ? (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Colour Variants
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {availableColors.map(color => {
                          const isSelected = variantDraft.color === color
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setVariantDraft(prev => ({ ...prev, color: prev.color === color ? '' : color }))
                              }}
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

                      {/* Selected colour shown below colors */}
                      {variantDraft.color && (
                        <div style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#10b981',
                        }}>
                          <span>✓ {variantDraft.color}</span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Model Selection Row / Column next to Colour Variant */}
                  {shouldShowModelSelection && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Model <span className="required">*</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {parseModels(variantDraft.model).length > 0 && (
                            <button
                              type="button"
                              id="clear-all-models-btn"
                              onClick={clearAllModels}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0,
                              }}
                            >
                              Clear all
                            </button>
                          )}
                          {parseModels(variantDraft.model).length > 0 && (
                            <span id="selected-models-count" style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                              ✓ {parseModels(variantDraft.model).length === 1 ? parseModels(variantDraft.model)[0] : `${parseModels(variantDraft.model).length} Models Selected`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selected Models Badges Display */}
                      <div
                        id="selected-models-container"
                        style={{
                          background: '#ffffff',
                          minHeight: '38px',
                          border: !variantDraft.model && errors.mobile_model ? '1.5px solid var(--danger)' : '1px solid var(--border-strong)',
                          borderRadius: 'var(--radius)',
                          padding: '6px 10px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        {parseModels(variantDraft.model).length === 0 ? (
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Click pills below or choose from dropdown to select models (multiple allowed)
                          </span>
                        ) : (
                          parseModels(variantDraft.model).map(m => (
                            <span
                              key={m}
                              id={`selected-badge-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#111827',
                                color: '#ffffff',
                                padding: '3px 9px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              <span>✓ {m}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleModel(m)
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#d1d5db',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: '13px',
                                  lineHeight: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title={`Remove ${m}`}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* Model Dropdown to quickly pick additional models */}
                      <select
                        id="model-dropdown-select"
                        className="form-select"
                        value=""
                        onChange={e => {
                          if (e.target.value) {
                            toggleModel(e.target.value)
                            e.target.value = ''
                          }
                        }}
                        style={{
                          background: '#ffffff',
                          fontSize: '13px',
                          height: '38px',
                          marginBottom: '8px',
                          color: '#374151',
                        }}
                      >
                        <option value="">+ Add model from dropdown...</option>
                        {modelOptions
                          .filter(m => !parseModels(variantDraft.model).includes(m))
                          .map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                      </select>

                      {/* Quick Series & Model Select Pills */}
                      {seriesOptions.length > 1 && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          background: '#fafafa',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                        }}>
                          {/* Series Quick Filter */}
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                              Series:
                            </span>
                            {seriesOptions.map((series, idx) => {
                              const isSeriesActive = activeSeriesIdx === idx
                              return (
                                <button
                                  key={idx}
                                  id={`series-btn-${idx}`}
                                  type="button"
                                  onClick={() => setActiveSeriesIdx(idx)}
                                  style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    border: isSeriesActive ? '1px solid #111827' : '1px solid #d1d5db',
                                    background: isSeriesActive ? '#111827' : '#ffffff',
                                    color: isSeriesActive ? '#ffffff' : '#374151',
                                    fontWeight: isSeriesActive ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {series.label.replace(' Series', '').replace(' Models', '')}
                                </button>
                              )
                            })}
                          </div>

                          {/* Line separating below Series */}
                          <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                          {/* Variant Label, Quick Series Toggle & Quick Model Pills */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                VARIANT (SELECT MULTIPLE):
                              </span>
                              {activeSeriesIdx >= 0 && seriesOptions[activeSeriesIdx] && (
                                <button
                                  type="button"
                                  id="toggle-series-selection-btn"
                                  onClick={() => handleSeriesToggle(seriesOptions[activeSeriesIdx]?.filter || (() => []))}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--brand-black, #111827)',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: 0,
                                  }}
                                >
                                  {(seriesOptions[activeSeriesIdx]?.filter() || []).length > 0 &&
                                   (seriesOptions[activeSeriesIdx]?.filter() || []).every(m => parseModels(variantDraft.model).includes(m))
                                    ? 'Deselect series'
                                    : 'Select all in series'}
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', maxHeight: '130px', overflowY: 'auto' }}>
                              {(seriesOptions[activeSeriesIdx]?.filter() || modelOptions).map(m => {
                                const isSelected = parseModels(variantDraft.model).includes(m)
                                return (
                                  <button
                                    key={m}
                                    id={`model-pill-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                    type="button"
                                    onClick={() => toggleModel(m)}
                                    style={{
                                      fontSize: '11px',
                                      padding: '4px 10px',
                                      borderRadius: 'var(--radius-full)',
                                      border: isSelected ? '1.5px solid #111827' : '1px solid #d1d5db',
                                      background: isSelected ? '#111827' : '#ffffff',
                                      color: isSelected ? '#ffffff' : '#374151',
                                      fontWeight: isSelected ? 700 : 500,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      transition: 'all 0.15s ease',
                                      boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                                    }}
                                  >
                                    {isSelected && <span style={{ fontSize: '10px', fontWeight: 800 }}>✓</span>}
                                    {m}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* mAh Selection for Power Bank */}
                  {isPowerBank && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          mah <span className="required">*</span>
                        </label>
                        {variantDraft.mah && (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                            ✓ {variantDraft.mah}
                          </span>
                        )}
                      </div>

                      {/* mAh Dropdown */}
                      <select
                        className="form-select"
                        id="powerbank-mah-select"
                        value={variantDraft.mah || ''}
                        onChange={e => setVariantDraft(prev => ({ ...prev, mah: e.target.value }))}
                        style={{
                          background: '#ffffff',
                          fontSize: '13px',
                          height: '38px',
                          marginBottom: '8px',
                          border: !variantDraft.mah && errors.mah ? '1.5px solid var(--danger)' : undefined,
                        }}
                      >
                        <option value="">Select mah...</option>
                        {MAH_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>

                      {/* Quick Select mAh Pills */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        background: '#fafafa',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Types:
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {MAH_OPTIONS.map(type => {
                            const isSelected = variantDraft.mah === type
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setVariantDraft(prev => ({ ...prev, mah: prev.mah === type ? '' : type }))}
                                style={{
                                  fontSize: '12px',
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-full)',
                                  border: isSelected ? '1.5px solid #111827' : '1px solid #d1d5db',
                                  background: isSelected ? '#111827' : '#ffffff',
                                  color: isSelected ? '#ffffff' : '#374151',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                                }}
                              >
                                {isSelected && <span style={{ fontSize: '11px', fontWeight: 800 }}>✓</span>}
                                {type}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strap mm Selection for Watch Strap */}
                  {isWatchStrap && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Strap mm <span className="required">*</span>
                        </label>
                      </div>

                      {/* Strap mm Dropdown */}
                      <select
                        className="form-select"
                        id="watchstrap-mm-select"
                        value={variantDraft.strap_mm || ''}
                        onChange={e => setVariantDraft(prev => ({ ...prev, strap_mm: e.target.value }))}
                        style={{
                          background: '#ffffff',
                          fontSize: '13px',
                          height: '38px',
                          marginBottom: '8px',
                          border: !variantDraft.strap_mm && errors.strap_mm ? '1.5px solid var(--danger)' : undefined,
                        }}
                      >
                        <option value="">Select Strap mm...</option>
                        {STRAP_MM_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt} mm</option>
                        ))}
                      </select>

                      {/* Quick Select Strap mm Pills */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        background: '#fafafa',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Sizes (mm):
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {STRAP_MM_OPTIONS.map(size => {
                            const isSelected = variantDraft.strap_mm === size
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setVariantDraft(prev => ({ ...prev, strap_mm: prev.strap_mm === size ? '' : size }))}
                                style={{
                                  fontSize: '12px',
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-full)',
                                  border: isSelected ? '1.5px solid #111827' : '1px solid #d1d5db',
                                  background: isSelected ? '#111827' : '#ffffff',
                                  color: isSelected ? '#ffffff' : '#374151',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                                }}
                              >
                                {isSelected && <span style={{ fontSize: '11px', fontWeight: 800 }}>✓</span>}
                                {size}
                              </button>
                            )
                          })}
                        </div>

                        {/* Selected Strap mm shown below sizes */}
                        {variantDraft.strap_mm && (
                          <div style={{
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#10b981',
                          }}>
                            <span>✓ {variantDraft.strap_mm} mm</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Collection & MagSafe Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {/* Collection Input */}
                  <div className="form-group" style={{ flex: '1 1 340px', maxWidth: '400px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>
                        Collection
                      </label>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Summer Collection, Anime Series, Leather Edition..."
                      value={form.collection || ''}
                      onChange={e => setForm(prev => ({ ...prev, collection: e.target.value }))}
                      style={{ background: '#ffffff', width: '100%' }}
                    />
                  </div>

                  {/* MagSafe Radio Options */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>
                        MagSafe
                      </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '38px' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="radio"
                          name="magsafe"
                          value="Yes"
                          checked={form.magsafe === true}
                          onChange={() => setForm(prev => ({ ...prev, magsafe: true }))}
                          style={{
                            cursor: 'pointer',
                            accentColor: 'var(--brand-black, #111827)',
                            width: '16px',
                            height: '16px',
                            margin: 0,
                          }}
                        />
                        <span>Yes</span>
                      </label>

                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="radio"
                          name="magsafe"
                          value="No"
                          checked={form.magsafe === false}
                          onChange={() => setForm(prev => ({ ...prev, magsafe: false }))}
                          style={{
                            cursor: 'pointer',
                            accentColor: 'var(--brand-black, #111827)',
                            width: '16px',
                            height: '16px',
                            margin: 0,
                          }}
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Product Details Section Heading */}
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 4px 0' }}>
                  Product details
                </h3>

                {/* Name, Brand Name & Description Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Variant Name"
                      value={variantDraft.name}
                      onChange={e => {
                        const val = e.target.value
                        setVariantDraft(prev => ({ ...prev, name: val }))
                        if (productId || prefillData) {
                          setForm(prev => ({ ...prev, name: val }))
                        }
                      }}
                    />
                  </div>
                  {isAccessoriesCategory && (
                    <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                      <label className="form-label">Brand Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Brand Name (e.g., Anker, Spigen)"
                        value={variantDraft.brand_name || ''}
                        onChange={e => setVariantDraft(prev => ({ ...prev, brand_name: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className="form-group" style={{ flex: '2 1 260px', marginBottom: 0 }}>
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

                {/* MRP & Selling Price Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
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
                  <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
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
                    id="add-product-variant-btn"
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
                        {(shouldShowColourVariants || isTemperedGlass) && (
                          <th style={{ padding: '12px 14px' }}>{isTemperedGlass ? 'Variant' : 'Colour Variant'}</th>
                        )}
                        {shouldShowModelSelection && (
                          <th style={{ padding: '12px 14px' }}>Model</th>
                        )}
                        {isPowerBank && (
                          <th style={{ padding: '12px 14px' }}>mah</th>
                        )}
                        {isWatchStrap && (
                          <th style={{ padding: '12px 14px' }}>Strap mm</th>
                        )}
                        <th style={{ padding: '12px 14px' }}>MRP</th>
                        <th style={{ padding: '12px 14px' }}>Selling Price</th>
                        <th style={{ padding: '12px 14px' }}>Quantity</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantsList.length === 0 ? (
                        <tr>
                          <td colSpan={5 + ((shouldShowColourVariants || isTemperedGlass) ? 1 : 0) + (shouldShowModelSelection ? 1 : 0) + (isPowerBank ? 1 : 0) + (isWatchStrap ? 1 : 0) + 1} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No product variants added yet. Add a variant above to configure products.
                          </td>
                        </tr>
                      ) : (
                        variantsList.map((variant, idx) => (
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
                              {(variant.brand_name || variant.description) && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                                  {variant.brand_name && <span><strong>Brand:</strong> {variant.brand_name}{variant.description ? ' • ' : ''}</span>}
                                  {variant.description}
                                </div>
                              )}
                            </td>
                            {(shouldShowColourVariants || isTemperedGlass) && (
                              <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#111827', fontWeight: 700, border: '1px solid #e5e7eb' }}>
                                  {variant.color || '—'}
                                </span>
                              </td>
                            )}
                            {shouldShowModelSelection && (
                              <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, border: '1px solid #bfdbfe' }} title={variant.model || ''}>
                                  {variant.model
                                    ? (variant.model.split(',').length > 2
                                      ? `${variant.model.split(',').slice(0, 2).map(s => s.trim()).join(', ')} (+${variant.model.split(',').length - 2} more)`
                                      : variant.model)
                                    : '—'}
                                </span>
                              </td>
                            )}
                            {isPowerBank && (
                              <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#ecfdf5', color: '#047857', fontWeight: 700, border: '1px solid #a7f3d0' }}>
                                  {variant.mah || '—'}
                                </span>
                              </td>
                            )}
                            {isWatchStrap && (
                              <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                                  {variant.strap_mm ? (variant.strap_mm.includes('mm') ? variant.strap_mm : `${variant.strap_mm} mm`) : '—'}
                                </span>
                              </td>
                            )}
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
