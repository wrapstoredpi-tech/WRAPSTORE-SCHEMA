const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://ppwpedkqlgjvdosxabtf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwd3BlZGtxbGdqdmRvc3hhYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjQwMTEsImV4cCI6MjEwNTIwMDAxMX0.eAtzdD-kwKjvfgp0zYtev4WzH6aLKmsN31VYQEB4nL0'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function migrate() {
  console.log('--- STARTING PRODUCT IMAGES MIGRATION AUDIT ---')

  // Authenticate as Super Admin to get valid session for Supabase Storage uploads
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@wrapstore.com',
    password: 'Admin@123456',
  })

  if (authErr) {
    console.warn('Auth sign in warning (proceeding as anon):', authErr.message)
  } else {
    console.log('✓ Authenticated successfully as:', authData.user.email)
  }

  const { data: rows, error } = await supabase.from('product_images').select('*')
  if (error) {
    console.error('Failed to query product_images:', error)
    return
  }

  console.log(`Total images in database: ${rows.length}`)

  let base64Count = 0
  let correctCount = 0
  let migratedCount = 0
  let failedCount = 0

  for (const row of rows) {
    const isBase64 = row.public_url && row.public_url.startsWith('data:image/')
    if (isBase64) {
      base64Count++
    } else {
      correctCount++
    }
  }

  console.log(`Base64 images detected: ${base64Count}`)
  console.log(`Correctly stored images detected: ${correctCount}`)

  for (const row of rows) {
    const isBase64 = row.public_url && row.public_url.startsWith('data:image/')
    if (!isBase64) continue

    console.log(`\nMigrating Row ID: ${row.id} for Product ID: ${row.product_id}...`)

    try {
      // 1. Parse Data URL header and Base64 content
      const matches = row.public_url.match(/^data:(image\/[a-zA-Z0-9-+.]+);base64,(.+)$/)
      if (!matches) {
        console.error(`Row ID ${row.id} has invalid base64 data URL format. Skipping.`)
        failedCount++
        continue
      }

      const mimeType = matches[1]
      const base64Data = matches[2]
      let ext = 'png'
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg'
      else if (mimeType.includes('webp')) ext = 'webp'
      else if (mimeType.includes('gif')) ext = 'gif'
      else if (mimeType.includes('png')) ext = 'png'

      const buffer = Buffer.from(base64Data, 'base64')
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const storagePath = `products/${row.product_id}/${filename}`

      // 2. Upload to Supabase Storage bucket 'product-images'
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600',
        })

      if (uploadErr) {
        console.error(`Upload error for Row ID ${row.id}:`, uploadErr)
        failedCount++
        continue
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(storagePath)

      // 4. Update Database Record
      const { error: updateErr } = await supabase
        .from('product_images')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
        })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`Database update error for Row ID ${row.id}:`, updateErr)
        failedCount++
        continue
      }

      console.log(`✓ Migrated Row ID ${row.id} successfully!`)
      console.log(`  Storage Path: ${storagePath}`)
      console.log(`  Public URL: ${publicUrl}`)
      migratedCount++
    } catch (err) {
      console.error(`Exception migrating Row ID ${row.id}:`, err)
      failedCount++
    }
  }

  // Verification audit
  const { data: verifyRows } = await supabase.from('product_images').select('*')
  let remainingBase64 = 0
  let totalInDb = verifyRows ? verifyRows.length : 0
  if (verifyRows) {
    for (const r of verifyRows) {
      if (r.public_url && r.public_url.startsWith('data:image/')) {
        remainingBase64++
      }
    }
  }

  console.log('\n================ MIGRATION REPORT ================')
  console.log(`Total Product Images in DB: ${totalInDb}`)
  console.log(`Initial Base64 Images: ${base64Count}`)
  console.log(`Already Correct Images: ${correctCount}`)
  console.log(`Successfully Migrated: ${migratedCount}`)
  console.log(`Failed Migrations: ${failedCount}`)
  console.log(`Remaining Base64 Images in DB: ${remainingBase64}`)
  console.log('==================================================')
}

migrate()
