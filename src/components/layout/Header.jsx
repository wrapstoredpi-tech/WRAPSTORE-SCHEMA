import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Store, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const PAGE_META = {
  '/dashboard':          { title: 'Dashboard',          subtitle: 'Store overview and key performance metrics' },
  '/categories':         { title: 'Categories',         subtitle: 'Manage product categories and subcategories' },
  '/products':           { title: 'Products',            subtitle: 'Browse and manage your cases and stickers catalog' },
  '/products/add':       { title: 'Add Product',         subtitle: 'Create a new product listing' },
  '/products/approval':  { title: 'Product Approvals',   subtitle: 'Review and approve pending products' },
  '/inventory':          { title: 'Inventory',            subtitle: 'Track physical stock levels and movement audit logs' },
  '/smart-inventory':    { title: 'Smart Inventory',      subtitle: 'Dynamic intelligence, 30-day velocity, and restock alerts' },
  '/billing':            { title: 'New Invoice',          subtitle: 'Create physical store sales and dispatch PDF invoices' },
  '/invoices':           { title: 'Invoice History',      subtitle: 'View, print, download, and monitor WhatsApp delivery' },
  '/sales':              { title: 'Sales Analytics',      subtitle: 'Revenue trends, order counts, and category distribution' },
  '/customers':          { title: 'Customers',            subtitle: 'Patron directory, order frequency, and lifetime spend' },
  '/reports':            { title: 'Reports Center',       subtitle: 'Official inventory valuation, sales, and customer audits' },
  '/settings':           { title: 'Settings',             subtitle: 'Configure store profile, GSTIN, and receipt branding' },
}

const Header = ({ isCollapsed = false, toggleSidebar }) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const meta = PAGE_META[pathname] ||
    (pathname.startsWith('/products/edit') ? { title: 'Edit Product', subtitle: 'Update product details' } : null) ||
    { title: 'WrapStore', subtitle: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const isBilling = pathname === '/billing'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || 'A'

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {toggleSidebar && (
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#374151',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
        <div className="header-title">
          <h1>{meta.title}</h1>
          {meta.subtitle && <p className="header-subtitle">{meta.subtitle}</p>}
        </div>
      </div>

      <div className="header-actions">
        {/* Live Store Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: '5px 10px',
          borderRadius: 'var(--radius-full)',
          fontSize: '11px',
          fontWeight: 600,
          color: '#475569',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 2px #d1fae5' }} />
          <span>Dharmapuri Store</span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ color: '#64748b' }}>{dateStr}</span>
        </div>

        {/* Quick New Invoice Button (if not already on billing) */}
        {!isBilling && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/billing')}
            style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '12px' }}
          >
            <Plus size={13} strokeWidth={2.5} /> New Bill
          </button>
        )}

        {/* User Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '3px 8px 3px 4px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#111827',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', paddingRight: 4 }}>
            {profile?.full_name?.split(' ')[0] || 'Admin'}
          </span>
        </div>
      </div>
    </header>
  )
}

export default Header
