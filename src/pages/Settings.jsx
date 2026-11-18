import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save, Store, Phone, MapPin, FileText,
  Upload, Image as ImageIcon, X, Building2, Receipt, Activity
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const Settings = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const logoRef = useRef()

  const [settingsId, setSettingsId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  const [form, setForm] = useState({
    store_name: 'WRAPSTORE',
    address: 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701',
    phone: '+91 63839 40534',
    gstin: '',
    invoice_prefix: 'WS',
    invoice_footer: 'Thank you for shopping at WrapStore!',
    currency: 'INR',
    currency_symbol: '₹',
    logo_url: '',
  })

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('store_settings').select('*').limit(1).single()
      if (data) {
        setSettingsId(data.id)
        setForm({
          store_name: data.store_name || 'WRAPSTORE',
          address: data.address || '',
          phone: data.phone || '',
          gstin: data.gstin || '',
          invoice_prefix: data.invoice_prefix || 'WS',
          invoice_footer: data.invoice_footer || '',
          currency: data.currency || 'INR',
          currency_symbol: data.currency_symbol || '₹',
          logo_url: data.logo_url || '',
        })
        if (data.logo_url) setLogoPreview(data.logo_url)
      }
      setLoading(false)
    }
    fetchSettings()
  }, [])

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.store_name.trim()) { toast.error('Store name is required'); return }

    setSaving(true)
    try {
      let logoUrl = form.logo_url

      // Upload new logo if selected
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `logos/store-logo-${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(path, logoFile, { cacheControl: '3600', upsert: true })

        if (uploadErr) {
          toast.error('Failed to upload logo: ' + uploadErr.message)
        } else {
          const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
          logoUrl = publicUrl
        }
      }

      const payload = { ...form, logo_url: logoUrl }

      if (settingsId) {
        const { error } = await supabase.from('store_settings').update(payload).eq('id', settingsId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('store_settings').insert(payload).select().single()
        if (error) throw error
        setSettingsId(data.id)
      }

      setForm(f => ({ ...f, logo_url: logoUrl }))
      setLogoFile(null)
      toast.success('Settings saved successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /></div>
  }

  return (
    <div style={{ maxWidth: '800px' }}>

      {/* Store Information */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={16} /> Store Information
          </span>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Store Name <span className="required">*</span></label>
            <input
              className="form-input"
              value={form.store_name}
              onChange={e => set('store_name', e.target.value)}
              placeholder="WRAPSTORE"
              id="store-name-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
              Address
            </label>
            <textarea
              className="form-textarea"
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Street, City, State, PIN"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <Phone size={12} style={{ display: 'inline', marginRight: 4 }} />
                Phone
              </label>
              <input
                className="form-input"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+91 00000 00000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                GSTIN
              </label>
              <input
                className="form-input"
                value={form.gstin}
                onChange={e => set('gstin', e.target.value.toUpperCase())}
                placeholder="33XXXXXXXXXXXZ"
                maxLength={15}
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace' }}
              />
              <div className="form-hint">15-character GST Identification Number</div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Logo */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={16} /> Store Logo
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            {/* Current logo preview */}
            <div style={{
              width: 160,
              height: 80,
              borderRadius: 'var(--radius)',
              border: '2px dashed var(--border-strong)',
              background: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {logoPreview
                ? <img src={logoPreview} alt="Store logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <ImageIcon size={24} style={{ margin: '0 auto 4px' }} />
                    No logo
                  </div>
              }
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.6 }}>
                Upload your store logo. It will appear on the login page, sidebar, dashboard, and invoices (Stage 2).
                Recommended size: 400×200px, PNG or JPG.
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => logoRef.current?.click()}
                >
                  <Upload size={13} /> Upload Logo
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setLogoPreview(null); setLogoFile(null); set('logo_url', '') }}
                    style={{ color: 'var(--danger)' }}
                  >
                    <X size={13} /> Remove
                  </button>
                )}
                {logoFile && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {logoFile.name}
                  </span>
                )}
              </div>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoSelect}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={16} /> Invoice Settings
            </span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              These settings will be used in Stage 2 (Billing & Invoices)
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice Number Prefix</label>
              <input
                className="form-input"
                value={form.invoice_prefix}
                onChange={e => set('invoice_prefix', e.target.value.toUpperCase())}
                placeholder="WS"
                maxLength={6}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.1em' }}
              />
              <div className="form-hint">
                Preview: <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '3px', fontSize: '12px' }}>
                  {form.invoice_prefix || 'WS'}-000001
                </code>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Invoice Footer Note</label>
            <textarea
              className="form-textarea"
              value={form.invoice_footer}
              onChange={e => set('invoice_footer', e.target.value)}
              placeholder="e.g. Thank you for shopping at WrapStore! All sales are final."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} /> System Status
            </span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Verify Supabase, PostgreSQL, Auth, and Storage connectivity
            </div>
          </div>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
            Run a full end-to-end connection diagnostic. Tests real API calls against Supabase,
            PostgreSQL (READ / WRITE / UPDATE / DELETE), Authentication, Row Level Security, and Storage.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/settings/system-status')}
            id="open-system-status-btn"
          >
            <Activity size={13} /> Open System Status
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
          id="save-settings-btn"
        >
          {saving
            ? <><div className="btn-spinner" /> Saving...</>
            : <><Save size={16} /> Save Settings</>
          }
        </button>
      </div>
    </div>
  )
}

export default Settings
