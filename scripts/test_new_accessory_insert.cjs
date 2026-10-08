const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testNewInsert() {
  console.log('=== VERIFYING NEW ACCESSORY INSERTION ===')

  // Query highest product_id
  const { data: latest } = await supabase
    .from('accessories')
    .select('id, product_id, product_name, created_at')
    .order('product_id', { ascending: false })

  console.log('Current accessories in database:')
  console.table(latest)
}

testNewInsert()
