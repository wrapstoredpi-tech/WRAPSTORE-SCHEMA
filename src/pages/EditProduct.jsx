import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import AddProduct from './AddProduct'

import { getMrp } from '../lib/productUtils'

const EditProduct = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProduct = async () => {
      // 1. Try fetching from products table (Mobile Cases)
      const { data: prodData } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('id', id)
        .maybeSingle()

      if (prodData) {
        setProduct(prodData)
        setLoading(false)
        return
      }

      // 2. Try fetching from accessories table (Accessories)
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
        .eq('id', id)
        .maybeSingle()

      if (accError || !accData) {
        toast.error('Product not found')
        navigate('/products')
        return
      }

      const models = accData.accessory_compatible_models?.map(m => m.mobile_models?.model_name).filter(Boolean) || []
      const primaryVar = accData.accessory_variants?.[0]
      const images = accData.accessory_variants?.flatMap(v => (v.accessory_variant_images || []).map(img => ({
        id: img.id,
        public_url: img.image_url,
        is_primary: img.is_primary,
      }))) || []

      const mappedAccProduct = {
        id: accData.id,
        product_id: accData.product_id || `WS-ACC-${accData.id.slice(0, 6)}`,
        name: accData.product_name,
        product_type: 'accessories',
        category_id: accData.category_id,
        subcategory_id: accData.subcategory_id,
        brand_name: accData.brand_name || '',
        mobile_brand: accData.compatibility_type ? accData.compatibility_type.charAt(0).toUpperCase() + accData.compatibility_type.slice(1) : 'Universal',
        mobile_model: models.join(', '),
        color_variants: accData.accessory_variants?.map(v => v.attributes?.color || v.variant_name).join(', ') || '',
        description: accData.description || '',
        purchase_price: '0',
        mrp: primaryVar?.mrp?.toString() || '0',
        selling_price: primaryVar?.selling_price?.toString() || '0',
        current_stock: primaryVar?.quantity?.toString() || '0',
        min_stock_level: '5',
        approval_status: 'APPROVED',
        product_images: images,
        accessory_variants: accData.accessory_variants || [],
        isAccessory: true,
      }

      setProduct(mappedAccProduct)
      setLoading(false)
    }
    fetchProduct()
  }, [id, navigate])

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        Loading product...
      </div>
    )
  }

  if (!product) return null

  // Map product fields to form format
  const prefillData = {
    id: product.id,
    name: product.name,
    product_type: product.product_type,
    category_id: product.category_id || '',
    subcategory_id: product.subcategory_id || '',
    mobile_brand: product.mobile_brand || '',
    mobile_model: product.mobile_model || '',
    color_variants: product.color_variants || '',
    collection: product.collection || '',
    description: product.description || '',
    purchase_price: product.purchase_price?.toString() || '',
    mrp: getMrp(product)?.toString() || '',
    selling_price: product.selling_price?.toString() || '',
    discount_percentage: product.discount_percentage?.toString() || '0',
    gst_percentage: product.gst_percentage != null ? product.gst_percentage.toString() : '18',
    current_stock: product.current_stock?.toString() || '0',
    initial_stock: product.current_stock?.toString() || '0',
    min_stock_level: product.min_stock_level?.toString() || '5',
    product_images: product.product_images || [],
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: '13px',
            background: '#f3f4f6',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: 700,
          }}>
            {product.product_id}
          </span>
          {product.approval_status === 'REJECTED' && (
            <div style={{ fontSize: '13px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rejected: </span>
              <em>{product.rejection_reason}</em>
            </div>
          )}
        </div>
      </div>

      <AddProduct
        prefillData={prefillData}
        productId={id}
        onSave={() => navigate('/products')}
      />
    </div>
  )
}

export default EditProduct
