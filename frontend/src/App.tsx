import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import UploadDocumento from './components/UploadDocumento';
import Dashboard from './components/Dashboard';
import Login from './components/Login/Login';
import ProtectedRoute from './components/ProtectedRoute';
import './components/UploadDocumento.css';
import './App.css';

function App() {
  const handleLogout = () => {
    const confirmed = window.confirm("¿Estás seguro de cerrar sesión?");
    if (confirmed) {
      localStorage.clear();
      window.location.href = "/login";
    }
  };

  // Componente interno para el header con navegación
  const HeaderWithNavigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const isOnDashboard = location.pathname === '/dashboard' || location.pathname === '/';
    
    return (
      <header className="App-header">
        {/* Botones de navegación a la izquierda */}
        <div className="header-left">
          <button className="logout-button" onClick={handleLogout}>
            🚪 Logout
          </button>
          
          {!isOnDashboard && (
            <button 
              className="home-button" 
              onClick={() => navigate('/dashboard')}
              title="Volver al Dashboard"
            >
              🏠 Dashboard
            </button>
          )}
        </div>

        {/* Título central */}
        <div className="header-center">
          <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
          <p>Procesamiento inteligente de documentos con Google Cloud Vision API</p>
        </div>

        {/* Espacio para balance visual */}
        <div className="header-right">
          {/* Reservado para futuras funciones */}
        </div>
      </header>
    );
  };

  // Layout que agrupa el header, footer y contenido
  const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="App">
      <HeaderWithNavigation />
      <main className="App-main">{children}</main>
      <footer className="App-footer">
        <p>🏗️ DocuValle v3.0.0 - Powered by Google Cloud AI</p>
      </footer>
    </div>
  );

  return (
    <Router>
      <Routes>
        {/* Ruta pública: Login */}
        <Route path="/login" element={<Login />} />

        {/* CORREGIDO: Ruta raíz redirige al dashboard */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          } 
        />

        {/* Ruta protegida: Dashboard (HOME) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />

        {/* Ruta protegida: Upload Documento */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <UploadDocumento />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />

        {/* Redirección por defecto para rutas no encontradas */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;