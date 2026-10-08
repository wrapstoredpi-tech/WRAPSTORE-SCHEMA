const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAccessoryCreation() {
  console.log('=== TESTING ACCESSORIES CREATION FLOW ===')

  // 1. Fetch Accessories Category & Tempered Glass Subcategory
  const { data: catData } = await supabase.from('categories').select('id').eq('name', 'Accessories').single()
  const { data: subcatData } = await supabase.from('subcategories').select('id').eq('name', 'Tempered Glass').single()

  if (!catData || !subcatData) {
    console.error('❌ Could not fetch category/subcategory')
    return
  }

  console.log(`Category ID: ${catData.id}, Subcategory ID: ${subcatData.id}`)

  // Count rows before test
  const { count: productsCountBefore } = await supabase.from('products').select('*', { count: 'exact', head: true })
  const { count: accCountBefore } = await supabase.from('accessories').select('*', { count: 'exact', head: true })
  const { count: modelsCountBefore } = await supabase.from('accessory_compatible_models').select('*', { count: 'exact', head: true })
  const { count: varsCountBefore } = await supabase.from('accessory_variants').select('*', { count: 'exact', head: true })

  console.log('--- Initial Row Counts ---')
  console.log(`products: ${productsCountBefore}`)
  console.log(`accessories: ${accCountBefore}`)
  console.log(`accessory_compatible_models: ${modelsCountBefore}`)
  console.log(`accessory_variants: ${varsCountBefore}`)

  // 2. Insert test parent accessory into `accessories`
  const { data: acc, error: accErr } = await supabase
    .from('accessories')
    .insert({
      category_id: catData.id,
      subcategory_id: subcatData.id,
      brand_name: 'ESR',
      product_name: 'ESR 3D Curved Tempered Glass',
      description: 'Ultra tough 9H tempered glass screen protector',
      compatibility_type: 'apple',
      is_active: true,
    })
    .select()
    .single()

  if (accErr) {
    console.error('❌ Error inserting into accessories:', accErr.message)
    return
  }
  console.log('✅ Created parent accessory:', acc.id)

  // 3. Map selected models in `accessory_compatible_models`
  const testModels = ['iPhone 18 Pro Max', 'iPhone 18 Pro']
  const { data: dbModels } = await supabase.from('mobile_models').select('id, model_name').in('model_name', testModels)

  if (dbModels && dbModels.length > 0) {
    const compRows = dbModels.map(m => ({ accessory_id: acc.id, model_id: m.id }))
    const { error: compErr } = await supabase.from('accessory_compatible_models').insert(compRows)
    if (compErr) console.error('❌ Error inserting compatible models:', compErr.message)
    else console.log(`✅ Linked ${compRows.length} compatible models`)
  }

  // 4. Insert test variant into `accessory_variants`
  const { data: variant, error: varErr } = await supabase
    .from('accessory_variants')
    .insert({
      accessory_id: acc.id,
      sku: `ESR-TG-${Date.now()}`,
      variant_name: 'Border - 360 Degree Privacy',
      description: 'Privacy tint with border protection',
      attributes: { border: 'Border', privacy: '360 Degree Privacy' },
      mrp: 999.00,
      selling_price: 499.00,
      quantity: 50,
      is_active: true,
    })
    .select()
    .single()

  if (varErr) console.error('❌ Error inserting variant:', varErr.message)
  else console.log('✅ Created accessory variant:', variant.id)

  // Count rows after test
  const { count: productsCountAfter } = await supabase.from('products').select('*', { count: 'exact', head: true })
  const { count: accCountAfter } = await supabase.from('accessories').select('*', { count: 'exact', head: true })
  const { count: modelsCountAfter } = await supabase.from('accessory_compatible_models').select('*', { count: 'exact', head: true })
  const { count: varsCountAfter } = await supabase.from('accessory_variants').select('*', { count: 'exact', head: true })

  console.log('\n--- Final Verification Row Counts ---')
  console.log(`products count changed?: ${productsCountBefore} -> ${productsCountAfter} (Difference: ${productsCountAfter - productsCountBefore})`)
  console.log(`accessories count changed?: ${accCountBefore} -> ${accCountAfter} (Difference: ${accCountAfter - accCountBefore})`)
  console.log(`accessory_compatible_models count: ${modelsCountBefore} -> ${modelsCountAfter}`)
  console.log(`accessory_variants count: ${varsCountBefore} -> ${varsCountAfter}`)

  if (productsCountAfter === productsCountBefore) {
    console.log('\n🎉 SUCCESS: Legacy products table was NOT modified!')
  } else {
    console.error('\n❌ FAIL: Legacy products table was modified!')
  }
}

testAccessoryCreation()
