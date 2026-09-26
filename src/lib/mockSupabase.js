// ============================================================
// WRAPSTORE MOCK SUPABASE — Demo Mode
// Simulates the full Supabase API with local in-memory data
// Supports: auth, select, insert, update, delete, storage
// ============================================================

import { v4 as uuid } from './uuid'

// ---- DEMO USER ----
const DEMO_USER = {
  id: 'demo-super-admin-001',
  email: 'admin@wrapstore.in',
  role: 'authenticated',
}

const DEMO_PROFILE = {
  id: 'demo-super-admin-001',
  email: 'admin@wrapstore.in',
  full_name: 'WrapStore Admin',
  role: 'super_admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const DEMO_SESSION = {
  user: DEMO_USER,
  access_token: 'demo-token',
  expires_at: Date.now() + 3600000,
}

// ---- INITIAL MOCK DATA ----
const now = new Date().toISOString()
const d = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString()

const CAT_CASES_ID = 'cat-001'
const CAT_STICKERS_ID = 'cat-002'
const SUB_IPHONE_ID = 'sub-001'
const SUB_SAMSUNG_ID = 'sub-002'
const SUB_INDIVIDUAL_ID = 'sub-003'
const SUB_SETS_ID = 'sub-004'

const INITIAL_STORE = {
  profiles: [DEMO_PROFILE],

  store_settings: [{
    id: 'settings-001',
    store_name: 'WRAPSTORE',
    address: 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701',
    phone: '+91 81227 47947',
    gstin: '',
    logo_url: '',
    invoice_prefix: 'WS',
    invoice_footer: 'Thank you for shopping at WrapStore!',
    currency: 'INR',
    currency_symbol: '₹',
    created_at: now,
    updated_at: now,
  }],

  categories: [
    { id: CAT_CASES_ID, name: 'Mobile Cases', slug: 'mobile-cases', description: 'Protective cases for mobile phones', sort_order: 1, is_active: true, created_at: now, updated_at: now },
    { id: 'cat-003', name: 'Accessories', slug: 'accessories', description: 'Mobile accessories and peripherals', sort_order: 2, is_active: true, created_at: now, updated_at: now },
  ],

  subcategories: [
    { id: SUB_IPHONE_ID, category_id: CAT_CASES_ID, name: 'iPhone Cases', slug: 'iphone-cases', description: 'Cases for all iPhone models', sort_order: 1, is_active: true, created_at: now, updated_at: now },
    { id: SUB_SAMSUNG_ID, category_id: CAT_CASES_ID, name: 'Samsung Premium Cases', slug: 'samsung-premium-cases', description: 'Premium cases for Samsung Galaxy phones', sort_order: 2, is_active: true, created_at: now, updated_at: now },
    { id: SUB_INDIVIDUAL_ID, category_id: CAT_STICKERS_ID, name: 'Individual Stickers', slug: 'individual-stickers', description: 'Single sticker designs', sort_order: 1, is_active: true, created_at: now, updated_at: now },
    { id: SUB_SETS_ID, category_id: CAT_STICKERS_ID, name: 'Sticker Sets', slug: 'sticker-sets', description: 'Curated sticker collections', sort_order: 2, is_active: true, created_at: now, updated_at: now },
  ],

  products: [
    {
      id: 'prod-001', product_id: 'WS-000001', name: 'iPhone 16 Pro Max Transparent Case',
      product_type: 'iphone_case', category_id: CAT_CASES_ID, subcategory_id: SUB_IPHONE_ID,
      mobile_brand: 'Apple', mobile_model: 'iPhone 16 Pro Max',
      description: 'Crystal clear transparent case with military-grade drop protection. Fits iPhone 16 Pro Max perfectly.',
      purchase_price: 120, selling_price: 299, discount_percentage: 0, gst_percentage: 18,
      current_stock: 45, min_stock_level: 10, approval_status: 'APPROVED',
      rejection_reason: null, approved_by: DEMO_USER.id, approved_at: d(5),
      created_by: DEMO_USER.id, is_active: true, created_at: d(10), updated_at: d(5),
    },
    {
      id: 'prod-002', product_id: 'WS-000002', name: 'iPhone 15 Pro Matte Black Case',
      product_type: 'iphone_case', category_id: CAT_CASES_ID, subcategory_id: SUB_IPHONE_ID,
      mobile_brand: 'Apple', mobile_model: 'iPhone 15 Pro',
      description: 'Premium matte finish with textured grip. Slim profile with full camera protection.',
      purchase_price: 150, selling_price: 349, discount_percentage: 10, gst_percentage: 18,
      current_stock: 7, min_stock_level: 10, approval_status: 'APPROVED',
      rejection_reason: null, approved_by: DEMO_USER.id, approved_at: d(4),
      created_by: DEMO_USER.id, is_active: true, created_at: d(9), updated_at: d(4),
    },
    {
      id: 'prod-003', product_id: 'WS-000003', name: 'Samsung Galaxy S24 Ultra Leather Case',
      product_type: 'samsung_case', category_id: CAT_CASES_ID, subcategory_id: SUB_SAMSUNG_ID,
      mobile_brand: 'Samsung', mobile_model: 'Samsung Galaxy S24 Ultra',
      description: 'Genuine leather finish with card holder. Supports S Pen storage.',
      purchase_price: 200, selling_price: 499, discount_percentage: 0, gst_percentage: 18,
      current_stock: 22, min_stock_level: 5, approval_status: 'APPROVED',
      rejection_reason: null, approved_by: DEMO_USER.id, approved_at: d(3),
      created_by: DEMO_USER.id, is_active: true, created_at: d(8), updated_at: d(3),
    },
    {
      id: 'prod-004', product_id: 'WS-000004', name: 'Samsung Galaxy S25 Ultra Carbon Case',
      product_type: 'samsung_case', category_id: CAT_CASES_ID, subcategory_id: SUB_SAMSUNG_ID,
      mobile_brand: 'Samsung', mobile_model: 'Samsung Galaxy S25 Ultra',
      description: 'Carbon fibre texture with shock-absorbing TPU corners.',
      purchase_price: 180, selling_price: 449, discount_percentage: 5, gst_percentage: 18,
      current_stock: 0, min_stock_level: 5, approval_status: 'APPROVED',
      rejection_reason: null, approved_by: DEMO_USER.id, approved_at: d(2),
      created_by: DEMO_USER.id, is_active: true, created_at: d(7), updated_at: d(2),
    },
    {
      id: 'prod-005', product_id: 'WS-000005', name: 'Galaxy Universe Mobile Sticker',
      product_type: 'mobile_sticker', category_id: CAT_STICKERS_ID, subcategory_id: SUB_INDIVIDUAL_ID,
      mobile_brand: '', mobile_model: '',
      description: 'High-quality vinyl sticker with galaxy theme. Universal fit, waterproof.',
      purchase_price: 30, selling_price: 99, discount_percentage: 0, gst_percentage: 18,
      current_stock: 150, min_stock_level: 20, approval_status: 'APPROVED',
      rejection_reason: null, approved_by: DEMO_USER.id, approved_at: d(1),
      created_by: DEMO_USER.id, is_active: true, created_at: d(6), updated_at: d(1),
    },
    {
      id: 'prod-006', product_id: 'WS-000006', name: 'Anime Sticker Pack — 10 Designs',
      product_type: 'mobile_sticker', category_id: CAT_STICKERS_ID, subcategory_id: SUB_SETS_ID,
      mobile_brand: '', mobile_model: '',
      description: 'Set of 10 premium anime-themed mobile stickers. Scratch-resistant coating.',
      purchase_price: 80, selling_price: 199, discount_percentage: 0, gst_percentage: 18,
      current_stock: 65, min_stock_level: 15, approval_status: 'APPROVED',
      rejection_reason: null, approved_by: DEMO_USER.id, approved_at: d(1),
      created_by: DEMO_USER.id, is_active: true, created_at: d(5), updated_at: d(1),
    },
    {
      id: 'prod-007', product_id: null, name: 'iPhone 16 Silicone Midnight Case',
      product_type: 'iphone_case', category_id: CAT_CASES_ID, subcategory_id: SUB_IPHONE_ID,
      mobile_brand: 'Apple', mobile_model: 'iPhone 16',
      description: 'Soft-touch silicone with MagSafe compatibility.',
      purchase_price: 130, selling_price: 319, discount_percentage: 0, gst_percentage: 18,
      current_stock: 0, min_stock_level: 8, approval_status: 'PENDING_APPROVAL',
      rejection_reason: null, approved_by: null, approved_at: null,
      created_by: DEMO_USER.id, is_active: true, created_at: d(1), updated_at: d(1),
    },
    {
      id: 'prod-008', product_id: null, name: 'Samsung S23 Rugged Armor Case',
      product_type: 'samsung_case', category_id: CAT_CASES_ID, subcategory_id: SUB_SAMSUNG_ID,
      mobile_brand: 'Samsung', mobile_model: 'Samsung Galaxy S23 Ultra',
      description: 'Triple-layer protection with built-in kickstand.',
      purchase_price: 160, selling_price: 389, discount_percentage: 0, gst_percentage: 18,
      current_stock: 0, min_stock_level: 5, approval_status: 'REJECTED',
      rejection_reason: 'Selling price too high for this category. Please revise to under ₹350.',
      approved_by: DEMO_USER.id, approved_at: d(1),
      created_by: DEMO_USER.id, is_active: true, created_at: d(3), updated_at: d(1),
    },
  ],

  product_images: [],

  inventory_movements: [
    { id: 'mov-001', product_id: 'prod-001', movement_type: 'INITIAL_STOCK', quantity: 50, previous_stock: 0, new_stock: 50, reason: 'Initial stock on product creation', performed_by: DEMO_USER.id, reference_id: null, created_at: d(10) },
    { id: 'mov-002', product_id: 'prod-001', movement_type: 'SALE', quantity: 5, previous_stock: 50, new_stock: 45, reason: 'Store sale', performed_by: DEMO_USER.id, reference_id: null, created_at: d(3) },
    { id: 'mov-003', product_id: 'prod-002', movement_type: 'INITIAL_STOCK', quantity: 30, previous_stock: 0, new_stock: 30, reason: 'Initial stock on product creation', performed_by: DEMO_USER.id, reference_id: null, created_at: d(9) },
    { id: 'mov-004', product_id: 'prod-002', movement_type: 'SALE', quantity: 20, previous_stock: 30, new_stock: 10, reason: 'Store sale', performed_by: DEMO_USER.id, reference_id: null, created_at: d(2) },
    { id: 'mov-005', product_id: 'prod-002', movement_type: 'DAMAGED', quantity: 3, previous_stock: 10, new_stock: 7, reason: 'Display units damaged', performed_by: DEMO_USER.id, reference_id: null, created_at: d(1) },
    { id: 'mov-006', product_id: 'prod-003', movement_type: 'INITIAL_STOCK', quantity: 25, previous_stock: 0, new_stock: 25, reason: 'Initial stock on product creation', performed_by: DEMO_USER.id, reference_id: null, created_at: d(8) },
    { id: 'mov-007', product_id: 'prod-003', movement_type: 'SALE', quantity: 3, previous_stock: 25, new_stock: 22, reason: 'Store sale', performed_by: DEMO_USER.id, reference_id: null, created_at: d(1) },
    { id: 'mov-008', product_id: 'prod-004', movement_type: 'INITIAL_STOCK', quantity: 20, previous_stock: 0, new_stock: 20, reason: 'Initial stock on product creation', performed_by: DEMO_USER.id, reference_id: null, created_at: d(7) },
    { id: 'mov-009', product_id: 'prod-004', movement_type: 'SALE', quantity: 20, previous_stock: 20, new_stock: 0, reason: 'Store sale', performed_by: DEMO_USER.id, reference_id: null, created_at: d(1) },
    { id: 'mov-010', product_id: 'prod-005', movement_type: 'INITIAL_STOCK', quantity: 200, previous_stock: 0, new_stock: 200, reason: 'Initial stock on product creation', performed_by: DEMO_USER.id, reference_id: null, created_at: d(6) },
    { id: 'mov-011', product_id: 'prod-005', movement_type: 'SALE', quantity: 50, previous_stock: 200, new_stock: 150, reason: 'Store sale', performed_by: DEMO_USER.id, reference_id: null, created_at: d(2) },
    { id: 'mov-012', product_id: 'prod-006', movement_type: 'INITIAL_STOCK', quantity: 65, previous_stock: 0, new_stock: 65, reason: 'Initial stock on product creation', performed_by: DEMO_USER.id, reference_id: null, created_at: d(5) },
  ],

  // ---- STAGE 2 ----
  customers: [
    { id: 'cust-001', name: 'Rajan Kumar', phone: '+91 98765 43210', email: '', address: '', gstin: '', total_orders: 2, total_spent: 748, last_purchase_at: d(3), created_at: d(10), updated_at: d(3) },
    { id: 'cust-002', name: 'Priya Sharma', phone: '+91 87654 32109', email: '', address: '', gstin: '', total_orders: 1, total_spent: 499, last_purchase_at: d(5), created_at: d(5), updated_at: d(5) },
    { id: 'cust-003', name: 'Arun Selvam', phone: '+91 76543 21098', email: '', address: '', gstin: '', total_orders: 1, total_spent: 199, last_purchase_at: d(7), created_at: d(7), updated_at: d(7) },
  ],

  invoices: [
    { id: 'inv-001', invoice_number: 'WS-INV-000001', customer_id: 'cust-001', customer_name: 'Rajan Kumar', customer_phone: '+91 98765 43210', subtotal: 299, discount_amount: 0, taxable_amount: 299, gst_amount: 53.82, grand_total: 299, payment_method: 'UPI', payment_status: 'PAID', notes: '', pdf_url: '', whatsapp_status: 'SENT', whatsapp_sent_at: d(10), whatsapp_error: null, whatsapp_message_id: 'wamid.demo.001', created_by: DEMO_USER.id, created_at: d(10), updated_at: d(10) },
    { id: 'inv-002', invoice_number: 'WS-INV-000002', customer_id: 'cust-002', customer_name: 'Priya Sharma', customer_phone: '+91 87654 32109', subtotal: 499, discount_amount: 0, taxable_amount: 499, gst_amount: 89.82, grand_total: 499, payment_method: 'Cash', payment_status: 'PAID', notes: '', pdf_url: '', whatsapp_status: 'SENT', whatsapp_sent_at: d(5), whatsapp_error: null, whatsapp_message_id: 'wamid.demo.002', created_by: DEMO_USER.id, created_at: d(5), updated_at: d(5) },
    { id: 'inv-003', invoice_number: 'WS-INV-000003', customer_id: 'cust-003', customer_name: 'Arun Selvam', customer_phone: '+91 76543 21098', subtotal: 199, discount_amount: 0, taxable_amount: 199, gst_amount: 23.88, grand_total: 199, payment_method: 'Cash', payment_status: 'PAID', notes: '', pdf_url: '', whatsapp_status: 'FAILED', whatsapp_sent_at: null, whatsapp_error: 'Unable to deliver message: recipient phone unreachable', whatsapp_message_id: null, created_by: DEMO_USER.id, created_at: d(7), updated_at: d(7) },
    { id: 'inv-004', invoice_number: 'WS-INV-000004', customer_id: 'cust-001', customer_name: 'Rajan Kumar', customer_phone: '+91 98765 43210', subtotal: 449, discount_amount: 0, taxable_amount: 449, gst_amount: 80.82, grand_total: 449, payment_method: 'Card', payment_status: 'PAID', notes: '', pdf_url: '', whatsapp_status: 'SENT', whatsapp_sent_at: d(3), whatsapp_error: null, whatsapp_message_id: 'wamid.demo.004', created_by: DEMO_USER.id, created_at: d(3), updated_at: d(3) },
  ],

  whatsapp_logs: [
    { id: 'wlog-001', invoice_id: 'inv-001', recipient_phone: '919876543210', message_body: 'Invoice WS-INV-000001', status: 'SENT', created_at: d(10) },
    { id: 'wlog-002', invoice_id: 'inv-002', recipient_phone: '918765432109', message_body: 'Invoice WS-INV-000002', status: 'SENT', created_at: d(5) },
    { id: 'wlog-003', invoice_id: 'inv-003', recipient_phone: '917654321098', message_body: 'Invoice WS-INV-000003', status: 'FAILED', error_message: 'Unable to deliver message: recipient phone unreachable', created_at: d(7) },
    { id: 'wlog-004', invoice_id: 'inv-004', recipient_phone: '919876543210', message_body: 'Invoice WS-INV-000004', status: 'SENT', created_at: d(3) },
  ],

  invoice_items: [
    { id: 'ii-001', invoice_id: 'inv-001', product_id: 'prod-001', product_id_code: 'WS-000001', product_name: 'iPhone 16 Pro Max Transparent Case', product_type: 'iphone_case', mobile_brand: 'Apple', mobile_model: 'iPhone 16 Pro Max', quantity: 1, unit_price: 299, discount_pct: 0, gst_pct: 18, line_total: 299, created_at: d(10) },
    { id: 'ii-002', invoice_id: 'inv-002', product_id: 'prod-003', product_id_code: 'WS-000003', product_name: 'Samsung Galaxy S24 Ultra Leather Case', product_type: 'samsung_case', mobile_brand: 'Samsung', mobile_model: 'Samsung Galaxy S24 Ultra', quantity: 1, unit_price: 499, discount_pct: 0, gst_pct: 18, line_total: 499, created_at: d(5) },
    { id: 'ii-003', invoice_id: 'inv-003', product_id: 'prod-006', product_id_code: 'WS-000006', product_name: 'Anime Sticker Pack — 10 Designs', product_type: 'mobile_sticker', mobile_brand: '', mobile_model: '', quantity: 1, unit_price: 199, discount_pct: 0, gst_pct: 12, line_total: 199, created_at: d(7) },
    { id: 'ii-004', invoice_id: 'inv-004', product_id: 'prod-004', product_id_code: 'WS-000004', product_name: 'Samsung Galaxy S25 Ultra Carbon Case', product_type: 'samsung_case', mobile_brand: 'Samsung', mobile_model: 'Samsung Galaxy S25 Ultra', quantity: 1, unit_price: 449, discount_pct: 5, gst_pct: 18, line_total: 449, created_at: d(3) },
  ],

  payments: [
    { id: 'pay-001', invoice_id: 'inv-001', amount: 299, payment_method: 'UPI', reference: 'UPI-2345678', created_at: d(10) },
    { id: 'pay-002', invoice_id: 'inv-002', amount: 499, payment_method: 'Cash', reference: '', created_at: d(5) },
    { id: 'pay-003', invoice_id: 'inv-003', amount: 199, payment_method: 'Cash', reference: '', created_at: d(7) },
    { id: 'pay-004', invoice_id: 'inv-004', amount: 449, payment_method: 'Card', reference: 'CARD-9876', created_at: d(3) },
  ],
}

