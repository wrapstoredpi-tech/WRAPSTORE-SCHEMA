const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function executeMigration() {
  console.log('=== ATTEMPTING ACCESSORIES MIGRATION EXECUTION ===')
  const sql = fs.readFileSync('./database/accessories_schema.sql', 'utf8')

  // Attempt via rpc 'exec_sql' or 'exec' if available
  const { data: rpcData, error: rpcErr } = await supabase.rpc('exec_sql', { sql_query: sql })
  if (rpcErr) {
    console.log('RPC exec_sql not available:', rpcErr.message)
  } else {
    console.log('RPC exec_sql succeeded:', rpcData)
    return
  }
}

executeMigration()
