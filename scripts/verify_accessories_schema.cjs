const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verify() {
  console.log('=== VERIFYING ACCESSORIES SCHEMA ===')

  // Check tables
  const tables = ['mobile_models', 'accessories', 'accessory_compatible_models', 'accessory_variants', 'accessory_variant_images']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`❌ Table '${table}' check error:`, error.message)
    } else {
      console.log(`✅ Table '${table}' exists and accessible. (Row count: ${data.length})`)
    }
  }
}

verify()