const STORAGE_KEY = 'wrapstore_mock_db_v2'
const loadMockDB = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.warn('Error loading mockDB', e)
  }
  return JSON.parse(JSON.stringify(INITIAL_STORE))
}

let mockDB = loadMockDB()

const saveMockDB = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockDB))
  } catch (e) {
    console.warn('Error saving mockDB', e)
  }
}

let productIdCounter = (mockDB.products?.length || 0) + 10
let invoiceIdCounter = (mockDB.invoices?.length || 0) + 10

// ---- HELPER: generate product ID ----
const generateProductId = () => {
  const id = 'WS-' + String(productIdCounter).padStart(6, '0')
  productIdCounter++
  return id
}

// ---- HELPER: generate invoice number ----
const generateInvoiceNumber = () => {
  const settings = mockDB.store_settings[0]
  const prefix = settings?.invoice_prefix || 'WS'
  const id = prefix + '-INV-' + String(invoiceIdCounter).padStart(6, '0')
  invoiceIdCounter++
  return id
}

// ---- QUERY BUILDER ----
class QueryBuilder {
  constructor(table) {
    this._table = table
    this._filters = []
    this._order = null
    this._range = null
    this._limit = null
    this._single = false
    this._count = false
    this._data = null
    this._operation = 'select'
    this._selectCols = '*'
    this._relations = {}
    this._orFilter = null
  }

