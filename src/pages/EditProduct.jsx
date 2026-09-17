import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import AddProduct from './AddProduct'

const EditProduct = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('id', id)
        .single()

      if (error) {
        toast.error('Product not found')
        navigate('/products')
        return
      }
      setProduct(data)
      setLoading(false)
    }
    fetchProduct()
  }, [id])

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
    name: product.name,
    product_type: product.product_type,
    category_id: product.category_id || '',
    subcategory_id: product.subcategory_id || '',
    mobile_brand: product.mobile_brand || '',
    mobile_model: product.mobile_model || '',
    color_variants: product.color_variants || '',
    description: product.description || '',
    purchase_price: product.purchase_price?.toString() || '',
    selling_price: product.selling_price?.toString() || '',
    discount_percentage: product.discount_percentage?.toString() || '0',
    gst_percentage: product.gst_percentage != null ? product.gst_percentage.toString() : '18',
    min_stock_level: product.min_stock_level?.toString() || '5',
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
