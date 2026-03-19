import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Loader } from 'lucide-react';

// Lazy imports
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Customers = lazy(() => import('./pages/Customers'));
const SalesPage = lazy(() => import('./pages/sales/SalesPage'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PurchasesPage = lazy(() => import('./pages/purchases/PurchasesPage'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const LogisticsPage = lazy(() => import('./pages/logistics/LogisticsPage'));
const SecurityPage = lazy(() => import('./pages/security/SecurityPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const VariationDetail = lazy(() => import('./pages/inventory/VariationDetail'));
const VariationLabel = lazy(() => import('./pages/inventory/VariationLabel'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <Loader className="w-10 h-10 animate-spin text-indigo-600" />
      <p className="text-slate-500 font-medium">Cargando...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/pos" 
              element={
                <ProtectedRoute>
                  <POS />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sales" 
              element={
                <ProtectedRoute>
                  <SalesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inventory" 
              element={
                <ProtectedRoute>
                  <Inventory />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/variation/:id"
              element={
                <ProtectedRoute>
                  <VariationDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/labels/variation/:id"
              element={
                <ProtectedRoute>
                  <VariationLabel />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/customers" 
              element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/suppliers" 
              element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/purchases" 
              element={
                <ProtectedRoute>
                  <PurchasesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/finance" 
              element={
                <ProtectedRoute>
                  <FinancePage />
                </ProtectedRoute>
              } 
            />
            <Route path="/logistics" element={
              <ProtectedRoute allowedRoles={['Administrador', 'Supervisor', 'Almacén']}>
                <LogisticsPage />
              </ProtectedRoute>
            } />
            <Route path="/security" element={
              <ProtectedRoute allowedRoles={['Administrador']}>
                <SecurityPage />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['Administrador', 'Supervisor']}>
                <ReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['Administrador']}>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
