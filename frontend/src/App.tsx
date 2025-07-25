import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

  // Layout que agrupa el header, footer y botón logout
  const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="App">
      <header className="App-header">
        <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
        <p>Procesamiento inteligente de documentos con Google Cloud Vision API</p>
        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </header>

      <main className="App-main">{children}</main>

      <footer className="App-footer">
        <p>🏗️ DocuValle v1.0.0</p>
      </footer>
    </div>
  );

  return (
    <Router>
      <Routes>

        {/* Ruta pública: Login */}
        <Route path="/login" element={<Login />} />

        {/* Ruta protegida: Dashboard */}
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

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
