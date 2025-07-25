// Importa React para poder usar JSX y componentes funcionales
import React from "react";

// Importa componentes y funciones de react-router-dom para manejar rutas
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";

// Importa el componente que se encarga de subir documentos
import UploadDocumento from "./components/UploadDocumento";

// Importa el componente de Login
import Login from "./components/Login/Login";

// Importa un componente que protege rutas, validando si el usuario tiene acceso
import ProtectedRoute from "./components/ProtectedRoute";

// Importa estilos específicos del componente UploadDocumento
import "./components/UploadDocumento.css";

// Importa estilos generales de la aplicación
import "./App.css";

// Importa el componente que maneja la gestión de usuarios administradores
import CreateAdminUser from './components/Admin/CreateAdminUser';

import { Link } from 'react-router-dom';

// Componente principal de la aplicación
function App() {

  // Función que maneja el evento de cerrar sesión cuando el usuario hace clic en el botón Logout
  const handleLogout = () => {
    // Muestra una ventana emergente para confirmar si el usuario realmente quiere cerrar sesión
    const confirmed = window.confirm("¿Estás seguro de cerrar sesión?");

    if (confirmed) {
      // Si confirma, se borran todos los datos almacenados en localStorage (sesión, tokens, etc.)
      localStorage.clear();

      // Después de limpiar la sesión, redirige al usuario a la página de Login
      window.location.href = "/login";
    }
    // Si el usuario cancela, no se hace nada y permanece en la página actual
  };

  const NavigateButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <button
        onClick={() => navigate("/crear-admin")}
        className="bg-white text-purple-700 text-2xl font-bold px-8 py-4 rounded-xl shadow-lg border-2 border-purple-700 hover:bg-purple-100 transition-all duration-200"
      >
        Gestión de Usuarios
      </button>
    </div>
  );
};

  return (
    // Router envuelve toda la aplicación para habilitar la navegación entre rutas
    <Router>
      {/* Routes define todas las rutas posibles de la app */}
      <Routes>

        {/* Ruta específica para mostrar la pantalla de Login */}
        <Route path="/login" element={<Login />} />

        {/* Ruta principal "/" que está protegida mediante el componente ProtectedRoute */}
        <Route
          path="/"
          element={
            // ProtectedRoute valida si el usuario está autenticado antes de renderizar su contenido hijo
            <ProtectedRoute>
              <div className="App">
                {/* Header del sitio, muestra el título, descripción y botón de Logout */}
                <header className="App-header">
                  <h1>🚀 DocuValle - Sistema de Análisis de Documentos</h1>
                  <p>
                    Procesamiento inteligente de documentos con Google Cloud
                    Vision API
                  </p>

                  {/* Botón para cerrar sesión, llama a handleLogout cuando se hace clic */}
                  <button className="logout-button" onClick={handleLogout}>
                    Logout
                  </button>
                </header>

                {/* Main: aquí se carga el componente que permite subir documentos */}
                <main className="App-main">
                  <UploadDocumento />

                  <NavigateButton />
                </main>
  
                {/* Footer del sitio con información de versión */}
                <footer className="App-footer">
                  <p>🏗️ DocuValle v1.0.0</p>
                </footer>
              </div>
            </ProtectedRoute>
          }
        />

        {/* Ruta por defecto: si el usuario entra a una ruta no definida, redirige a Login */}
        <Route path="*" element={<Navigate to="/login" />} />

        {/* Ruta protegida para crear admin */}
        <Route
          path="/crear-admin"
          element={
            <ProtectedRoute>
              <div className="App">
                <main className="App-main">
                  <CreateAdminUser />
                </main>
                <footer className="App-footer">
                  <p>🏗️ DocuValle v1.0.0</p>
                </footer>
              </div>
            </ProtectedRoute>
          }
        />

      </Routes>
    </Router>
  );
}

// Exporta el componente App para que pueda ser usado en index.js o donde se necesite
export default App;
