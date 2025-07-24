import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

import UploadDocumento from "./components/UploadDocumento";
import "./components/UploadDocumento.css";
import Login from "./components/Login/Login"; // Asegúrate de tenerlo en esta ruta
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
          <p>Procesamiento inteligente de documentos con Google Cloud Vision API</p>

          {/*  Aquí va el botón Login */}
          <Link to="/login" className="login-button">
            Login
          </Link>
        </header>

        <main className="App-main">
          <Routes>
            {/* Ruta principal */}
            <Route path="/" element={<UploadDocumento />} />

            {/* Ruta para el formulario de Login */}
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>

        <footer className="App-footer">
          <p>🏗️ DocuValle v1.0.0</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
