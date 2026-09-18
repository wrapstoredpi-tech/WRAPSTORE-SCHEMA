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

export const getDeletedCategoryKeys = () => {
  try {
    const raw = localStorage.getItem('wrapstore_deleted_category_keys_v1')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const getDeletedSubcategoryKeys = () => {
  try {
    const raw = localStorage.getItem('wrapstore_deleted_subcategory_keys_v1')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const markCategoryDeleted = (cat) => {
  if (!cat) return
  const deletedKeys = getDeletedCategoryKeys()
  const keysToAdd = [cat.id, cat.slug, cat.name?.toLowerCase()].filter(Boolean)
  const updatedKeys = Array.from(new Set([...deletedKeys, ...keysToAdd]))
  localStorage.setItem('wrapstore_deleted_category_keys_v1', JSON.stringify(updatedKeys))

  // Remove from local storage custom categories
  const localCats = getLocalCats()
  const filtered = localCats.filter(
    c => c.id !== cat.id && c.slug !== cat.slug && c.name?.toLowerCase() !== cat.name?.toLowerCase()
  )
  saveLocalCats(filtered)
}

export const markSubcategoryDeleted = (sub) => {
  if (!sub) return
  const deletedKeys = getDeletedSubcategoryKeys()
  const keysToAdd = [sub.id, sub.slug, sub.name?.toLowerCase()].filter(Boolean)
  const updatedKeys = Array.from(new Set([...deletedKeys, ...keysToAdd]))
  localStorage.setItem('wrapstore_deleted_subcategory_keys_v1', JSON.stringify(updatedKeys))

  // Remove from local storage custom subcategories
  const localCats = getLocalCats()
  const updatedLocal = localCats.map(c => ({
    ...c,
    subcategories: (c.subcategories || []).filter(
      s => s.id !== sub.id && s.slug !== sub.slug && s.name?.toLowerCase() !== sub.name?.toLowerCase()
    )
  }))
  saveLocalCats(updatedLocal)
}

export const unmarkCategoryDeleted = (nameOrSlugOrId) => {
  if (!nameOrSlugOrId) return
  const target = String(nameOrSlugOrId).toLowerCase()
  const deletedKeys = getDeletedCategoryKeys()
  const updatedKeys = deletedKeys.filter(k => String(k).toLowerCase() !== target)
  localStorage.setItem('wrapstore_deleted_category_keys_v1', JSON.stringify(updatedKeys))
}

export const unmarkSubcategoryDeleted = (nameOrSlugOrId) => {
  if (!nameOrSlugOrId) return
  const target = String(nameOrSlugOrId).toLowerCase()
  const deletedKeys = getDeletedSubcategoryKeys()
  const updatedKeys = deletedKeys.filter(k => String(k).toLowerCase() !== target)
  localStorage.setItem('wrapstore_deleted_subcategory_keys_v1', JSON.stringify(updatedKeys))
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

export const fetchMergedCategories = async () => {
  const deletedCatKeys = new Set(getDeletedCategoryKeys().map(k => String(k).toLowerCase()))
  const deletedSubKeys = new Set(getDeletedSubcategoryKeys().map(k => String(k).toLowerCase()))

  let dbCats = []
  try {
    const { data } = await supabase
      .from('categories')
      .select(`*, subcategories(*)`)
      .order('sort_order', { ascending: true })
    dbCats = data || []
  } catch (err) {
    console.warn('Could not fetch categories from Supabase DB:', err)
  }

  const localCats = getLocalCats()

  const isCatDeleted = (c) => {
    if (!c) return true
    if (c.id && deletedCatKeys.has(String(c.id).toLowerCase())) return true
    if (c.slug && deletedCatKeys.has(String(c.slug).toLowerCase())) return true
    if (c.name && deletedCatKeys.has(String(c.name).toLowerCase())) return true
    return false
  }

  const isSubDeleted = (s) => {
    if (!s) return true
    if (s.id && deletedSubKeys.has(String(s.id).toLowerCase())) return true
    if (s.slug && deletedSubKeys.has(String(s.slug).toLowerCase())) return true
    if (s.name && deletedSubKeys.has(String(s.name).toLowerCase())) return true
    return false
  }

  // Filter DB categories
  const filteredDbCats = dbCats.filter(c => !isCatDeleted(c)).map(c => ({
    ...c,
    subcategories: (c.subcategories || []).filter(s => !isSubDeleted(s))
  }))

  // Filter local categories
  const filteredLocalCats = localCats.filter(c => !isCatDeleted(c)).map(c => ({
    ...c,
    subcategories: (c.subcategories || []).filter(s => !isSubDeleted(s))
  }))

  // Merge
  const merged = [...filteredDbCats]
  for (const lc of filteredLocalCats) {
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
        if (!isSubDeleted(ls)) {
          if (!mergedSubs.some(s => s.id === ls.id || (s.name && ls.name && s.name.toLowerCase() === ls.name.toLowerCase()))) {
            mergedSubs.push(ls)
          }
        }
      }
      merged[existingIdx].subcategories = mergedSubs
    }
  }

  return merged
}

export const deleteCategoryCascade = async (cat) => {
  if (!cat) return
  markCategoryDeleted(cat)

  // Try DB deletion
  try {
    // 1. Delete subcategories for this category
    if (cat.id && isValidUuid(cat.id)) {
      await supabase.from('subcategories').delete().eq('category_id', cat.id)
    }
    if (cat.slug) {
      const { data: catBySlug } = await supabase.from('categories').select('id').eq('slug', cat.slug)
      if (catBySlug && catBySlug.length > 0) {
        for (const c of catBySlug) {
          await supabase.from('subcategories').delete().eq('category_id', c.id)
          await supabase.from('categories').delete().eq('id', c.id)
        }
      }
    }
    if (cat.name) {
      const { data: catByName } = await supabase.from('categories').select('id').ilike('name', cat.name)
      if (catByName && catByName.length > 0) {
        for (const c of catByName) {
          await supabase.from('subcategories').delete().eq('category_id', c.id)
          await supabase.from('categories').delete().eq('id', c.id)
        }
      }
    }

    if (cat.id && isValidUuid(cat.id)) {
      await supabase.from('categories').delete().eq('id', cat.id)
    }
  } catch (err) {
    console.warn('Error during category DB deletion:', err)
  }
}

export const deleteSubcategoryCascade = async (sub) => {
  if (!sub) return
  markSubcategoryDeleted(sub)

  // Try DB deletion
  try {
    if (sub.id && isValidUuid(sub.id)) {
      await supabase.from('subcategories').delete().eq('id', sub.id)
    }
    if (sub.slug) {
      await supabase.from('subcategories').delete().eq('slug', sub.slug)
    }
    if (sub.name) {
      await supabase.from('subcategories').delete().ilike('name', sub.name)
    }
  } catch (err) {
    console.warn('Error during subcategory DB deletion:', err)
  }
}
