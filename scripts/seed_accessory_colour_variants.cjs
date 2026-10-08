const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const TARGET_SUBCATEGORIES_DATA = [
  {
    subcatName: 'Power Bank',
    brandName: 'Lito',
    productName: 'Magnetic Wireless Power Bank',
    description: '10000mAh Ultra Thin Magnetic Power Bank',
    variants: [
      { name: 'Magnetic Wireless Power Bank - Black', color: 'Black', mrp: 4999, price: 3299, qty: 15 },
      { name: 'Magnetic Wireless Power Bank - White', color: 'White', mrp: 4999, price: 3299, qty: 12 },
      { name: 'Magnetic Wireless Power Bank - Navy Blue', color: 'Navy Blue', mrp: 4999, price: 3299, qty: 10 },
    ]
  },
  {
    subcatName: 'Watch Strap',
    brandName: 'Spigen',
    productName: 'Alpine Loop Watch Strap',
    description: 'Durable nylon weave strap for Apple & Samsung Smartwatches',
    variants: [
      { name: 'Alpine Loop Watch Strap - Orange', color: 'Orange', mrp: 1499, price: 899, qty: 25 },
      { name: 'Alpine Loop Watch Strap - Starlight', color: 'Starlight', mrp: 1499, price: 899, qty: 20 },
      { name: 'Alpine Loop Watch Strap - Black', color: 'Black', mrp: 1499, price: 899, qty: 30 },
    ]
  },
  {
    subcatName: 'Ipad Case',
    brandName: 'ESR',
    productName: 'Magnetic Smart Folio Case',
    description: 'Trifold stand magnetic protective case for iPad',
    variants: [
      { name: 'Magnetic Smart Folio Case - Black', color: 'Black', mrp: 2499, price: 1599, qty: 18 },
      { name: 'Magnetic Smart Folio Case - Denim Blue', color: 'Denim Blue', mrp: 2499, price: 1599, qty: 15 },
      { name: 'Magnetic Smart Folio Case - Lavender', color: 'Lavender', mrp: 2499, price: 1599, qty: 12 },
    ]
  },
  {
    subcatName: 'Cables',
    brandName: 'Anker',
    productName: 'Braided Type-C Fast Charging Cable',
    description: '60W PD Fast Charging Nylon Braided Cable 1m',
    variants: [
      { name: 'Braided Type-C Fast Charging Cable - Black', color: 'Black', mrp: 999, price: 599, qty: 40 },
      { name: 'Braided Type-C Fast Charging Cable - Red', color: 'Red', mrp: 999, price: 599, qty: 35 },
      { name: 'Braided Type-C Fast Charging Cable - Silver', color: 'Silver', mrp: 999, price: 599, qty: 25 },
    ]
  },
  {
    subcatName: 'Airpods Cases',
    brandName: 'Caseology',
    productName: 'Silicone Protective AirPods Case',
    description: 'Shock-resistant soft silicone case with carabiner',
    variants: [
      { name: 'Silicone Protective AirPods Case - Matte Black', color: 'Matte Black', mrp: 1199, price: 699, qty: 30 },
      { name: 'Silicone Protective AirPods Case - Midnight Blue', color: 'Midnight Blue', mrp: 1199, price: 699, qty: 20 },
      { name: 'Silicone Protective AirPods Case - Dusty Pink', color: 'Dusty Pink', mrp: 1199, price: 699, qty: 15 },
    ]
  },
  {
    subcatName: 'Wallet',
    brandName: 'Wrapstore',
    productName: 'MagSafe Leather Wallet',
    description: 'Premium vegan leather magnetic card holder wallet',
    variants: [
      { name: 'MagSafe Leather Wallet - Saddle Brown', color: 'Saddle Brown', mrp: 1799, price: 999, qty: 22 },
      { name: 'MagSafe Leather Wallet - Black', color: 'Black', mrp: 1799, price: 999, qty: 28 },
      { name: 'MagSafe Leather Wallet - Forest Green', color: 'Forest Green', mrp: 1799, price: 999, qty: 14 },
    ]
  },
  {
    subcatName: 'Watch Cases',
    brandName: 'Spigen',
    productName: 'Rugged Armor Smartwatch Case',
    description: 'Shockproof TPU protective bumper case for smartwatch',
    variants: [
      { name: 'Rugged Armor Smartwatch Case - Matte Black', color: 'Matte Black', mrp: 1299, price: 749, qty: 20 },
      { name: 'Rugged Armor Smartwatch Case - Titanium Grey', color: 'Titanium Grey', mrp: 1299, price: 749, qty: 18 },
    ]
  },
  {
    subcatName: 'Phone Stand',
    brandName: 'Baseus',
    productName: 'Aluminum Folding Desktop Phone Stand',
    description: 'Adjustable metal stand holder for phone & tablet',
    variants: [
      { name: 'Aluminum Folding Phone Stand - Silver', color: 'Silver', mrp: 1499, price: 849, qty: 25 },
      { name: 'Aluminum Folding Phone Stand - Space Grey', color: 'Space Grey', mrp: 1499, price: 849, qty: 30 },
    ]
  },
  {
    subcatName: 'Adapters',
    brandName: 'Anker',
    productName: '20W USB-C Fast Charger Adapter',
    description: 'Compact PD Fast Wall Charger Adapter',
    variants: [
      { name: '20W USB-C Fast Charger Adapter - White', color: 'White', mrp: 1599, price: 999, qty: 40 },
      { name: '20W USB-C Fast Charger Adapter - Black', color: 'Black', mrp: 1599, price: 999, qty: 35 },
    ]
  },
  {
    subcatName: 'Lens Protector',
    brandName: 'Lito',
    productName: 'Metallic Ring Camera Lens Protector',
    description: 'HD Tempered glass camera lens protection ring',
    variants: [
      { name: 'Metallic Ring Camera Lens Protector - Black', color: 'Black', mrp: 799, price: 449, qty: 50 },
      { name: 'Metallic Ring Camera Lens Protector - Silver', color: 'Silver', mrp: 799, price: 449, qty: 45 },
      { name: 'Metallic Ring Camera Lens Protector - Gold', color: 'Gold', mrp: 799, price: 449, qty: 30 },
    ]
  }
]

