import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Tag, Package, Warehouse,
  Settings, LogOut, ShieldCheck, Smartphone,
  Receipt, FileText, Users, TrendingUp, Sparkles,
  BarChart2, FileBarChart, Activity
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import logo from '../../assets/logo.png'

const NavItem = ({ to, icon: Icon, label, badge, isCollapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
    style={{ textDecoration: 'none' }}
  >
    <Icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
    {!isCollapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
    {!isCollapsed && badge > 0 && <span className="sidebar-nav-badge">{badge}</span>}
    {isCollapsed && (
      <div className="sidebar-tooltip">
        {label}
        {badge > 0 && ` (${badge})`}
      </div>
    )}
  </NavLink>
)

const Sidebar = ({ isCollapsed = false, toggleSidebar }) => {
  const { profile, signOut, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!isSuperAdmin) return
    const fetchPending = async () => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'PENDING_APPROVAL')
      setPendingCount(count || 0)
    }
    fetchPending()

    const channel = supabase
      .channel('pending-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchPending)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [isSuperAdmin])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || 'U'

  const roleLabel = profile?.role === 'super_admin' ? 'Super Admin' : 'Store Manager'

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Branded Logo */}
      <div className="sidebar-logo" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '16px 0' : '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '6px',
            padding: '4px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}>
            <img src={logo} alt="WrapStore" style={{ height: '20px', width: 'auto', display: 'block' }} />
          </div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff', lineHeight: 1.1 }}>WRAPSTORE</span>
              <span style={{ fontSize: '10px', color: '#a1a1aa', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Store POS</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Overview */}
        {!isCollapsed && <div className="sidebar-section-label">Overview</div>}
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} />
        <NavItem to="/online-sales" icon={ShoppingBag} label="Online Sale" isCollapsed={isCollapsed} />

        {/* Billing & Sales */}
        <div style={{ height: '8px' }} />
        {!isCollapsed && <div className="sidebar-section-label">Billing & Sales</div>}
        <NavItem to="/billing" icon={Receipt} label="New Invoice" isCollapsed={isCollapsed} />
        <NavItem to="/invoices" icon={FileText} label="Invoice History" isCollapsed={isCollapsed} />
        <NavItem to="/sales" icon={TrendingUp} label="Sales Analytics" isCollapsed={isCollapsed} />

        {/* Catalog & Inventory */}
        <div style={{ height: '8px' }} />
        {!isCollapsed && <div className="sidebar-section-label">Catalog & Stock</div>}
        <NavItem to="/products" icon={Smartphone} label="Products" isCollapsed={isCollapsed} />
        <NavItem to="/categories" icon={Tag} label="Categories" isCollapsed={isCollapsed} />
        <NavItem to="/inventory" icon={Warehouse} label="Inventory" isCollapsed={isCollapsed} />

        {/* Customers & Reports */}
        <div style={{ height: '8px' }} />
        {!isCollapsed && <div className="sidebar-section-label">Patrons & Reports</div>}
        <NavItem to="/customers" icon={Users} label="Customers" isCollapsed={isCollapsed} />
        <NavItem to="/reports" icon={FileBarChart} label="Reports" isCollapsed={isCollapsed} />

        {/* Admin only */}
        {isSuperAdmin && (
          <>
            <div style={{ height: '8px' }} />
            {!isCollapsed && <div className="sidebar-section-label">Admin</div>}
            <NavItem
              to="/products/approval"
              icon={ShieldCheck}
              label="Approvals"
              badge={pendingCount}
              isCollapsed={isCollapsed}
            />
          </>
        )}

        <div style={{ height: '8px' }} />
        {!isCollapsed && <div className="sidebar-section-label">System</div>}
        <NavItem to="/settings" icon={Settings} label="Settings" isCollapsed={isCollapsed} />
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', flexDirection: isCollapsed ? 'column' : 'row', gap: isCollapsed ? '6px' : '10px' }}>
          <div className="sidebar-avatar" title={profile?.full_name || 'Admin'}>{initials}</div>
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {profile?.full_name || profile?.email || 'Admin User'}
              </div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          )}
          {!isCollapsed ? (
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Sign out of WrapStore"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          ) : (
            <button
              className="sidebar-logout-icon-btn"
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
