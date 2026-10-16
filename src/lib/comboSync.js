/**
 * Utility functions to synchronize combo allotted_qty based on available product inventory.
 * A combo's available quantity (allotted_qty) is determined by the minimum available stock
 * among all products included in the combo:
 *   allotted_qty = Math.min(...constituent_products.map(p => p.current_stock))
 */

import { supabase } from './supabase.js'

const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

/**
 * Reconciles all active combos with live product stock in Supabase & localStorage.
 * Updates combo_items and combos.items with the correct allotted_qty.
 */
export async function reconcileCombosWithLiveStock(customSupabase = supabase) {
  try {
    // 1. Fetch all active combos
    const { data: dbCombos, error: combosErr } = await customSupabase
      .from('combos')
      .select('*')
      .eq('is_active', true)

    let combosToProcess = []
    if (!combosErr && dbCombos && dbCombos.length > 0) {
      combosToProcess = dbCombos
    } else {
      // Fallback: localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('wrapstore_combos_v1') || '[]')
        combosToProcess = stored.filter(c => c.is_active !== false)
      } catch (e) {
        combosToProcess = []
      }
    }

    if (combosToProcess.length === 0) return []

    // 2. Collect all product IDs in all combos
    const productIds = new Set()
    combosToProcess.forEach(c => {
      const items = Array.isArray(c.items) ? c.items : (typeof c.items === 'string' ? JSON.parse(c.items || '[]') : [])
      items.forEach(it => {
        if (it.product_id && isValidUuid(it.product_id)) {
          productIds.add(it.product_id)
        }
      })
    })

    if (productIds.size === 0) return combosToProcess

    // 3. Fetch latest current_stock for these products
    const { data: products, error: prodErr } = await customSupabase
      .from('products')
      .select('id, current_stock')
      .in('id', Array.from(productIds))

    if (prodErr || !products) {
      console.warn('Could not fetch products for combo stock reconciliation:', prodErr)
      return combosToProcess
    }

    const stockMap = {}
    products.forEach(p => {
      stockMap[p.id] = Math.max(0, Number(p.current_stock) || 0)
    })

    // 4. Check each combo and update allotted_qty if discrepancy exists
    const updatedCombos = []
    for (const combo of combosToProcess) {
      const items = Array.isArray(combo.items) ? combo.items : (typeof combo.items === 'string' ? JSON.parse(combo.items || '[]') : [])
      
      if (items.length === 0) {
        updatedCombos.push(combo)
        continue
      }

      // Compute min stock across all items in combo
      const itemStocks = items.map(it => {
        const stock = stockMap[it.product_id] !== undefined ? stockMap[it.product_id] : 0
        return stock
      })
      const calculatedAllottedQty = Math.max(0, Math.min(...itemStocks))

      let needsUpdate = false
      const updatedItems = items.map(it => {
        if (Number(it.allotted_qty) !== calculatedAllottedQty) {
          needsUpdate = true
          return { ...it, allotted_qty: calculatedAllottedQty }
        }
        return it
      })

      if (needsUpdate) {
        // Update combos table
        try {
          await customSupabase
            .from('combos')
            .update({ items: updatedItems, updated_at: new Date().toISOString() })
            .eq('id', combo.id)
        } catch (e) {
          console.warn('Error updating combo items JSON in DB:', e)
        }

        // Update combo_items table
        try {
          await customSupabase
            .from('combo_items')
            .update({ allotted_qty: calculatedAllottedQty })
            .eq('combo_id', combo.id)
        } catch (e) {
          console.warn('Error updating combo_items allotted_qty in DB:', e)
        }

        updatedCombos.push({
          ...combo,
          items: updatedItems,
        })
      } else {
        updatedCombos.push(combo)
      }
    }

    // Update localStorage cache
    try {
      localStorage.setItem('wrapstore_combos_v1', JSON.stringify(updatedCombos))
    } catch (e) {}

    return updatedCombos
  } catch (err) {
    console.error('Error during combo live stock reconciliation:', err)
    return []
  }
}

/**
 * Recalculates and updates allotted_qty for all combos containing any of the given product IDs.
 * Called immediately after any product is purchased or product stock is modified.
 */
export async function updateCombosAfterProductStockChange(affectedProductIds = [], customSupabase = supabase) {
  if (!affectedProductIds || affectedProductIds.length === 0) return

  try {
    const validIds = affectedProductIds.filter(isValidUuid)
    if (validIds.length === 0) return

    // Fetch combos that include these products
    const { data: combos, error } = await customSupabase
      .from('combos')
      .select('*')
      .eq('is_active', true)

    if (error || !combos) return

    // Filter combos containing any of the affected products
    const affectedCombos = combos.filter(c => {
      const items = Array.isArray(c.items) ? c.items : (typeof c.items === 'string' ? JSON.parse(c.items || '[]') : [])
      return items.some(it => validIds.includes(it.product_id))
    })

    if (affectedCombos.length === 0) return

    // Collect all product IDs in these affected combos
    const allProdIdsInAffected = new Set()
    affectedCombos.forEach(c => {
      const items = Array.isArray(c.items) ? c.items : (typeof c.items === 'string' ? JSON.parse(c.items || '[]') : [])
      items.forEach(it => {
        if (it.product_id && isValidUuid(it.product_id)) {
          allProdIdsInAffected.add(it.product_id)
        }
      })
    })

    // Fetch current stocks for all products in affected combos
    const { data: freshProducts } = await customSupabase
      .from('products')
      .select('id, current_stock')
      .in('id', Array.from(allProdIdsInAffected))

    const stockMap = {}
    ;(freshProducts || []).forEach(p => {
      stockMap[p.id] = Math.max(0, Number(p.current_stock) || 0)
    })

    for (const combo of affectedCombos) {
      const items = Array.isArray(combo.items) ? combo.items : (typeof combo.items === 'string' ? JSON.parse(combo.items || '[]') : [])
      if (items.length === 0) continue

      const itemStocks = items.map(it => stockMap[it.product_id] !== undefined ? stockMap[it.product_id] : 0)
      const newAllotted = Math.max(0, Math.min(...itemStocks))

      const updatedItems = items.map(it => ({
        ...it,
        allotted_qty: newAllotted,
      }))

      // Update combos table
      try {
        await customSupabase
          .from('combos')
          .update({ items: updatedItems, updated_at: new Date().toISOString() })
          .eq('id', combo.id)
      } catch (e) {
        console.warn('Failed to update combos items in DB:', e)
      }

      // Update combo_items table
      try {
        await customSupabase
          .from('combo_items')
          .update({ allotted_qty: newAllotted })
          .eq('combo_id', combo.id)
      } catch (e) {
        console.warn('Failed to update combo_items allotted_qty in DB:', e)
      }
    }

    // Also update localStorage cache
    try {
      const stored = JSON.parse(localStorage.getItem('wrapstore_combos_v1') || '[]')
      const updatedStored = stored.map(c => {
        const matching = affectedCombos.find(ac => ac.id === c.id)
        if (matching) {
          const items = Array.isArray(c.items) ? c.items : []
          const itemStocks = items.map(it => stockMap[it.product_id] !== undefined ? stockMap[it.product_id] : 0)
          const newAllotted = itemStocks.length > 0 ? Math.max(0, Math.min(...itemStocks)) : 0
          return {
            ...c,
            items: items.map(it => ({ ...it, allotted_qty: newAllotted })),
          }
        }
        return c
      })
      localStorage.setItem('wrapstore_combos_v1', JSON.stringify(updatedStored))
    } catch (e) {}

  } catch (err) {
    console.error('Error updating combos after product stock change:', err)
  }
}
