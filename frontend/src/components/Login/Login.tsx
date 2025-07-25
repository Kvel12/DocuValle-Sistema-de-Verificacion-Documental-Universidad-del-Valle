// Importa React y useState para gestionar el estado interno del formulario
import React, { useState } from "react";

// Importa useNavigate de react-router-dom para redirigir rutas de forma programática
import { useNavigate } from "react-router-dom";

// Importa los estilos específicos del formulario de login
import "./Login.css";

// NUEVO: Importa el logo desde assets
import docuValleLogo from '../../assets/DocuValle.png';

// Duración de la sesión en milisegundos (1 hora)
const SESSION_DURATION_MS = 60 * 60 * 1000;

// Función simulada para enviar la solicitud de inicio de sesión
// Aquí podrías conectar una API real en producción
const loginRequest = async (email: string, password: string): Promise<boolean> => {
  return await fakeLogin(email, password);
};

// Mock temporal para simular la respuesta de un servidor
// Acepta solo el usuario admin@example.com con contraseña 1234
const fakeLogin = async (email: string, password: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (email === "admin@example.com" && password === "1234") {
        resolve(true); // Credenciales correctas
      } else {
        resolve(false); // Credenciales incorrectas
      }
    }, 1000); // Simula un retardo de red de 1 segundo
  });
};

// Componente funcional Login
const Login: React.FC = () => {
  // Estado para almacenar el correo electrónico introducido por el usuario
  const [email, setEmail] = useState("");

  // Estado para almacenar la contraseña introducida por el usuario
  const [password, setPassword] = useState("");

  // Estado para almacenar mensajes de error (credenciales incorrectas, etc.)
  const [error, setError] = useState("");

  // Estado para mostrar loading durante el proceso de login
  const [loading, setLoading] = useState(false);

  // Hook para redirigir a otra ruta sin recargar la página
  const navigate = useNavigate();

  // Función que se ejecuta cuando el usuario envía el formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Previene recargar la página
    setError(""); // Limpia errores previos
    setLoading(true); // Activa estado de carga

    try {
      // Intenta iniciar sesión usando la función simulada
      const success = await loginRequest(email, password);

      if (success) {
        // Si el login es exitoso, guarda la sesión en localStorage con fecha de expiración
        localStorage.setItem(
          "session",
          JSON.stringify({ expires: Date.now() + SESSION_DURATION_MS })
        );

        // CORREGIDO: Redirige al dashboard en lugar de "/"
        navigate("/dashboard"); // Redirige sin recargar la página
      } else {
        // Si las credenciales son incorrectas, muestra mensaje de error
        setError("Credenciales incorrectas. Intenta nuevamente.");
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false); // Desactiva estado de carga
    }
  };

  // Función para limpiar los campos del formulario si se cancela
  const handleCancel = () => {
    setEmail("");     // Limpia el email ingresado
    setPassword("");  // Limpia la contraseña ingresada
    setError("");     // Limpia mensaje de error si existía
  };

  return (
    <div className="login-container">
      {/* Formulario de inicio de sesión */}
      <form className="login-form" onSubmit={handleSubmit}>
        
        {/* NUEVO: Espacio para el ícono de la aplicación */}
        <div className="app-icon-container">
          <img 
            className="app-icon"
            alt="DocuValle logo"
            onError={(e) => {
              // Fallback en caso de que no se encuentre la imagen
              e.currentTarget.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.innerHTML = '📄';
              fallback.className = 'app-icon-fallback';
              fallback.style.fontSize = '5rem';
              fallback.style.marginBottom = '1rem';
              e.currentTarget.parentNode?.insertBefore(fallback, e.currentTarget);
            }}
            src={docuValleLogo}
          />
          <h1 className="app-title">DocuValle</h1>
          <p className="app-subtitle">Sistema de Análisis de Documentos</p>
        </div>

        <h2>Iniciar Sesión</h2>

        {/* Campo de email */}
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)} // Actualiza estado en cada tecla
          required
          disabled={loading}
        />

        {/* Campo de contraseña */}
        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)} // Actualiza estado
          required
          disabled={loading}
        />

        {/* Mensaje de error si las credenciales no son correctas */}
        {error && <p className="error-message">{error}</p>}

        {/* Botón para enviar el formulario */}
        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Verificando...
            </>
          ) : (
            'Ingresar'
          )}
        </button>

        {/* Botón opcional para limpiar campos */}
        <button
          type="button"
          className="close-button"
          onClick={handleCancel}
          disabled={loading}
          aria-label="Cerrar"
        >
          ❌ Limpiar Campos
        </button>

        {/* NUEVO: Información de credenciales de prueba */}
        <div className="demo-credentials">
          <p>🔑 <strong>Credenciales de prueba:</strong></p>
          <p>Email: admin@example.com</p>
          <p>Contraseña: 1234</p>
        </div>
      </form>
    </div>
  );
};

// Exporta el componente Login para usarlo en el Router principal
export default Login;