  select(cols = '*', opts = {}) {
    this._selectCols = cols
    if (opts.count === 'exact') this._count = true
    return this
  }

  eq(col, val) { this._filters.push({ type: 'eq', col, val }); return this }
  neq(col, val) { this._filters.push({ type: 'neq', col, val }); return this }
  gt(col, val) { this._filters.push({ type: 'gt', col, val }); return this }
  gte(col, val) { this._filters.push({ type: 'gte', col, val }); return this }
  lt(col, val) { this._filters.push({ type: 'lt', col, val }); return this }
  lte(col, val) { this._filters.push({ type: 'lte', col, val }); return this }
  is(col, val) { this._filters.push({ type: 'eq', col, val }); return this }

  or(filterStr) { this._orFilter = filterStr; return this }

  ilike(col, pattern) {
    this._filters.push({ type: 'ilike', col, val: pattern })
    return this
  }

  in(col, values) {
    this._filters.push({ type: 'in', col, val: values })
    return this
  }

  order(col, opts = {}) {
    this._order = { col, ascending: opts.ascending !== false }
    return this
  }

  range(from, to) { this._range = { from, to }; return this }
  limit(n) { this._limit = n; return this }
  single() { this._single = true; return this }

  insert(payload) {
    this._operation = 'insert'
    this._data = Array.isArray(payload) ? payload : [payload]
    return this
  }

