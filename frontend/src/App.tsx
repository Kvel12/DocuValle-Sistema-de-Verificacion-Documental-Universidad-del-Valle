import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import UploadDocumento from "./components/UploadDocumento";
import Login from "./components/Login/Login";
import ProtectedRoute from "./components/ProtectedRoute";

import "./components/UploadDocumento.css";
import "./App.css";

function App() {

  React.useEffect(() => {
    localStorage.clear();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Ruta de login */}
        <Route path="/login" element={<Login />} />

        {/* Ruta raíz protegida */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div className="App">
                <header className="App-header">
                  <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
                  <p>
                    Procesamiento inteligente de documentos con Google Cloud
                    Vision API
                  </p>
                </header>

                <main className="App-main">
                  <UploadDocumento />
                </main>

                <footer className="App-footer">
                  <p>🏗️ DocuValle v1.0.0</p>
                </footer>
              </div>
            </ProtectedRoute>
          }
        />

        {/* ⚡ Ruta default: redirige todo lo demás a login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
