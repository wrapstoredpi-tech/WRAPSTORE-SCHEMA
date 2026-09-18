import React, { useEffect, useState } from 'react'
import {
  Plus, ChevronDown, ChevronRight, Edit2, Trash2,
  Tag, X, Check, FolderOpen, AlertCircle, Database
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  isValidUuid,
  generateUuid,
  fetchMergedCategories,
  deleteCategoryCascade,
  deleteSubcategoryCascade,
  clearDeletedCategoryKeys,
  getLocalCats,
  saveLocalCats,
} from '../lib/categoryStorage'

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---- Modal Component ----
const FieldModal = ({ title, placeholder, initialValue = '', onSave, onClose, loading }) => {
  const [value, setValue] = useState(initialValue)
  const [desc, setDesc] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!value.trim()) return
    onSave(value.trim(), desc.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Name <span className="required">*</span></label>
              <input
                className="form-input"
                placeholder={placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Optional description..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !value.trim()}>
              {loading ? <><div className="btn-spinner" /> Saving...</> : <><Check size={14} /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirm = ({ name, onConfirm, onClose, loading }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-title">Delete Confirmation</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="modal-body">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Delete "{name}"?</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              This action cannot be undone. It will be removed from database and UI.
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <><div className="btn-spinner" /> Deleting...</> : <><Trash2 size={13} /> Delete</>}
        </button>
      </div>
    </div>
  </div>
)

const Categories = () => {
  const [categories, setCategories] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rlsNotice, setRlsNotice] = useState(false)

  // Modals
  const [addCatModal, setAddCatModal] = useState(false)
  const [editCatModal, setEditCatModal] = useState(null)
  const [deleteCatModal, setDeleteCatModal] = useState(null)
  const [addSubModal, setAddSubModal] = useState(null)
  const [editSubModal, setEditSubModal] = useState(null)
  const [deleteSubModal, setDeleteSubModal] = useState(null)

  const loadCategories = async () => {
    setLoading(true)
    clearDeletedCategoryKeys() // Clear legacy local blacklists
    const { categories: merged, dbError } = await fetchMergedCategories()
    if (dbError && dbError.code === '42501') {
      setRlsNotice(true)
    }
    setCategories(merged)
    setLoading(false)
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // ---- Category CRUD ----
  const handleAddCategory = async (name, description) => {
    setSaving(true)
    const slug = slugify(name)
    const newCatUuid = generateUuid()

    const newCatObj = {
      id: newCatUuid,
      name,
      slug,
      description: description || null,
      sort_order: categories.length,
      subcategories: [],
    }

    // Attempt Supabase DB insert
    const { error } = await supabase.from('categories').insert({
      id: newCatUuid,
      name,
      slug,
      description: description || null,
      sort_order: categories.length,
    })

    if (error) {
      console.warn('DB insert failed for category:', error.message)
      if (error.code === '42501') {
        setRlsNotice(true)
        toast.error('Database Row Level Security (RLS) blocked DB save. Please run database/fix_rls_policies.sql in Supabase SQL Editor.')
      } else {
        toast.error(`Database error: ${error.message}`)
      }
    } else {
      toast.success('Category added to database!')
    }

    // Save to local storage fallback
    const local = getLocalCats()
    saveLocalCats([...local.filter(c => c.name.toLowerCase() !== name.toLowerCase() && c.slug !== slug), newCatObj])

    setAddCatModal(false)
    await loadCategories()
    setSaving(false)
  }

  const handleEditCategory = async (name, description) => {
    setSaving(true)
    const slug = slugify(name)

    if (isValidUuid(editCatModal.id)) {
      const { error } = await supabase.from('categories').update({
        name,
        slug,
        description: description || null,
      }).eq('id', editCatModal.id)

      if (error && error.code === '42501') {
        setRlsNotice(true)
        toast.error('DB update blocked by RLS policies.')
      }
    }

    const local = getLocalCats()
    const updated = local.map(c => c.id === editCatModal.id ? { ...c, name, slug, description: description || null } : c)
    saveLocalCats(updated)

    toast.success('Category updated!')
    setEditCatModal(null)
    await loadCategories()
    setSaving(false)
  }

  const handleDeleteCategory = async () => {
    setSaving(true)
    if (deleteCatModal) {
      const { error } = await deleteCategoryCascade(deleteCatModal)
      if (error && error.code === '42501') {
        setRlsNotice(true)
        toast.error('Database deletion blocked by RLS policies. Please run SQL fix script in Supabase Dashboard.')
      } else {
        toast.success('Category deleted!')
      }
      setDeleteCatModal(null)
      await loadCategories()
    }
    setSaving(false)
  }

  // ---- Subcategory CRUD ----
  const handleAddSub = async (name, description) => {
    setSaving(true)
    const slug = slugify(name)
    const newSubUuid = generateUuid()

    const parentCat = categories.find(c => c.id === addSubModal)
    let parentCatUuid = addSubModal

    if (!isValidUuid(parentCatUuid) && parentCat) {
      const dbParentUuid = generateUuid()
      const { error: catErr } = await supabase.from('categories').insert({
        id: dbParentUuid,
        name: parentCat.name,
        slug: parentCat.slug,
        description: parentCat.description || null,
        sort_order: parentCat.sort_order || 0,
      })
      if (!catErr) {
        parentCatUuid = dbParentUuid
      }
    }

    const newSubObj = {
      id: newSubUuid,
      category_id: parentCatUuid,
      name,
      slug,
      description: description || null,
    }

    if (isValidUuid(parentCatUuid)) {
      const { error } = await supabase.from('subcategories').insert({
        id: newSubUuid,
        category_id: parentCatUuid,
        name,
        slug,
        description: description || null,
      })
      if (error) {
        console.warn('DB subcategory insert error:', error.message)
        if (error.code === '42501') {
          setRlsNotice(true)
          toast.error('DB subcategory insert blocked by RLS policies.')
        }
      } else {
        toast.success('Subcategory added to database!')
      }
    }

    const local = getLocalCats()
    if (parentCat) {
      const existingIdx = local.findIndex(
        c => c.id === parentCat.id || c.name.toLowerCase() === parentCat.name.toLowerCase()
      )
      if (existingIdx !== -1) {
        const existingSubs = local[existingIdx].subcategories || []
        local[existingIdx].subcategories = [...existingSubs.filter(s => s.name.toLowerCase() !== name.toLowerCase()), newSubObj]
      } else {
        local.push({
          ...parentCat,
          subcategories: [...(parentCat.subcategories || []).filter(s => s.name.toLowerCase() !== name.toLowerCase()), newSubObj]
        })
      }
      saveLocalCats(local)
    }

    setAddSubModal(null)
    await loadCategories()
    setSaving(false)
  }

  const handleEditSub = async (name, description) => {
    setSaving(true)
    const slug = slugify(name)

    if (isValidUuid(editSubModal.id)) {
      const { error } = await supabase.from('subcategories').update({
        name,
        slug,
        description: description || null,
      }).eq('id', editSubModal.id)
      if (error && error.code === '42501') {
        setRlsNotice(true)
        toast.error('DB update blocked by RLS policies.')
      }
    }

    toast.success('Subcategory updated!')
    setEditSubModal(null)
    await loadCategories()
    setSaving(false)
  }

  const handleDeleteSub = async () => {
    setSaving(true)
    if (deleteSubModal) {
      const { error } = await deleteSubcategoryCascade(deleteSubModal)
      if (error && error.code === '42501') {
        setRlsNotice(true)
        toast.error('Database deletion blocked by RLS policies.')
      } else {
        toast.success('Subcategory deleted!')
      }
      setDeleteSubModal(null)
      await loadCategories()
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Product Categories</div>
          <div className="section-subtitle">{categories.length} categories configured</div>
        </div>
        <button className="btn btn-primary" onClick={() => setAddCatModal(true)} id="add-category-btn">
          <Plus size={14} /> Add Category
        </button>
      </div>

      {rlsNotice && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#f87171',
          fontSize: '13px',
        }}>
          <Database size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Action Required for Database Sync:</strong> Supabase Row Level Security (RLS) is currently blocking direct DB additions and deletions.
            Please run <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>database/fix_rls_policies.sql</code> in your Supabase SQL Editor to allow database syncing.
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Tag size={24} /></div>
          <h3>No categories yet</h3>
          <p>Create your first product category to get started.</p>
          <button className="btn btn-primary" onClick={() => setAddCatModal(true)}>
            <Plus size={14} /> Add Category
          </button>
        </div>
      ) : (
        <div>
          {categories.map(cat => {
            const isOpen = expanded[cat.id]
            const subs = cat.subcategories || []
            return (
              <div key={cat.id} className="category-item">
                <div className="category-header">
                  <button
                    className="category-expand-btn"
                    onClick={() => toggleExpand(cat.id)}
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderOpen size={15} color="var(--text-secondary)" />
                    </div>
                    <div>
                      <div className="category-name">{cat.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {subs.length} subcategor{subs.length === 1 ? 'y' : 'ies'}
                        {cat.description ? ` · ${cat.description}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="category-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setAddSubModal(cat.id); setExpanded(p => ({...p, [cat.id]: true})) }}
                      title="Add subcategory"
                    >
                      <Plus size={13} /> Sub
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setEditCatModal(cat)}
                      title="Edit category"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setDeleteCatModal(cat)}
                      title="Delete category"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="subcategory-list">
                    {subs.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        No subcategories yet.{' '}
                        <span
                          style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => setAddSubModal(cat.id)}
                        >
                          Add one
                        </span>
                      </div>
                    ) : (
                      subs
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        .map(sub => (
                          <div key={sub.id} className="subcategory-item">
                            <div className="subcategory-dot" />
                            <div className="subcategory-name">{sub.name}</div>
                            {sub.description && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 8 }}>{sub.description}</div>
                            )}
                            <div className="subcategory-actions">
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => setEditSubModal(sub)}
                                title="Edit"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => setDeleteSubModal(sub)}
                                title="Delete"
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {addCatModal && (
        <FieldModal title="Add Category" placeholder="e.g. Mobile Cases" onSave={handleAddCategory} onClose={() => setAddCatModal(false)} loading={saving} />
      )}
      {editCatModal && (
        <FieldModal title="Edit Category" placeholder={editCatModal.name} initialValue={editCatModal.name} onSave={handleEditCategory} onClose={() => setEditCatModal(null)} loading={saving} />
      )}
      {deleteCatModal && (
        <DeleteConfirm name={deleteCatModal.name} onConfirm={handleDeleteCategory} onClose={() => setDeleteCatModal(null)} loading={saving} />
      )}
      {addSubModal && (
        <FieldModal
          title={`Add Subcategory to "${categories.find(c => c.id === addSubModal)?.name}"`}
          placeholder="e.g. iPhone Cases"
          onSave={handleAddSub}
          onClose={() => setAddSubModal(null)}
          loading={saving}
        />
      )}
      {editSubModal && (
        <FieldModal title="Edit Subcategory" placeholder={editSubModal.name} initialValue={editSubModal.name} onSave={handleEditSub} onClose={() => setEditSubModal(null)} loading={saving} />
      )}
      {deleteSubModal && (
        <DeleteConfirm name={deleteSubModal.name} onConfirm={handleDeleteSub} onClose={() => setDeleteSubModal(null)} loading={saving} />
      )}
    </div>
  )
}

export default Categories