  update(payload) {
    this._operation = 'update'
    this._data = payload
    return this
  }

  delete() {
    this._operation = 'delete'
    return this
  }

  upsert(payload) {
    this._operation = 'insert'
    this._data = Array.isArray(payload) ? payload : [payload]
    return this
  }

  _applyFilters(rows) {
    let result = [...rows]

    for (const f of this._filters) {
      result = result.filter(row => {
        const v = row[f.col]
        switch (f.type) {
          case 'eq': return v === f.val
          case 'neq': return v !== f.val
          case 'gt': return v > f.val
          case 'gte': return v >= f.val
          case 'lt': return v < f.val
          case 'lte': return v <= f.val
          case 'ilike': {
            const pattern = f.val.replace(/%/g, '.*').toLowerCase()
            return new RegExp(pattern).test(String(v || '').toLowerCase())
          }
          case 'in': return f.val.includes(v)
          default: return true
        }
      })
    }

    // OR filter parsing (basic support for the patterns we use)
    if (this._orFilter) {
      const parts = this._orFilter.split(',').map(p => p.trim())
      result = result.filter(row => {
        return parts.some(part => {
          // match: col.ilike.%val%
          const ilikeMatch = part.match(/^(\w+)\.ilike\.%(.+)%$/)
          if (ilikeMatch) {
            const [, col, val] = ilikeMatch
            return String(row[col] || '').toLowerCase().includes(val.toLowerCase())
          }
          // match: col.eq.val
          const eqMatch = part.match(/^(\w+)\.eq\.(.+)$/)
          if (eqMatch) {
            const [, col, val] = eqMatch
            return String(row[col]) === val
          }
          return false
        })
      })
    }

    return result
  }

