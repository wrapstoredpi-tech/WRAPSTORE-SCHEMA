import React, { useState } from 'react'
import { Image as ImageIcon, ZoomIn, X, ChevronLeft, ChevronRight, Layers } from 'lucide-react'

const ProductImageHover = ({ src, images = [], alt = 'Product Image', title = '', size = 40, position = 'right' }) => {
  const [showLightbox, setShowLightbox] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  // Normalize image list
  const imgList = (images && images.length > 0)
    ? images.map(i => typeof i === 'string' ? i : (i.public_url || i.preview)).filter(Boolean)
    : (src ? [src] : [])

  const currentSrc = imgList[activeIdx] || src || imgList[0]

  if (imgList.length === 0 && !src) {
    return (
      <div
        className="product-thumb-placeholder"
        style={{
          width: size,
          height: size,
          borderRadius: '8px',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
        }}
      >
        <ImageIcon size={Math.max(14, Math.floor(size * 0.4))} />
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
        className={`product-thumb-wrapper ${position === 'left' ? 'preview-left' : ''}`}
        onClick={() => setShowLightbox(true)}
        style={{ cursor: 'zoom-in', position: 'relative', display: 'inline-block' }}
        title={`Click to view all ${imgList.length} images`}
      >
        {/* Thumbnail */}
        <div
          className="product-thumb"
          style={{ width: size, height: size, borderRadius: '8px', position: 'relative', overflow: 'hidden' }}
        >
          <img src={currentSrc} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

        {/* Hover Popover Large Preview */}
        <div className="product-thumb-hover-preview">
          <img src={currentSrc} alt={alt} style={{ maxHeight: '220px', objectFit: 'contain', width: '100%' }} />
          {title && <div className="product-thumb-hover-title">{title}</div>}

          {/* Popover Thumbnail Strip if multiple images */}
          {imgList.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px', padding: '4px' }}>
              {imgList.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`thumb-${idx}`}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '4px',
                    objectFit: 'cover',
                    border: activeIdx === idx ? '2px solid #111827' : '1px solid #d1d5db',
                    opacity: activeIdx === idx ? 1 : 0.6,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                />
              ))}
            </div>
          )}

          <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
            {imgList.length > 1 ? `Image ${activeIdx + 1} of ${imgList.length} · Click for gallery` : 'Click image for full-screen view'}
          </div>
        </div>
      </div>

      {/* Lightbox Modal with Gallery Carousel */}
      {showLightbox && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
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

              <img
                src={currentSrc}
                alt={alt}
                style={{
                  maxWidth: '78vw',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  background: '#f9fafb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />

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
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              {title && <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{title}</div>}
              {imgList.length > 1 && (
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginTop: '2px' }}>
                  Image {activeIdx + 1} of {imgList.length}
                </div>
              )}
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
        </div>
      )}
    </>
  )
}

export default ProductImageHover
