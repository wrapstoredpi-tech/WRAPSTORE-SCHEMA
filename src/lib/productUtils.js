/**
 * Formats a product's display name to include variant/color if present and not already part of the name.
 * Example:
 *   Name: "Silicon Case", color_variants: "Brown" -> "Silicon Case - Brown"
 *   Name: "Silicon Case - Brown", color_variants: "Brown" -> "Silicon Case - Brown"
 */
export const getFormattedProductName = (product) => {
  if (!product) return ''
  let name = product.name || ''
  const variant = product.color_variants || product.color || product.variant_name || product.variant || ''

  // Strip out legacy auto-generated brand/model/category prefixes if present in name
  // Example: "Apple iPhone 18 Pro Mobile Cases - Silicon Case" -> "Silicon Case"
  if (name.includes(' - ')) {
    const parts = name.split(' - ')
    const firstPart = parts[0].toLowerCase()
    if (
      firstPart.includes('iphone') ||
      firstPart.includes('samsung') ||
      firstPart.includes('mobile cases') ||
      firstPart.includes('apple')
    ) {
      name = parts.slice(1).join(' - ')
    }
  }

  if (!variant || typeof variant !== 'string' || !variant.trim()) {
    return name
  }

  const trimmedVariant = variant.trim()

  // If product name already contains the variant name (case-insensitive check), return clean name
  if (name.toLowerCase().includes(trimmedVariant.toLowerCase())) {
    return name
  }

  return `${name} - ${trimmedVariant}`
}

/**
 * Safely extracts MRP from product.mrp or description text (e.g. "MRP: ₹599").
 */
export const getMrp = (product) => {
  if (!product) return 0
  if (product.mrp && Number(product.mrp) > 0) return Number(product.mrp)
  if (product.description && typeof product.description === 'string') {
    const match = product.description.match(/MRP:\s*₹?\s*([\d.]+)/i)
    if (match && match[1]) {
      return Number(match[1])
    }
  }
  return 0
}