  _joinRelations(rows) {
    // Auto-join based on select string patterns
    const sel = this._selectCols

    return rows.map(row => {
      const enriched = { ...row }

      if (sel.includes('categories(') && row.category_id) {
        enriched.categories = mockDB.categories.find(c => c.id === row.category_id) || null
      }
      if (sel.includes('subcategories(') && row.subcategory_id) {
        enriched.subcategories = mockDB.subcategories.find(s => s.id === row.subcategory_id) || null
      }
      if (sel.includes('product_images(') && row.id) {
        enriched.product_images = mockDB.product_images.filter(i => i.product_id === row.id)
      }
      if (sel.includes('subcategories(') && !row.subcategory_id) {
        enriched.subcategories = mockDB.subcategories.filter(s => s.category_id === row.id)
      }
      // profiles join for inventory_movements
      if (sel.includes('profiles(') && row.performed_by) {
        enriched.profiles = mockDB.profiles.find(p => p.id === row.performed_by) || null
      }
      // products join for inventory_movements
      if (sel.includes('products(') && row.product_id) {
        enriched.products = mockDB.products.find(p => p.id === row.product_id) || null
      }
      // profiles!products_created_by_fkey
      if (sel.includes('profiles!products_created_by_fkey') && row.created_by) {
        enriched.profiles = mockDB.profiles.find(p => p.id === row.created_by) || null
      }
      // subcategories join in categories
      if (this._table === 'categories' && sel.includes('subcategories(')) {
        enriched.subcategories = mockDB.subcategories.filter(s => s.category_id === row.id)
      }
      // customers join for invoices
      if (sel.includes('customers(') && row.customer_id) {
        enriched.customers = mockDB.customers.find(c => c.id === row.customer_id) || null
      }
      // invoice_items join for invoices
      if (sel.includes('invoice_items(') && row.id && this._table === 'invoices') {
        enriched.invoice_items = mockDB.invoice_items.filter(ii => ii.invoice_id === row.id)
      }
      // invoices join for customers (or invoice_items reverse)
      if (sel.includes('invoices(')) {
        if (this._table === 'customers') {
          enriched.invoices = mockDB.invoices.filter(inv => inv.customer_id === row.id || (inv.customer_phone && inv.customer_phone.trim() === row.phone?.trim()))
        } else if (row.invoice_id) {
          enriched.invoices = mockDB.invoices.find(inv => inv.id === row.invoice_id) || null
        }
      }
      // profiles join for invoices (created_by)
      if (sel.includes('profiles(') && row.created_by && this._table === 'invoices') {
        enriched.profiles = mockDB.profiles.find(p => p.id === row.created_by) || null
      }

      return enriched
    })
  }

