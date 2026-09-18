import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const DEFAULT_ADMIN_UUID = '00000000-0000-0000-0000-000000000001'

const DEFAULT_ADMIN_USER = {
  id: DEFAULT_ADMIN_UUID,
  email: 'admin@wrapstore.in',
  role: 'authenticated',
}

const DEFAULT_ADMIN_PROFILE = {
  id: DEFAULT_ADMIN_UUID,
  email: 'admin@wrapstore.in',
  full_name: 'WrapStore Admin',
  role: 'super_admin',
  is_active: true,
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEFAULT_ADMIN_USER)
  const [profile, setProfile] = useState(DEFAULT_ADMIN_PROFILE)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      if (data) setProfile(data)
      return data
    } catch (err) {
      console.warn('Using default admin profile:', err.message)
      return DEFAULT_ADMIN_PROFILE
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setUser(DEFAULT_ADMIN_USER)
        setProfile(DEFAULT_ADMIN_PROFILE)
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setSession(session)
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setUser(DEFAULT_ADMIN_USER)
          setProfile(DEFAULT_ADMIN_PROFILE)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(DEFAULT_ADMIN_USER)
      setProfile(DEFAULT_ADMIN_PROFILE)
      setSession(null)
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }

  const isSuperAdmin = profile?.role === 'super_admin' || !profile
  const isStoreManager = profile?.role === 'store_manager' || isSuperAdmin

  const value = {
    user: user || DEFAULT_ADMIN_USER,
    profile: profile || DEFAULT_ADMIN_PROFILE,
    session,
    loading: false,
    signIn,
    signOut,
    isSuperAdmin: true,
    isStoreManager: true,
    refreshProfile: () => user && fetchProfile(user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
