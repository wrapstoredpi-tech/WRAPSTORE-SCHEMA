const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log('--- Inspecting Categories ---')
  const { data: categories, error: catErr } = await supabase.from('categories').select('*')
  console.log('Categories:', categories, catErr ? `Error: ${catErr.message}` : '')

  console.log('\n--- Inspecting Subcategories ---')
  const { data: subcategories, error: subErr } = await supabase.from('subcategories').select('*')
  console.log('Subcategories count:', subcategories?.length, subErr ? `Error: ${subErr.message}` : '')
  if (subcategories) {
    console.log('Subcategories list:', subcategories.map(s => s.name))
  }

  console.log('\n--- Inspecting Mobile Models Table ---')
  const { data: models, error: modErr } = await supabase.from('mobile_models').select('*')
  console.log('mobile_models table exists?:', !modErr, modErr ? `Error: ${modErr.message}` : `Count: ${models?.length}`)

  console.log('\n--- Inspecting Accessories Table ---')
  const { data: acc, error: accErr } = await supabase.from('accessories').select('*')
  console.log('accessories table exists?:', !accErr, accErr ? `Error: ${accErr.message}` : `Count: ${acc?.length}`)
}

run()