  async then(resolve, reject) {
    try {
      const result = await this._execute()
      resolve(result)
    } catch (e) {
      reject(e)
    }
  }

  async _execute() {
    await new Promise(r => setTimeout(r, 80)) // simulate network delay

    if (!mockDB[this._table]) mockDB[this._table] = []
    const table = mockDB[this._table]

    if (this._operation === 'select') {
      let rows = this._applyFilters(table)
      rows = this._joinRelations(rows)

      if (this._order) {
        rows.sort((a, b) => {
          const av = a[this._order.col]
          const bv = b[this._order.col]
          if (av == null) return 1
          if (bv == null) return -1
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return this._order.ascending ? cmp : -cmp
        })
      }

      const count = this._count ? rows.length : undefined
      if (this._range) rows = rows.slice(this._range.from, this._range.to + 1)
      if (this._limit) rows = rows.slice(0, this._limit)

      if (this._single) {
        return rows.length > 0
          ? { data: rows[0], error: null, count }
          : { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count }
      }

      return { data: rows, error: null, count }
    }

    if (this._operation === 'insert') {
      const inserted = []
      for (const item of this._data) {
        const newRow = {
          id: uuid(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        }

        // Auto-generate product ID for products table
        if (this._table === 'products' && !newRow.product_id) {
          newRow.product_id = generateProductId()
        }
        // Auto-generate invoice number for invoices table
        if (this._table === 'invoices') {
          if (!newRow.invoice_number) newRow.invoice_number = generateInvoiceNumber()
          if (!newRow.whatsapp_status) newRow.whatsapp_status = 'PENDING'
        }

        // Check unique constraints (slug, product_id)
        if (this._table === 'categories' && table.find(r => r.slug === newRow.slug)) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint (slug)' } }
        }
        if (this._table === 'subcategories') {
          const existing = table.find(r => r.category_id === newRow.category_id && r.slug === newRow.slug)
          if (existing) return { data: null, error: { message: 'duplicate key value violates unique constraint (category_id, slug)' } }
        }

        mockDB[this._table].push(newRow)
        inserted.push(newRow)
      }

      saveMockDB()
      if (this._single) return { data: inserted[0], error: null }
      return { data: inserted, error: null }
    }

    if (this._operation === 'update') {
      const toUpdate = this._applyFilters(table)
      const updated = []
      for (const row of toUpdate) {
        Object.assign(row, this._data, { updated_at: new Date().toISOString() })
        updated.push(row)
      }
      saveMockDB()
      if (this._single) return { data: updated[0] || null, error: null }
      return { data: updated, error: null }
    }

    if (this._operation === 'delete') {
      const toDelete = this._applyFilters(table)
      const ids = new Set(toDelete.map(r => r.id))
      mockDB[this._table] = table.filter(r => !ids.has(r.id))
      saveMockDB()
      return { data: toDelete, error: null }
    }

    return { data: null, error: { message: 'Unknown operation' } }
  }
}

