import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UploadDocumento from './components/UploadDocumento';
import Dashboard from './components/Dashboard';
import './components/UploadDocumento.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
          <nav style={{ margin: '1rem 0' }}>
            <Link to="/" style={{ marginRight: '1.5rem' }}>Subir Documento</Link>
            <Link to="/dashboard">Dashboard</Link>
          </nav>
        </header>
        <main className="App-main">
          <Routes>
            <Route path="/" element={<UploadDocumento />} />
            <Route path="/dashboard" element={<Dashboard />} />
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