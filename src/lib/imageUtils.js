/**
 * Utility functions for client-side image compression and resilient Supabase storage uploads.
 */

/**
 * Compresses and resizes an image File/Blob on the client before upload.
 * Reduces 5MB-15MB phone camera images to ~200-300KB without visible quality loss.
 * Prevents network timeouts, socket drops, and "Failed to fetch" errors.
 *
 * @param {File|Blob} file - Original image file
 * @param {Object} options - Configuration options
 * @param {number} [options.maxWidth=1600] - Max width in pixels
 * @param {number} [options.maxHeight=1600] - Max height in pixels
 * @param {number} [options.quality=0.85] - JPEG quality (0 to 1)
 * @param {string} [options.mimeType='image/jpeg'] - Output MIME type
 * @returns {Promise<File|Blob>} - Compressed file/blob
 */
export async function compressImage(file, {
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85,
  mimeType = 'image/jpeg',
} = {}) {
  // If not running in a browser environment or not a Blob/File, return as-is
  if (typeof window === 'undefined' || typeof document === 'undefined') return file
  if (!file || !(file instanceof Blob)) return file

  // If not an image or is SVG, return original
  if (file.type === 'image/svg+xml' || (file.type && !file.type.startsWith('image/'))) {
    return file
  }

  // If file is already smaller than 120KB and is a standard format, skip compression
  if (file.size > 0 && file.size <= 120 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
    return file
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader()
      reader.onerror = () => {
        console.warn('[imageUtils] FileReader error, using original file')
        resolve(file)
      }

      reader.onload = (e) => {
        try {
          const img = new Image()
          img.onerror = () => {
            console.warn('[imageUtils] Image load error, using original file')
            resolve(file)
          }

          img.onload = () => {
            try {
              let { width, height } = img

              // Calculate aspect-ratio preserved dimensions
              if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height)
                width = Math.max(1, Math.round(width * ratio))
                height = Math.max(1, Math.round(height * ratio))
              }

              const canvas = document.createElement('canvas')
              canvas.width = width
              canvas.height = height

              const ctx = canvas.getContext('2d')
              if (!ctx) {
                resolve(file)
                return
              }

              // Fill white background for JPEG so transparent PNGs/WebPs don't get black backgrounds
              if (mimeType === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF'
                ctx.fillRect(0, 0, width, height)
              }

              ctx.drawImage(img, 0, 0, width, height)

              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    resolve(file)
                    return
                  }

                  // If compressed blob is somehow larger than original, return original
                  if (blob.size >= file.size && file.size < 1024 * 1024) {
                    resolve(file)
                    return
                  }

                  const originalName = file.name || 'image.jpg'
                  const lastDot = originalName.lastIndexOf('.')
                  const baseName = lastDot > 0 ? originalName.substring(0, lastDot) : originalName
                  const ext = mimeType === 'image/jpeg' ? 'jpg' : (mimeType === 'image/webp' ? 'webp' : 'png')
                  const newFileName = `${baseName}.${ext}`

                  const compressedFile = new File([blob], newFileName, {
                    type: mimeType,
                    lastModified: Date.now(),
                  })

                  resolve(compressedFile)
                },
                mimeType,
                quality
              )
            } catch (canvasErr) {
              console.warn('[imageUtils] Canvas compression failed, using original file:', canvasErr)
              resolve(file)
            }
          }

          img.src = e.target.result
        } catch (imgInitErr) {
          console.warn('[imageUtils] Image init error:', imgInitErr)
          resolve(file)
        }
      }

      reader.readAsDataURL(file)
    } catch (err) {
      console.warn('[imageUtils] compressImage error, using original file:', err)
      resolve(file)
    }
  })
}

/**
 * Uploads a file/blob to Supabase Storage with automatic retry on transient network drops or "Failed to fetch".
 *
 * @param {Object} supabaseClient - Supabase client instance
 * @param {string} bucket - Bucket name (e.g. 'product-images')
 * @param {string} path - Storage path
 * @param {File|Blob} fileOrBlob - File or blob to upload
 * @param {Object} [options={}] - Extra Supabase storage upload options
 * @param {number} [maxRetries=2] - Number of retries on network/fetch errors
 * @returns {Promise<{ data: Object|null, publicUrl: string|null, error: Object|null }>}
 */
export async function uploadToStorageWithRetry(
  supabaseClient,
  bucket,
  path,
  fileOrBlob,
  options = {},
  maxRetries = 2
) {
  if (!supabaseClient || !bucket || !path || !fileOrBlob) {
    return { data: null, publicUrl: null, error: new Error('Missing required upload arguments') }
  }

  // Refresh or verify session freshness if available
  try {
    if (supabaseClient.auth?.getSession) {
      await supabaseClient.auth.getSession()
    }
  } catch (authErr) {
    console.warn('[imageUtils] Auth session check warning:', authErr)
  }

  const uploadOptions = {
    contentType: fileOrBlob.type || 'image/jpeg',
    cacheControl: '3600',
    upsert: true, // Always upsert to avoid conflicts or lockouts on retries
    ...options,
  }

  let lastError = null

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .upload(path, fileOrBlob, uploadOptions)

      if (!error && data) {
        const { data: { publicUrl } } = supabaseClient.storage.from(bucket).getPublicUrl(path)
        return { data, publicUrl, error: null }
      }

      lastError = error
      console.warn(`[imageUtils] Storage upload attempt ${attempt}/${maxRetries + 1} error:`, error?.message)
    } catch (err) {
      lastError = err
      console.warn(`[imageUtils] Storage upload attempt ${attempt}/${maxRetries + 1} fetch exception:`, err?.message || err)
    }

    if (attempt <= maxRetries) {
      // Pause before retry: 1s, 2s
      await new Promise(r => setTimeout(r, attempt * 1000))
    }
  }

  return { data: null, publicUrl: null, error: lastError }
}