// ---- MOCK STORAGE ----
const mockStorage = {
  from: (bucket) => ({
    upload: async (path, file) => {
      // Simulate upload — just store the object URL
      return { data: { path }, error: null }
    },
    getPublicUrl: (path) => {
      // Return a placeholder image URL
      return {
        data: {
          publicUrl: `https://placehold.co/400x400/111827/ffffff?text=Product`,
        }
      }
    },
    remove: async (paths) => ({ data: paths, error: null }),
  })
}

// ---- MOCK AUTH ----
let _authSession = DEMO_SESSION
let _authListeners = []

const mockAuth = {
  getSession: async () => ({ data: { session: _authSession }, error: null }),

  signInWithPassword: async ({ email, password }) => {
    if (!email || !password) {
      return { data: null, error: { message: 'Email and password are required' } }
    }
    // Accept any credentials in demo mode
    _authSession = DEMO_SESSION
    _authListeners.forEach(cb => cb('SIGNED_IN', DEMO_SESSION))
    return { data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }
  },

  signOut: async () => {
    _authSession = null
    _authListeners.forEach(cb => cb('SIGNED_OUT', null))
    return { error: null }
  },

  onAuthStateChange: (callback) => {
    _authListeners.push(callback)
    // Immediately fire if session exists
    if (_authSession) {
      setTimeout(() => callback('SIGNED_IN', _authSession), 0)
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            _authListeners = _authListeners.filter(cb => cb !== callback)
          }
        }
      }
    }
  },
}

