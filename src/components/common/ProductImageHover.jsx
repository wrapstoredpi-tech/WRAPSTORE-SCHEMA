import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, ZoomIn, X, ChevronLeft, ChevronRight, Layers } from 'lucide-react'

const FALLBACK_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>"

const ProductImageHover = ({
  src,
  images = [],
  alt = 'Product Image',
  title = '',
  size = 40,
  position = 'right',
  product = null
}) => {
  const [showLightbox, setShowLightbox] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [failedUrls, setFailedUrls] = useState({})
  const [isHovered, setIsHovered] = useState(false)
  const [popoverCoords, setPopoverCoords] = useState(null)

  const thumbRef = useRef(null)
  const hoverTimeoutRef = useRef(null)

  // Normalize image list, filtering out dead/failed URLs
  const rawList = (images && images.length > 0)
    ? images.map(i => typeof i === 'string' ? i : (i?.public_url || i?.preview)).filter(Boolean)
    : (src ? [src] : [])

  const imgList = rawList.filter(u => !failedUrls[u])
  const hasImages = imgList.length > 0
  const currentSrc = hasImages ? (imgList[activeIdx] || imgList[0]) : FALLBACK_SVG

  // Calculate popover viewport coordinates clamped within screen
  const updatePopoverPosition = () => {
    if (!thumbRef.current) return
    const rect = thumbRef.current.getBoundingClientRect()
    const popoverWidth = 320
    const popoverHeight = 420 // max expected height

    let left = 0
    if (position === 'left' || (rect.right + popoverWidth + 24 > window.innerWidth)) {
      left = Math.max(12, rect.left - popoverWidth - 12)
    } else {
      left = Math.min(window.innerWidth - popoverWidth - 12, rect.right + 12)
    }

    // Vertically center on thumbnail, clamped within viewport
    const idealTop = rect.top + (rect.height / 2) - 170
    const top = Math.max(12, Math.min(window.innerHeight - popoverHeight - 12, idealTop))

    setPopoverCoords({ top, left })
  }

  const handleThumbEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    updatePopoverPosition()
    setIsHovered(true)
  }

  const handleThumbLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 150)
  }

  const handlePopoverEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsHovered(true)
  }

  const handlePopoverLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 150)
  }

  // Keyboard navigation inside lightbox modal
  useEffect(() => {
    if (!showLightbox) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowLightbox(false)
      } else if (e.key === 'ArrowLeft' && imgList.length > 1) {
        setActiveIdx(prev => (prev === 0 ? imgList.length - 1 : prev - 1))
      } else if (e.key === 'ArrowRight' && imgList.length > 1) {
        setActiveIdx(prev => (prev === imgList.length - 1 ? 0 : prev + 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showLightbox, imgList.length])

  // Cleanup hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  const renderProductFeatures = (prod) => {
    if (!prod) return null

    const categoryName = prod.categories?.name || prod.category_name || (prod.product_type ? String(prod.product_type).replace(/_/g, ' ') : null)
    const subcategoryName = prod.subcategories?.name || prod.subcategory_name || null
    const pinType = prod.pin_type || null
    const cableType = prod.cable_type || null
    const isMagSafe = prod.magsafe === true || prod.magsafe === 'Yes' || prod.magsafe === 'true'
    const mah = prod.mah || null
    const strapMm = prod.strap_mm || null
    const collection = prod.collection || null
    const brand = prod.mobile_brand || null
    const model = prod.mobile_model || null
    const color = prod.color || prod.color_variants || prod.selected_color || null
    const price = prod.selling_price || prod.price || 0
    const mrp = prod.mrp ? Number(prod.mrp) : (prod.description?.match(/MRP:\s*₹?\s*([\d.]+)/i)?.[1] ? Number(prod.description.match(/MRP:\s*₹?\s*([\d.]+)/i)[1]) : 0)
    const stock = prod.current_stock !== undefined ? prod.current_stock : null
    const stockMin = prod.min_stock_alert ?? 5
    const code = prod.product_id || prod.product_id_code || prod.code || null

    const hasAnyBadge = pinType || cableType || isMagSafe || mah || strapMm || collection
    const hasAnySpec = !!code

    if (!hasAnyBadge && !hasAnySpec) return null

    return (
      <div style={{ marginTop: '10px', textAlign: 'left', width: '100%' }}>
        {/* Feature Badges Row */}
        {hasAnyBadge && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: code ? '8px' : '0' }}>
            {pinType && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#f5f3ff',
                color: '#6d28d9',
                border: '1px solid #ddd6fe',
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
                {pinType}
              </span>
            )}

            {cableType && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#fdf2f8',
                color: '#be185d',
                border: '1px solid #fbcfe8',
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
                {cableType}
              </span>
            )}

            {isMagSafe && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                ⚡ MagSafe
              </span>
            )}

            {mah && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                🔋 {String(mah).toLowerCase().includes('mah') ? mah : `${mah}mAh`}
              </span>
            )}

            {strapMm && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#eef2ff',
                color: '#4338ca',
                border: '1px solid #c7d2fe',
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                ⌚ {String(strapMm).toLowerCase().includes('mm') ? strapMm : `${strapMm}mm`}
              </span>
            )}

            {collection && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fde68a',
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                ✨ {collection}
              </span>
            )}
          </div>
        )}

        {/* Product ID */}
        {code && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Product ID</span>
            <code style={{ fontWeight: 700, color: '#0f172a', background: '#e2e8f0', padding: '1px 6px', borderRadius: 4 }}>
              {code}
            </code>
          </div>
        )}
      </div>
    )
  }

  const handlePrev = (e) => {
    e?.stopPropagation()
    setActiveIdx(prev => (prev === 0 ? imgList.length - 1 : prev - 1))
  }

  const handleNext = (e) => {
    e?.stopPropagation()
    setActiveIdx(prev => (prev === imgList.length - 1 ? 0 : prev + 1))
  }

  return (
    <>
      <div
        ref={thumbRef}
        className={`product-thumb-wrapper ${position === 'left' ? 'preview-left' : ''}`}
        onMouseEnter={handleThumbEnter}
        onMouseLeave={handleThumbLeave}
        onClick={(e) => {
          e.stopPropagation()
          setIsHovered(false)
          setShowLightbox(true)
        }}
        style={{ cursor: 'zoom-in', position: 'relative', display: 'inline-block' }}
        title={hasImages ? `Click to view gallery (${imgList.length} images)` : 'Click to view product details'}
      >
        {/* Thumbnail */}
        <div
          className="product-thumb"
          style={{ width: size, height: size, borderRadius: '8px', position: 'relative', overflow: 'hidden' }}
        >
          {hasImages ? (
            <img
              src={currentSrc}
              alt={alt}
              loading="lazy"
              onError={() => {
                if (currentSrc) setFailedUrls(prev => ({ ...prev, [currentSrc]: true }))
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
              }}
            >
              <ImageIcon size={Math.max(14, Math.floor(size * 0.45))} />
            </div>
          )}

          <div className="thumb-zoom-badge">
            <ZoomIn size={10} color="white" />
          </div>

          {/* Multi-image indicator badge */}
          {imgList.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                background: 'rgba(17, 24, 39, 0.85)',
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                zIndex: 2,
              }}
            >
              <Layers size={9} />
              {imgList.length}
            </div>
          )}
        </div>
      </div>

      {/* Portal-based Hover Popover: Immune to overflow:hidden and scroll clipping */}
      {isHovered && popoverCoords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: popoverCoords.top,
            left: popoverCoords.left,
            width: 320,
            maxHeight: '85vh',
            overflowY: 'auto',
            zIndex: 99998,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            padding: '12px',
            cursor: 'pointer',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
          onClick={(e) => {
            e.stopPropagation()
            setIsHovered(false)
            setShowLightbox(true)
          }}
        >
          {hasImages ? (
            <img
              src={currentSrc}
              alt={alt}
              style={{
                width: '100%',
                height: 180,
                maxHeight: 180,
                objectFit: 'contain',
                background: '#f9fafb',
                borderRadius: 8,
                display: 'block',
              }}
              onError={() => {
                if (currentSrc) setFailedUrls(prev => ({ ...prev, [currentSrc]: true }))
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: 140,
                background: '#f8fafc',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                gap: 6,
              }}
            >
              <ImageIcon size={36} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>No preview photo available</span>
            </div>
          )}

          {title && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 8, textAlign: 'left', lineHeight: 1.35 }}>
              {title}
            </div>
          )}

          {/* Render Product Features & Badges */}
          {renderProductFeatures(product)}

          {/* Popover Thumbnail Strip if multiple images */}
          {imgList.length > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, padding: 4 }}>
              {imgList.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`thumb-${idx}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    objectFit: 'cover',
                    border: activeIdx === idx ? '2px solid #111827' : '1px solid #d1d5db',
                    opacity: activeIdx === idx ? 1 : 0.6,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    setActiveIdx(idx)
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
            {imgList.length > 1 ? `Image ${activeIdx + 1} of ${imgList.length} · Click for gallery modal` : 'Click to open gallery modal'}
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Modal with Gallery Carousel (Mounted at document.body) */}
      {showLightbox && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={() => setShowLightbox(false)}
        >
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '92vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowLightbox(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                zIndex: 10,
              }}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>

            {/* Main Image with Carousel Controls */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {imgList.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    position: 'absolute',
                    left: '-20px',
                    background: '#111827',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    zIndex: 5,
                  }}
                  title="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {hasImages ? (
                <img
                  src={currentSrc}
                  alt={alt}
                  style={{
                    maxWidth: '78vw',
                    maxHeight: '62vh',
                    objectFit: 'contain',
                    borderRadius: '10px',
                    background: '#f9fafb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '320px',
                    height: '240px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    gap: 8,
                  }}
                >
                  <ImageIcon size={48} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>No gallery images uploaded</span>
                </div>
              )}

              {imgList.length > 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    position: 'absolute',
                    right: '-20px',
                    background: '#111827',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    zIndex: 5,
                  }}
                  title="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Title & Counter */}
            <div style={{ marginTop: '12px', textAlign: 'center', width: '100%', maxWidth: '460px' }}>
              {title && <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{title}</div>}
              {imgList.length > 1 && (
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginTop: '2px' }}>
                  Image {activeIdx + 1} of {imgList.length}
                </div>
              )}
              {/* Product features in modal */}
              {renderProductFeatures(product)}
            </div>

            {/* Gallery Thumbnails Bar */}
            {imgList.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '12px',
                padding: '6px 12px',
                background: '#f3f4f6',
                borderRadius: '8px',
                maxHeight: '70px',
                overflowX: 'auto',
              }}>
                {imgList.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`gallery-thumb-${idx}`}
                    onClick={() => setActiveIdx(idx)}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      border: activeIdx === idx ? '2.5px solid #111827' : '1px solid #d1d5db',
                      opacity: activeIdx === idx ? 1 : 0.5,
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default ProductImageHover