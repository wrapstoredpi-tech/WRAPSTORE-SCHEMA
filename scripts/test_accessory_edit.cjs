const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAccessoryEdit() {
  console.log('=== TESTING ACCESSORIES EDIT FETCH FLOW ===')

  // Fetch accessories from database
  const { data: accList, error } = await supabase
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
    .limit(1)

  if (error) {
    console.error('❌ Fetch error:', error.message)
    return
  }

  if (!accList || accList.length === 0) {
    console.log('ℹ️ No accessories found in database to test edit.')
    return
  }

  const acc = accList[0]
  console.log('✅ Found Accessory for Edit:', acc.id)
  console.log('Product Name:', acc.product_name)
  console.log('Brand Name:', acc.brand_name)
  console.log('Compatibility:', acc.compatibility_type)
  console.log('Variants Count:', acc.accessory_variants?.length)
  console.log('Compatible Models:', acc.accessory_compatible_models?.map(m => m.mobile_models?.model_name))
}

testAccessoryEdit()