// ---- MOCK REALTIME ----
const mockChannel = (name) => ({
  on: () => mockChannel(name),
  subscribe: () => {},
})

// ---- MOCK FUNCTIONS (Edge Functions) ----
const mockFunctions = {
  invoke: async (functionName, { body } = {}) => {
    if (functionName === 'send-whatsapp-invoice') {
      await new Promise(r => setTimeout(r, 450)) // simulate WhatsApp delivery delay
      const { invoice_id, recipient_phone, invoice_number, grand_total, pdf_url, customer_id } = body || {}

      // Find invoice in mockDB
      const inv = mockDB.invoices.find(i => i.id === invoice_id)
      const now = new Date().toISOString()

      // Allow testing failure if phone contains '0000' or is empty
      const isFailure = recipient_phone && recipient_phone.includes('0000')

      if (isFailure) {
        if (inv) {
          inv.whatsapp_status = 'FAILED'
          inv.whatsapp_error = 'Recipient phone unreachable or invalid'
          inv.whatsapp_sent_at = null
        }
        mockDB.whatsapp_logs.push({
          id: uuid(),
          invoice_id,
          customer_id: customer_id || null,
          recipient_phone: recipient_phone || '',
          status: 'FAILED',
          error_message: 'Recipient phone unreachable or invalid',
          pdf_url: pdf_url || null,
          created_at: now,
        })
        return { data: null, error: { message: 'Failed to send WhatsApp message' } }
      }

      if (inv) {
        inv.whatsapp_status = 'SENT'
        inv.whatsapp_sent_at = now
        inv.whatsapp_error = null
        inv.whatsapp_message_id = `wamid.demo.${Date.now()}`
      }

      mockDB.whatsapp_logs.push({
        id: uuid(),
        invoice_id,
        customer_id: customer_id || null,
        recipient_phone: recipient_phone || '',
        status: 'SENT',
        pdf_url: pdf_url || null,
        created_at: now,
      })

      return {
        data: {
          success: true,
          status: 'SENT',
          messageId: `wamid.demo.${Date.now()}`,
        },
        error: null,
      }
    }

    return { data: null, error: { message: `Function ${functionName} not found` } }
  }
}

// ---- MOCK SUPABASE CLIENT ----
export const mockSupabase = {
  auth: mockAuth,
  storage: mockStorage,
  functions: mockFunctions,
  from: (table) => new QueryBuilder(table),
  channel: (name) => mockChannel(name),
  removeChannel: () => {},
}

export default mockSupabase
