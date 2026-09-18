import { supabase } from './supabase'

export const isValidUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

export const generateUuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const getLocalCats = () => {
  try {
    const stored = localStorage.getItem('wrapstore_custom_categories_v1')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const saveLocalCats = (cats) => {
  localStorage.setItem('wrapstore_custom_categories_v1', JSON.stringify(cats))
}

export const clearDeletedCategoryKeys = () => {
  localStorage.removeItem('wrapstore_deleted_category_keys_v1')
  localStorage.removeItem('wrapstore_deleted_subcategory_keys_v1')
}

export const fetchMergedCategories = async () => {
  let dbCats = []
  let dbError = null

  try {
    const { data, error } = await supabase
      .from('categories')
      .select(`*, subcategories(*)`)
      .order('sort_order', { ascending: true })
    if (error) {
      dbError = error
    } else {
      dbCats = data || []
    }
  } catch (err) {
    dbError = err
    console.warn('Could not fetch categories from Supabase DB:', err)
  }

  const localCats = getLocalCats()

  // Merge DB categories and local categories cleanly
  const merged = [...dbCats]
  for (const lc of localCats) {
    const existingIdx = merged.findIndex(
      c => c.id === lc.id || (c.name && lc.name && c.name.toLowerCase() === lc.name.toLowerCase())
    )
    if (existingIdx === -1) {
      merged.push(lc)
    } else {
      const dbSubs = merged[existingIdx].subcategories || []
      const localSubs = lc.subcategories || []
      const mergedSubs = [...dbSubs]
      for (const ls of localSubs) {
        if (!mergedSubs.some(s => s.id === ls.id || (s.name && ls.name && s.name.toLowerCase() === ls.name.toLowerCase()))) {
          mergedSubs.push(ls)
        }
      }
      merged[existingIdx].subcategories = mergedSubs
    }
  }

  return { categories: merged, dbError }
}

export const deleteCategoryCascade = async (cat) => {
  if (!cat) return { success: true }
  let lastError = null

  // 1. Remove from local storage custom categories immediately
  const localCats = getLocalCats()
  const filtered = localCats.filter(
    c => c.id !== cat.id && c.slug !== cat.slug && c.name?.toLowerCase() !== cat.name?.toLowerCase()
  )
  saveLocalCats(filtered)

  // 2. Perform DB deletion
  try {
    if (cat.id && isValidUuid(cat.id)) {
      await supabase.from('subcategories').delete().eq('category_id', cat.id)
      const { error } = await supabase.from('categories').delete().eq('id', cat.id)
      if (error) lastError = error
    }

    if (cat.slug) {
      const { data: catBySlug } = await supabase.from('categories').select('id').eq('slug', cat.slug)
      if (catBySlug && catBySlug.length > 0) {
        for (const c of catBySlug) {
          await supabase.from('subcategories').delete().eq('category_id', c.id)
          const { error } = await supabase.from('categories').delete().eq('id', c.id)
          if (error) lastError = error
        }
      }
    }

    if (cat.name) {
      const { data: catByName } = await supabase.from('categories').select('id').ilike('name', cat.name)
      if (catByName && catByName.length > 0) {
        for (const c of catByName) {
          await supabase.from('subcategories').delete().eq('category_id', c.id)
          const { error } = await supabase.from('categories').delete().eq('id', c.id)
          if (error) lastError = error
        }
      }
    }
  } catch (err) {
    lastError = err
    console.warn('Error during category DB deletion:', err)
  }

  return { success: !lastError, error: lastError }
}

export const deleteSubcategoryCascade = async (sub) => {
  if (!sub) return { success: true }
  let lastError = null

  // 1. Remove from local storage subcategories
  const localCats = getLocalCats()
  const updatedLocal = localCats.map(c => ({
    ...c,
    subcategories: (c.subcategories || []).filter(
      s => s.id !== sub.id && s.slug !== sub.slug && s.name?.toLowerCase() !== sub.name?.toLowerCase()
    )
  }))
  saveLocalCats(updatedLocal)

  // 2. Perform DB deletion
  try {
    if (sub.id && isValidUuid(sub.id)) {
      const { error } = await supabase.from('subcategories').delete().eq('id', sub.id)
      if (error) lastError = error
    }
    if (sub.slug) {
      const { error } = await supabase.from('subcategories').delete().eq('slug', sub.slug)
      if (error) lastError = error
    }
    if (sub.name) {
      const { error } = await supabase.from('subcategories').delete().ilike('name', sub.name)
      if (error) lastError = error
    }
  } catch (err) {
    lastError = err
    console.warn('Error during subcategory DB deletion:', err)
  }

  return { success: !lastError, error: lastError }
}
