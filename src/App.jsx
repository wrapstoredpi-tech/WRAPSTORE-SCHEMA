import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import Products from './pages/Products'
import AddProduct from './pages/AddProduct'
import EditProduct from './pages/EditProduct'
import ProductApproval from './pages/ProductApproval'
import Inventory from './pages/Inventory'
import Settings from './pages/Settings'
import SystemStatus from './pages/SystemStatus'
import Billing from './pages/Billing'
import Invoices from './pages/Invoices'
import Customers from './pages/Customers'
import Sales from './pages/Sales'
import SmartInventory from './pages/SmartInventory'
import Reports from './pages/Reports'
import OnlineOrders from './pages/OnlineOrders'
import OnlineSales from './pages/OnlineSales'

const ProtectedRoute = ({ children }) => {
  return children
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Navigate to="/dashboard" replace />} />

    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="online-sales" element={<OnlineSales />} />

      {/* Stage 1 — Products & Inventory */}
      <Route path="categories" element={<Categories />} />
      <Route path="products" element={<Products />} />
      <Route path="products/add" element={<AddProduct />} />
      <Route path="products/edit/:id" element={<EditProduct />} />
      <Route path="products/approval" element={
        <ProtectedRoute requireSuperAdmin={true}><ProductApproval /></ProtectedRoute>
      } />
      <Route path="inventory" element={<Inventory />} />
      <Route path="smart-inventory" element={<SmartInventory />} />

      {/* Stage 2 — Billing, Invoices, Customers */}
      <Route path="billing" element={<Billing />} />
      <Route path="invoices" element={<Invoices />} />
      <Route path="customers" element={<Customers />} />

      {/* Stage 3 — Sales Analytics & Reports */}
      <Route path="sales" element={<Sales />} />
      <Route path="reports" element={<Reports />} />

      {/* Online Channel */}
      <Route path="online-orders" element={<OnlineOrders />} />
      <Route path="online-sales" element={<OnlineSales />} />

      {/* Settings */}
      <Route path="settings" element={<Settings />} />
      <Route path="settings/system-status" element={<SystemStatus />} />
    </Route>

    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: '500',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </AuthProvider>
  </BrowserRouter>
)

export default App