async function seedColourVariants() {
  console.log('=== SEEDING COLOUR VARIANTS INTO DB TABLE ===')

  // Fetch subcategories and categories
  const { data: subcats, error: subErr } = await supabase.from('subcategories').select('*')
  if (subErr) {
    console.error('Failed to fetch subcategories:', subErr)
    return
  }

  const { data: cats } = await supabase.from('categories').select('*')
  const accessCat = cats?.find(c => c.slug === 'accessories' || c.name?.toLowerCase().includes('access'))

  let count = 0

  for (const item of TARGET_SUBCATEGORIES_DATA) {
    const matchedSubcat = subcats.find(s => s.name.toLowerCase().trim() === item.subcatName.toLowerCase().trim() || s.name.toLowerCase().includes(item.subcatName.toLowerCase()))

    if (!matchedSubcat) {
      console.warn(`Subcategory '${item.subcatName}' not found in DB!`)
      continue
    }

    console.log(`Processing subcategory: ${matchedSubcat.name}...`)

    for (const v of item.variants) {
      // Check if product with this name already exists in products table
      const { data: existing } = await supabase.from('products').select('id').eq('name', v.name).maybeSingle()

      if (existing) {
        // Update existing record
        const { error: updErr } = await supabase.from('products').update({
          color_variants: v.color,
          selling_price: v.price,
          mrp: v.mrp,
          current_stock: v.qty,
          approval_status: 'APPROVED',
          is_active: true
        }).eq('id', existing.id)
        if (!updErr) {
          console.log(`  ✓ Updated DB product: ${v.name} (Color: ${v.color})`)
          count++
        }
      } else {
        // Insert new product
        const prodId = 'WS-ACC-' + Math.floor(100000 + Math.random() * 900000)
        const { error: insErr } = await supabase.from('products').insert({
          product_id: prodId,
          name: v.name,
          product_type: 'accessories',
          category_id: accessCat ? accessCat.id : null,
          subcategory_id: matchedSubcat.id,
          mobile_brand: item.brandName,
          color_variants: v.color,
          description: item.description,
          purchase_price: 0,
          selling_price: v.price,
          mrp: v.mrp,
          discount_percentage: 0,
          gst_percentage: 18,
          current_stock: v.qty,
          min_stock_level: 5,
          approval_status: 'APPROVED',
          is_active: true
        })

        if (insErr) {
          console.error(`  ❌ Failed inserting product ${v.name}:`, insErr.message)
        } else {
          console.log(`  + Inserted DB product: ${v.name} (Color: ${v.color})`)
          count++
        }
      }
    }
  }

  console.log(`\n=== SUCCESS: ${count} colour variant products synced into DB table! ===`)
}

seedColourVariants()
