import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  PackagePlus, Plus, Search, Trash2, Check, X,
  ShoppingBag, ShieldCheck, Layers, ArrowLeft,
  Info, History, Tag, Smartphone, Sparkles, Lock, AlertTriangle,
  Image as ImageIcon, UploadCloud, Edit3, Copy, ArrowUp, ArrowDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fetchMergedCategories } from '../lib/categoryStorage'
import ProductImageHover from '../components/common/ProductImageHover'

const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const AddCombo = () => {
  const { user } = useAuth()
  const [combos, setCombos] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState(null) // null for create, object for edit
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
  // selectedItems: Array of { product, qty_per_combo }
  const [selectedItems, setSelectedItems] = useState([])
  const [savingCombo, setSavingCombo] = useState(false)

  // Dedicated Combo Representative Image State
  const [comboImages, setComboImages] = useState([]) // Array of { id, file, preview, isPrimary }
  const [uploadingComboImage, setUploadingComboImage] = useState(false)
  const comboFileInputRef = useRef(null)

  // Fetch combos using view `combos_with_availability` or fallback
  const fetchCombos = async () => {
    try {
      // 1. Try reading from view `combos_with_availability`
      const { data: viewData, error: viewErr } = await supabase
        .from('combos_with_availability')
        .select('*')
        .order('created_at', { ascending: false })

      if (!viewErr && viewData) {
        const formatted = viewData.map(c => ({
          ...c,
          id: c.id,
          code: c.combo_code || c.code || `WS-CMB-${String(c.id || '').slice(0, 4)}`,
          combo_code: c.combo_code || c.code,
          name: c.name,
          description: c.description,
          selling_price: Number(c.selling_price) || 0,
          original_value: Number(c.original_value) || 0,
          image_url: c.image_url,
          images: c.images,
          items: Array.isArray(c.items) ? c.items : (typeof c.items === 'string' ? JSON.parse(c.items) : []),
          available_combos: Number(c.available_combos) || 0,
          limiting_product_name: c.limiting_product_name || null,
          limiting_product_id: c.limiting_product_id || null,
          status: c.status || (Number(c.available_combos) > 0 ? 'in_stock' : 'out'),
          is_active: c.is_active !== false,
          created_at: c.created_at,
        }))
        setCombos(formatted)
        localStorage.setItem('wrapstore_combos_v1', JSON.stringify(formatted))
        return
      }

      // 2. Fallback if view doesn't exist yet: query combos table directly
      const { data: rawCombos, error: rawErr } = await supabase
        .from('combos')
        .select('*')
        .order('created_at', { ascending: false })

      if (!rawErr && rawCombos) {
        // Query current products to compute availability
        const { data: allProds } = await supabase.from('products').select('id, name, current_stock, reserved_stock, is_active, approval_status')
        const prodMap = new Map((allProds || []).map(p => [p.id, p]))

        const formatted = rawCombos.map(c => {
          const itemsList = Array.isArray(c.items) ? c.items : (typeof c.items === 'string' ? JSON.parse(c.items || '[]') : [])
          
          let minCombos = itemsList.length > 0 ? Infinity : 0
          let limitingName = null
          let limitingId = null

          for (const it of itemsList) {
            const p = prodMap.get(it.product_id)
            const qtyPer = Number(it.qty_per_combo || it.unit_quantity || 1) || 1
            if (!p || !p.is_active || p.approval_status !== 'APPROVED') {
              minCombos = 0
              limitingName = it.product_name || 'Unavailable item'
              limitingId = it.product_id
              break
            }
            const avail = Math.max(0, (Number(p.current_stock) || 0) - (Number(p.reserved_stock) || 0))
            const possible = Math.floor(avail / qtyPer)
            if (possible < minCombos) {
              minCombos = possible
              limitingName = p.name
              limitingId = p.id
            }
          }
          if (minCombos === Infinity) minCombos = 0

          return {
            ...c,
            id: c.id,
            code: c.combo_code || c.code || `WS-CMB-${String(c.id || '').slice(0, 4)}`,
            combo_code: c.combo_code || c.code,
            name: c.name,
            description: c.description,
            selling_price: Number(c.selling_price) || 0,
            original_value: Number(c.original_value) || 0,
            image_url: c.image_url || c.items?.[0]?.combo_image || null,
            items: itemsList,
            available_combos: minCombos,
            limiting_product_name: limitingName,
            limiting_product_id: limitingId,
            status: minCombos > 0 ? (minCombos <= 3 ? 'low' : 'in_stock') : 'out',
            is_active: c.is_active !== false,
            created_at: c.created_at,
          }
        })

        setCombos(formatted)
        localStorage.setItem('wrapstore_combos_v1', JSON.stringify(formatted))
        return
      }
    } catch (e) {
      console.warn('Exception reading combos:', e)
    }

    // Fallback: localStorage
    try {
      const stored = localStorage.getItem('wrapstore_combos_v1')
      setCombos(stored ? JSON.parse(stored) : [])
    } catch (e) {
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

  // Open modal for fresh combo creation
  const handleOpenCreateModal = () => {
    setEditingCombo(null)
    setComboName('')
    setDescription('')
    setSellingPrice('')
    setSelectedItems([])
    setProductSearch('')
    setSelectedCategory('ALL')
    setComboImages([])
    setIsModalOpen(true)
  }

  // Open modal for editing existing combo
  const handleOpenEditModal = (combo) => {
    setEditingCombo(combo)
    setComboName(combo.name || '')
    setDescription(combo.description || '')
    setSellingPrice(String(combo.selling_price || ''))
    setProductSearch('')
    setSelectedCategory('ALL')

    // Prefill images
    const existingImgs = []
    if (combo.image_url) {
      existingImgs.push({
        id: `existing-primary`,
        preview: combo.image_url,
        isPrimary: true,
      })
    }
    if (Array.isArray(combo.images)) {
      combo.images.forEach((img, idx) => {
        const url = typeof img === 'string' ? img : img.public_url
        if (url && url !== combo.image_url) {
          existingImgs.push({
            id: `existing-${idx}`,
            preview: url,
            isPrimary: false,
          })
        }
      })
    }
    setComboImages(existingImgs)

    // Prefill selectedItems with qty_per_combo
    const prefilled = (combo.items || []).map(item => {
      // Find fresh product in inventoryProducts if possible
      const fresh = inventoryProducts.find(p => p.id === item.product_id)
      return {
        product: fresh || {
          id: item.product_id,
          name: item.product_name,
          product_id: item.product_code,
          mobile_model: item.mobile_model,
          selling_price: item.unit_price,
          current_stock: 0,
          reserved_stock: 0,
        },
        qty_per_combo: Math.max(1, Number(item.qty_per_combo || item.unit_quantity || 1) || 1)
      }
    })
    setSelectedItems(prefilled)
    setIsModalOpen(true)
  }

  // Duplicate an existing combo
  const handleDuplicateCombo = (combo) => {
    setEditingCombo(null) // New combo
    setComboName(`${combo.name} (Copy)`)
    setDescription(combo.description || '')
    setSellingPrice(String(combo.selling_price || ''))
    setProductSearch('')
    setSelectedCategory('ALL')

    // Copy images
    const existingImgs = []
    if (combo.image_url) {
      existingImgs.push({
        id: `dup-primary`,
        preview: combo.image_url,
        isPrimary: true,
      })
    }
    setComboImages(existingImgs)

    // Copy items with their qty_per_combo
    const prefilled = (combo.items || []).map(item => {
      const fresh = inventoryProducts.find(p => p.id === item.product_id)
      return {
        product: fresh || {
          id: item.product_id,
          name: item.product_name,
          product_id: item.product_code,
          mobile_model: item.mobile_model,
          selling_price: item.unit_price,
          current_stock: 0,
          reserved_stock: 0,
        },
        qty_per_combo: Math.max(1, Number(item.qty_per_combo || item.unit_quantity || 1) || 1)
      }
    })
    setSelectedItems(prefilled)
    setIsModalOpen(true)
    toast.success(`Duplicating "${combo.name}". Make adjustments and click Save.`)
  }

  // Toggle active status directly
  const handleToggleActive = async (combo) => {
    const newActive = !combo.is_active
    try {
      const { error } = await supabase
        .from('combos')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', combo.id)

      if (error) {
        toast.error(`Failed to update status: ${error.message}`)
        return
      }

      setCombos(prev => prev.map(c => c.id === combo.id ? { ...c, is_active: newActive } : c))
      toast.success(`Combo "${combo.name}" is now ${newActive ? 'Active' : 'Inactive'}`)
    } catch (err) {
      toast.error('Error toggling combo status')
    }
  }

  // File selection for Combo Representative Image
  const handleSelectComboFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const validFiles = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" is not an image file`)
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 5MB size limit`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    const newObjs = validFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      preview: URL.createObjectURL(file),
      isPrimary: comboImages.length === 0 && idx === 0,
    }))

    setComboImages(prev => [...prev, ...newObjs])
    if (comboFileInputRef.current) comboFileInputRef.current.value = ''
  }

  const handleRemoveComboImage = (indexToRemove) => {
    setComboImages(prev => {
      const removed = prev[indexToRemove]
      if (removed?.preview && removed.preview.startsWith('blob:')) {
        try { URL.revokeObjectURL(removed.preview) } catch (e) {}
      }
      const next = prev.filter((_, idx) => idx !== indexToRemove)
      if (removed?.isPrimary && next.length > 0) {
        next[0].isPrimary = true
      }
      return next
    })
  }

  const handleSetPrimaryComboImage = (indexToPrimary) => {
    setComboImages(prev =>
      prev.map((img, idx) => ({
        ...img,
        isPrimary: idx === indexToPrimary,
      }))
    )
  }

  const uploadComboImages = async (comboId) => {
    const results = []
    if (!comboImages || comboImages.length === 0) return results

    for (let i = 0; i < comboImages.length; i++) {
      const img = comboImages[i]
      const isPrimary = img.isPrimary || i === 0

      if (img.file) {
        const ext = (img.file.name || 'image.png').split('.').pop()
        const storagePath = `combos/${comboId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(storagePath, img.file, {
            contentType: img.file.type || 'image/jpeg',
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadErr) {
          console.error('Combo image upload error:', uploadErr)
          toast.error(`Image upload failed: ${uploadErr.message}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath)

        results.push({
          url: publicUrl,
          public_url: publicUrl,
          storage_path: storagePath,
          is_primary: isPrimary,
          sort_order: i,
        })
      } else if (img.preview && typeof img.preview === 'string' && img.preview.startsWith('http')) {
        results.push({
          url: img.preview,
          public_url: img.preview,
          is_primary: isPrimary,
          sort_order: i,
        })
      }
    }
    return results
  }

  // Toggle product selection in modal
  const handleToggleProduct = (product) => {
    setSelectedItems(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.filter(item => item.product.id !== product.id)
      } else {
        return [...prev, { product, qty_per_combo: 1 }]
      }
    })
  }

  // Update qty_per_combo for an item
  const handleUpdateQtyPerCombo = (productId, newQty) => {
    const validQty = Math.max(1, parseInt(newQty, 10) || 1)
    setSelectedItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, qty_per_combo: validQty } : item
      )
    )
  }

  // Reorder items in modal
  const handleMoveItem = (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= selectedItems.length) return
    setSelectedItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  // Live Calculations for modal
  const stockBreakdown = useMemo(() => {
    if (selectedItems.length === 0) return { items: [], minCombos: 0, limitingId: null, totalRegular: 0 }

    let minCombos = Infinity
    let limitingId = null

    const items = selectedItems.map(item => {
      const stock = Math.max(0, Number(item.product.current_stock) || 0)
      const reserved = Math.max(0, Number(item.product.reserved_stock) || 0)
      const available = Math.max(0, stock - reserved)
      const qtyPer = Math.max(1, Number(item.qty_per_combo) || 1)
      const possibleCombos = Math.floor(available / qtyPer)

      if (possibleCombos < minCombos) {
        minCombos = possibleCombos
        limitingId = item.product.id
      }

      return {
        product: item.product,
        stock,
        reserved,
        available,
        qty_per_combo: qtyPer,
        possibleCombos,
        unitPrice: Number(item.product.selling_price) || 0,
      }
    })

    if (minCombos === Infinity) minCombos = 0

    const totalRegular = items.reduce((sum, it) => sum + (it.unitPrice * it.qty_per_combo), 0)

    return { items, minCombos, limitingId, totalRegular }
  }, [selectedItems])

  const offerPriceNum = Number(sellingPrice) || 0
  const regularPriceNum = stockBreakdown.totalRegular
  const savingsRupees = regularPriceNum > offerPriceNum ? (regularPriceNum - offerPriceNum) : 0
  const savingsPct = regularPriceNum > 0 ? Math.round((savingsRupees / regularPriceNum) * 100) : 0
  const isPriceHigherWarning = offerPriceNum > 0 && offerPriceNum >= regularPriceNum

  // Handle Save (Create or Edit)
  const handleSaveCombo = async (e) => {
    e.preventDefault()

    if (!comboName.trim()) {
      toast.error('Please enter a combo name')
      return
    }

    if (selectedItems.length < 2) {
      toast.error('A combo must contain at least 2 distinct products')
      return
    }

    // Check duplicate products
    const pIds = selectedItems.map(i => i.product.id)
    if (new Set(pIds).size !== pIds.length) {
      toast.error('Duplicate products are not allowed in the same combo')
      return
    }

    // Check inactive products
    const hasInactive = selectedItems.some(i => i.product.is_active === false)
    if (hasInactive) {
      toast.error('Cannot create combo with inactive products')
      return
    }

    if (isNaN(offerPriceNum) || offerPriceNum <= 0) {
      toast.error('Please enter a valid combo offer price')
      return
    }

    setSavingCombo(true)

    try {
      const comboId = editingCombo ? editingCombo.id : generateUUID()
      const comboCode = editingCombo ? (editingCombo.combo_code || editingCombo.code) : `WS-CMB-${Math.floor(1000 + Math.random() * 9000)}`

      // Upload custom combo images if new file provided
      let uploadedComboImages = []
      if (comboImages.length > 0) {
        setUploadingComboImage(true)
        try {
          uploadedComboImages = await uploadComboImages(comboId)
        } catch (imgErr) {
          console.warn('Combo image upload warning:', imgErr)
        } finally {
          setUploadingComboImage(false)
        }
      }

      const primaryComboImageUrl =
        uploadedComboImages.find(i => i.is_primary)?.public_url ||
        uploadedComboImages[0]?.public_url ||
        comboImages.find(i => i.isPrimary)?.preview ||
        comboImages[0]?.preview ||
        null

      const allComboImageUrls = uploadedComboImages.length > 0
        ? uploadedComboImages.map(i => i.public_url)
        : comboImages.map(i => i.preview).filter(p => typeof p === 'string' && p.startsWith('http'))

      // Snapshot for JSON items column
      const comboItemsSnapshot = selectedItems.map(i => ({
        product_id: i.product.id,
        product_name: i.product.name,
        product_code: i.product.product_id,
        mobile_model: i.product.mobile_model,
        unit_price: Number(i.product.selling_price) || 0,
        qty_per_combo: Math.max(1, Number(i.qty_per_combo) || 1),
        unit_quantity: Math.max(1, Number(i.qty_per_combo) || 1),
        quantity: Math.max(1, Number(i.qty_per_combo) || 1),
        allotted_qty: stockBreakdown.minCombos, // Backwards compatibility for older readers
        image: i.product.product_images?.find(img => img.is_primary)?.public_url || i.product.product_images?.[0]?.public_url || null,
        combo_image: primaryComboImageUrl,
        combo_images: allComboImageUrls,
      }))

      const comboPayload = {
        name: comboName.trim(),
        description: description.trim() || null,
        selling_price: offerPriceNum,
        original_value: regularPriceNum,
        items: comboItemsSnapshot,
        image_url: primaryComboImageUrl,
        images: allComboImageUrls,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      if (editingCombo) {
        // UPDATE existing combo
        const { error: updateErr } = await supabase
          .from('combos')
          .update(comboPayload)
          .eq('id', comboId)

        if (updateErr) throw new Error(updateErr.message)

        // Delete old relational items and re-insert fresh
        await supabase.from('combo_items').delete().eq('combo_id', comboId)

        const comboItemRows = selectedItems.map(i => ({
          combo_id: comboId,
          product_id: isValidUuid(i.product.id) ? i.product.id : null,
          product_name: i.product.name,
          product_code: i.product.product_id || '',
          mobile_model: i.product.mobile_model || '',
          qty_per_combo: Math.max(1, Number(i.qty_per_combo) || 1),
          allotted_qty: stockBreakdown.minCombos,
          unit_price: Number(i.product.selling_price) || 0,
        }))

        await supabase.from('combo_items').insert(comboItemRows)

        toast.success(`Combo "${comboName.trim()}" updated successfully!`)
      } else {
        // CREATE new combo
        const insertPayload = {
          id: comboId,
          combo_code: comboCode,
          code: comboCode,
          ...comboPayload,
          created_by: isValidUuid(user?.id) ? user.id : null,
          created_at: new Date().toISOString(),
        }

        let { error: insertErr } = await supabase.from('combos').insert(insertPayload)
        if (insertErr && insertErr.message?.includes('column')) {
          const stripped = { ...insertPayload }
          delete stripped.image_url
          delete stripped.images
          const retry = await supabase.from('combos').insert(stripped)
          insertErr = retry.error
        }

        if (insertErr) throw new Error(insertErr.message)

        const comboItemRows = selectedItems.map(i => ({
          combo_id: comboId,
          product_id: isValidUuid(i.product.id) ? i.product.id : null,
          product_name: i.product.name,
          product_code: i.product.product_id || '',
          mobile_model: i.product.mobile_model || '',
          qty_per_combo: Math.max(1, Number(i.qty_per_combo) || 1),
          allotted_qty: stockBreakdown.minCombos,
          unit_price: Number(i.product.selling_price) || 0,
        }))

        await supabase.from('combo_items').insert(comboItemRows)

        toast.success(`Combo "${comboName.trim()}" created successfully!`)
      }

      setIsModalOpen(false)
      await fetchCombos()
    } catch (err) {
      console.error('Error saving combo:', err)
      toast.error(err.message || 'Failed to save combo')
    } finally {
      setSavingCombo(false)
      setUploadingComboImage(false)
    }
  }

  // Safe combo deletion guard
  const handleDeleteCombo = async (combo) => {
    if (!window.confirm(`Are you sure you want to delete combo "${combo.name}" (${combo.code})?`)) {
      return
    }

    try {
      // Check if this combo has past sales in invoices or online orders
      let hasSales = false

      // 1. Check invoice_items
      const { data: invItems } = await supabase
        .from('invoice_items')
        .select('id')
        .or(`product_id_code.eq.${combo.code},product_name.eq.${combo.name}`)
        .limit(1)

      if (invItems && invItems.length > 0) hasSales = true

      // 2. Check online_order_items
      if (!hasSales) {
        const { data: onlItems } = await supabase
          .from('online_order_items')
          .select('id')
          .or(`combo_id.eq.${combo.id},product_name.ilike.%${combo.name}%`)
          .limit(1)

        if (onlItems && onlItems.length > 0) hasSales = true
      }

      if (hasSales) {
        // Deactivate instead of hard deleting to preserve historical financial records
        await supabase
          .from('combos')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', combo.id)

        setCombos(prev => prev.map(c => c.id === combo.id ? { ...c, is_active: false } : c))
        toast('This combo has past sales and cannot be deleted permanently. It has been deactivated.', {
          icon: 'ℹ️',
          duration: 5000,
        })
        return
      }

      // If never sold, hard delete permanently
      const { error: delErr } = await supabase
        .from('combos')
        .delete()
        .eq('id', combo.id)

      if (delErr) throw new Error(delErr.message)

      setCombos(prev => prev.filter(c => c.id !== combo.id))
      toast.success(`Combo "${combo.name}" permanently deleted.`)
    } catch (err) {
      console.error('Error deleting combo:', err)
      toast.error(`Delete failed: ${err.message}`)
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
    if (selectedCategory !== 'ALL') {
      const catObj = activeCategoryList.find(c => c.id === selectedCategory || c.slug === selectedCategory || c.name === selectedCategory)
      if (catObj && !isProductInCat(p, catObj)) return false
      if (!catObj && p.category_id !== selectedCategory && p.product_type !== selectedCategory) return false
    }

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
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PackagePlus size={22} color="var(--brand-black)" />
            <span>Product Combos & Bundles</span>
          </div>
          <div className="section-subtitle">
            Create and manage product combos. Stock is taken from the products when a combo is sold.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          id="create-combo-btn"
          style={{ padding: '10px 18px', fontWeight: 700 }}
        >
          <Plus size={16} /> Create a Combo
        </button>
      </div>

      {/* Target Stock Rule Informational Banner */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 'var(--radius)',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        <Info size={16} color="#2563eb" style={{ flexShrink: 0 }} />
        <div>
          <strong>Stock Rule:</strong> Stock is taken directly from the constituent products when a combo is sold. A combo has no separate stock pool.
        </div>
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
            Click <strong>"Create a Combo"</strong> to bundle products together with custom bundle pricing.
          </p>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
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

            const isAvailable = combo.available_combos > 0
            const limitingText = combo.limiting_product_name
              ? (isAvailable ? `${combo.available_combos} available, limited by ${combo.limiting_product_name}` : `Out of Stock, limited by ${combo.limiting_product_name}`)
              : (isAvailable ? `${combo.available_combos} available` : 'Out of Stock')

            return (
              <div
                key={combo.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  opacity: combo.is_active ? 1 : 0.65,
                  transition: 'opacity 0.2s ease',
                  border: combo.is_active ? '1px solid var(--border)' : '1px dashed #d1d5db',
                }}
              >
                {/* Card Header */}
                <div className="card-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      background: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}>
                      {combo.code}
                    </span>
                    {!combo.is_active && (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>
                        INACTIVE
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit, Duplicate, Active Switch, Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Active toggle button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(combo)}
                      title={combo.is_active ? 'Deactivate combo' : 'Activate combo'}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        color: combo.is_active ? '#059669' : '#9ca3af',
                      }}
                    >
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: combo.is_active ? '#ecfdf5' : '#f3f4f6',
                        border: `1px solid ${combo.is_active ? '#a7f3d0' : '#d1d5db'}`,
                      }}>
                        {combo.is_active ? 'Active' : 'Paused'}
                      </span>
                    </button>

                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleOpenEditModal(combo)}
                      title="Edit combo"
                    >
                      <Edit3 size={13} />
                    </button>

                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleDuplicateCombo(combo)}
                      title="Duplicate combo"
                    >
                      <Copy size={13} />
                    </button>

                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleDeleteCombo(combo)}
                      title="Delete combo"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px' }}>
                  {/* Dedicated Combo Representative Image Banner */}
                  {(() => {
                    const comboBanner = combo.image_url || combo.items?.[0]?.combo_image || (Array.isArray(combo.images) && (combo.images[0]?.public_url || combo.images[0])) || null
                    if (!comboBanner) return null
                    return (
                      <div style={{
                        position: 'relative',
                        height: '130px',
                        borderRadius: 'var(--radius)',
                        overflow: 'hidden',
                        background: '#f3f4f6',
                        border: '1px solid var(--border)',
                      }}>
                        <img
                          src={comboBanner}
                          alt={combo.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <span style={{
                          position: 'absolute', bottom: 6, right: 6,
                          background: 'rgba(17, 24, 39, 0.75)', color: '#ffffff',
                          backdropFilter: 'blur(4px)',
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                          borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <ImageIcon size={10} /> Website Hero Image
                        </span>
                      </div>
                    )
                  })()}

                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px' }}>{combo.name}</h4>
                    {combo.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{combo.description}</p>
                    )}
                  </div>

                  {/* Pricing Badge */}
                  <div style={{
                    background: '#f9fafb',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Combo Price</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--brand-black)' }}>
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

                  {/* Dynamic Availability Indicator */}
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: isAvailable ? (combo.available_combos <= 3 ? '#fffbeb' : '#ecfdf5') : '#fef2f2',
                    color: isAvailable ? (combo.available_combos <= 3 ? '#b45309' : '#047857') : '#b91c1c',
                    border: `1px solid ${isAvailable ? (combo.available_combos <= 3 ? '#fde68a' : '#a7f3d0') : '#fecaca'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    lineHeight: 1.3
                  }}>
                    <div style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: isAvailable ? (combo.available_combos <= 3 ? '#f59e0b' : '#10b981') : '#ef4444',
                      flexShrink: 0
                    }} />
                    <span>{limitingText}</span>
                  </div>

                  {/* Included Products */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Included Products ({combo.items?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {combo.items?.map((item, idx) => {
                        const qty = Number(item.qty_per_combo || item.unit_quantity || 1)
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              background: '#ffffff',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <ProductImageHover src={item.image} title={item.product_name} alt={item.product_name} size={24} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.product_name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {item.mobile_model || item.product_code}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', color: 'var(--brand-black)', whiteSpace: 'nowrap' }}>
                              {qty} unit{qty > 1 ? 's' : ''} / combo
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT COMBO MODAL */}
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
                <span className="modal-title">{editingCombo ? 'Edit Product Combo' : 'Create Product Combo'}</span>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Select products, set units per combo, and define offer pricing. Stock is taken when sold.
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCombo} id="combo-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* 1. Name & Description */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
                    <label className="form-label">Description (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Brief notes about this bundle"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* 2. Hero Image Upload (Optional) */}
                <div style={{
                  background: '#f9fafb',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ImageIcon size={16} color="#2563eb" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-black)' }}>
                        Combo Website Hero Image <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional — defaults to product photo tiles if empty)</span>
                      </span>
                    </div>
                    {comboImages.length > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb' }}>
                        {comboImages.length} image attached
                      </span>
                    )}
                  </div>

                  <input
                    ref={comboFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleSelectComboFiles}
                  />

                  {comboImages.length === 0 ? (
                    <div
                      onClick={() => comboFileInputRef.current?.click()}
                      style={{
                        border: '1.5px dashed #93c5fd',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px',
                        textAlign: 'center',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#2563eb',
                        fontWeight: 600,
                      }}
                    >
                      <UploadCloud size={16} /> Click to upload combo banner image
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {comboImages.map((img, idx) => (
                        <div
                          key={img.id || idx}
                          style={{
                            position: 'relative',
                            width: '80px',
                            height: '80px',
                            borderRadius: '6px',
                            border: '2px solid #2563eb',
                            overflow: 'hidden',
                          }}
                        >
                          <img src={img.preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => handleRemoveComboImage(idx)}
                            style={{
                              position: 'absolute', top: 2, right: 2,
                              background: 'rgba(0,0,0,0.6)', color: '#ffffff',
                              border: 'none', borderRadius: '50%',
                              width: '18px', height: '18px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                            }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => comboFileInputRef.current?.click()}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px' }}
                      >
                        Change Image
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Product Selection from Inventory */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Constituent Products <span className="required">*</span> (Minimum 2 products)
                    </label>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: selectedItems.length >= 2 ? '#059669' : '#dc2626' }}>
                      {selectedItems.length} selected
                    </span>
                  </div>

                  {/* Search and Category Filter */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Search products by name, SKU, or model..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        style={{ paddingLeft: 30, fontSize: '12px', width: '100%', height: '34px' }}
                      />
                    </div>
                  </div>

                  {/* Product Inventory Picker */}
                  <div style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: '#fafafa',
                    padding: '6px'
                  }}>
                    {loadingProducts ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Loading inventory...
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No inventory products match search.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                padding: '6px 10px',
                                background: isSelected ? '#ecfdf5' : '#ffffff',
                                border: `1px solid ${isSelected ? '#10b981' : 'var(--border)'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '3px',
                                  border: `1.5px solid ${isSelected ? '#10b981' : '#d1d5db'}`,
                                  background: isSelected ? '#10b981' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {isSelected && <Check size={11} color="#ffffff" strokeWidth={3} />}
                                </div>
                                <ProductImageHover src={primaryImg} title={product.name} alt={product.name} size={24} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {product.name}
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    {product.product_id} · {product.mobile_model || 'Standard'}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
                                <span style={{ fontWeight: 700 }}>{INR(product.selling_price)}</span>
                                <span style={{ fontSize: '10px', color: '#059669', marginLeft: '8px', fontWeight: 600 }}>
                                  Stock: {product.current_stock}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Selected Items List with Stepper and Reorder */}
                {selectedItems.length > 0 && (
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-black)', marginBottom: '8px' }}>
                      Selected Combo Items ({selectedItems.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedItems.map((item, idx) => (
                        <div
                          key={item.product.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#ffffff',
                            padding: '8px 10px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            gap: '10px',
                            fontSize: '12px'
                          }}
                        >
                          {/* Reorder Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(idx, -1)}
                              disabled={idx === 0}
                              style={{ background: 'transparent', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: 0, opacity: idx === 0 ? 0.3 : 1 }}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(idx, 1)}
                              disabled={idx === selectedItems.length - 1}
                              style={{ background: 'transparent', border: 'none', cursor: idx === selectedItems.length - 1 ? 'default' : 'pointer', padding: 0, opacity: idx === selectedItems.length - 1 ? 0.3 : 1 }}
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.product.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Unit price: {INR(item.product.selling_price)} · Stock: {item.product.current_stock}
                            </div>
                          </div>

                          {/* Stepper for Qty Per Combo */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qty / combo:</span>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '4px', overflow: 'hidden' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateQtyPerCombo(item.product.id, item.qty_per_combo - 1)}
                                disabled={item.qty_per_combo <= 1}
                                style={{ padding: '2px 8px', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                              >
                                -
                              </button>
                              <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>
                                {item.qty_per_combo}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQtyPerCombo(item.product.id, item.qty_per_combo + 1)}
                                style={{ padding: '2px 8px', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleToggleProduct(item.product)}
                              style={{ color: 'var(--danger)', marginLeft: '4px' }}
                              title="Remove item"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Live Pricing Section */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-black)' }}>
                    Pricing & Savings
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Combo Offer Price (₹) <span className="required">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        className="form-input"
                        placeholder="e.g. 799"
                        value={sellingPrice}
                        onChange={e => setSellingPrice(e.target.value)}
                        required
                        style={{ fontSize: '15px', fontWeight: 700 }}
                      />
                    </div>

                    <div style={{
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Live Regular Price:</span>
                        <strong style={{ textDecoration: savingsRupees > 0 ? 'line-through' : 'none' }}>
                          {INR(regularPriceNum)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Customer Savings:</span>
                        {savingsRupees > 0 ? (
                          <span style={{ fontWeight: 700, color: '#047857' }}>
                            {INR(savingsRupees)} ({savingsPct}%)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>₹0 (0%)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isPriceHigherWarning && (
                    <div style={{
                      fontSize: '11px',
                      color: '#b45309',
                      background: '#fffbeb',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={14} color="#d97706" />
                      <span>Warning: Offer price is not lower than the regular price ({INR(regularPriceNum)}).</span>
                    </div>
                  )}
                </div>

                {/* 6. Read-Only Stock Breakdown Table with Limiting Component Highlight */}
                {selectedItems.length > 0 && (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-black)' }}>
                        Live Stock & Availability Breakdown
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: stockBreakdown.minCombos > 0 ? '#ecfdf5' : '#fef2f2',
                        color: stockBreakdown.minCombos > 0 ? '#047857' : '#b91c1c',
                        border: `1px solid ${stockBreakdown.minCombos > 0 ? '#a7f3d0' : '#fecaca'}`,
                      }}>
                        {stockBreakdown.minCombos} Combos Available
                      </span>
                    </div>

                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '6px 8px' }}>Product</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Stock in Hand</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty / Combo</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Combos Allowed</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockBreakdown.items.map(it => {
                          const isLimiting = it.product.id === stockBreakdown.limitingId
                          return (
                            <tr
                              key={it.product.id}
                              style={{
                                borderBottom: '1px solid #f3f4f6',
                                background: isLimiting ? '#fffbeb' : '#ffffff',
                              }}
                            >
                              <td style={{ padding: '6px 8px', fontWeight: isLimiting ? 700 : 500 }}>
                                {it.product.name}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                {it.available}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                {it.qty_per_combo}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>
                                {it.possibleCombos}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                {isLimiting ? (
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                                    Limiting Product
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#059669' }}>OK</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

              {/* Modal Footer Actions */}
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
                  disabled={savingCombo || selectedItems.length < 2 || !sellingPrice}
                  id="save-combo-btn"
                >
                  {savingCombo ? (
                    <>
                      <div className="btn-spinner" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={15} /> {editingCombo ? 'Save Changes' : 'Create Combo'}
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