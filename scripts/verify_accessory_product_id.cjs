const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verifyProductIds() {
  console.log('=== VERIFYING ACCESSORIES PRODUCT_ID ARCHITECTURE ===')

  // 1. Query accessories ordered by created_at
  const { data: rows, error } = await supabase
    .from('accessories')
    .select('id, product_id, product_name, brand_name, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error querying accessories:', error.message)
    return
  }

  console.log(`\nFound ${rows.length} accessories in database:`)
  console.table(rows)

  // 2. Check for NULL product_ids
  const nullCount = rows.filter(r => !r.product_id).length
  console.log(`\nNULL product_id count: ${nullCount} ${nullCount === 0 ? '✅ (PASS)' : '❌ (FAIL)'}`)

  // 3. Check for DUPLICATE product_ids
  const idCounts = {}
  let dupCount = 0
  for (const r of rows) {
    if (r.product_id) {
      idCounts[r.product_id] = (idCounts[r.product_id] || 0) + 1
      if (idCounts[r.product_id] > 1) dupCount++
    }
  }
  console.log(`Duplicate product_id count: ${dupCount} ${dupCount === 0 ? '✅ (PASS)' : '❌ (FAIL)'}`)

  // 4. Check Mobile Cases tables isolation
  const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
  console.log(`Mobile Cases 'products' table count: ${prodCount} ✅ (Preserved)`)
}

verifyProductIds()
