import React from 'react';
import UploadDocumento from './components/UploadDocumento';
import './components/UploadDocumento.css';
import './App.css';
import AdminUserManager from './components/AdminUserManager'; // Importing the AdminUserManager component


function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
        <p>Procesamiento inteligente de documentos con Google Cloud Vision API</p>
      </header>

      <AdminUserManager /> {/* Including the AdminUserManager component for admin user management */}
      <main className="App-main">
        <UploadDocumento />
      </main>

  
      <footer className="App-footer">
        <p>🏗️ DocuValle v1.0.0</p>
      </footer>
    </div>
  );
}

export default App;