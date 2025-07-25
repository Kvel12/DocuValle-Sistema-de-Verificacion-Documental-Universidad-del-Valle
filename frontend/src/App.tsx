import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
        </header>
        <main className="App-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<UploadDocumento />} />
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