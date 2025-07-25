// Importa React y useState para gestionar el estado interno del formulario
import React, { useState } from "react";

// Importa useNavigate de react-router-dom para redirigir rutas de forma programática
import { useNavigate } from "react-router-dom";

// Importa axios para realizar llamadas HTTP
import axios from "axios";

// Importa los estilos específicos del formulario de login
import "./Login.css";

// NUEVO: Importa el logo desde assets
import docuValleLogo from '../../assets/DocuValle.png';

// Configuración de la API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Duración de la sesión en milisegundos (8 horas, igual que el JWT del backend)
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Interfaces para las respuestas de la API
interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  administrador?: {
    id: string;
    nombreAdmin: string;
    email: string;
    rol: string;
    estado: string;
  };
  error?: string;
}

// Función para realizar login con la API real
const loginRequest = async (email: string, password: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    console.log('🔐 Intentando login con API:', { email, apiUrl: API_BASE_URL });

    const response = await axios.post<LoginResponse>(`${API_BASE_URL}/api/auth/login`, {
      email: email.trim().toLowerCase(),
      password: password
    }, {
      timeout: 10000, // 10 segundos de timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success && response.data.token) {
      console.log('✅ Login exitoso con API');
      return {
        success: true,
        data: {
          token: response.data.token,
          administrador: response.data.administrador
        }
      };
    } else {
      console.log('❌ Login fallido:', response.data.message);
      return {
        success: false,
        error: response.data.message || 'Credenciales incorrectas'
      };
    }

  } catch (error: any) {
    console.error('❌ Error en login con API:', error);

    // Si hay error de conexión, intentar con credenciales de prueba
    if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      console.log('⚠️ Error de conexión, intentando con credenciales de prueba...');
      return await fakeLogin(email, password);
    }

    // Si es error de credenciales (401), mostrar mensaje específico
    if (error.response?.status === 401) {
      return {
        success: false,
        error: error.response.data?.message || 'Credenciales incorrectas'
      };
    }

    // Si es error de cuenta desactivada (403)
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Cuenta de administrador desactivada. Contacte al super administrador.'
      };
    }

    // Para otros errores, intentar con credenciales de prueba como fallback
    console.log('⚠️ Error desconocido, intentando con credenciales de prueba como fallback...');
    return await fakeLogin(email, password);
  }
};

// Mock temporal para simular la respuesta de un servidor (BACKUP/PRUEBAS)
// Acepta solo el usuario admin@example.com con contraseña 1234
const fakeLogin = async (email: string, password: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (email.toLowerCase().trim() === "admin@example.com" && password === "1234") {
        console.log('✅ Login exitoso con credenciales de prueba');
        resolve({
          success: true,
          data: {
            token: 'fake-jwt-token-for-testing',
            administrador: {
              id: 'test-admin-id',
              nombreAdmin: 'Administrador de Prueba',
              email: 'admin@example.com',
              rol: 'super_admin',
              estado: 'activo'
            }
          }
        });
      } else {
        console.log('❌ Credenciales de prueba incorrectas');
        resolve({
          success: false,
          error: 'Credenciales incorrectas. Verifique email y contraseña.'
        });
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

  // Estado para mostrar información sobre el modo de funcionamiento
  const [modoConexion, setModoConexion] = useState<'api' | 'prueba' | 'desconocido'>('desconocido');

  // Hook para redirigir a otra ruta sin recargar la página
  const navigate = useNavigate();

  // Función que se ejecuta cuando el usuario envía el formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Previene recargar la página
    setError(""); // Limpia errores previos
    setLoading(true); // Activa estado de carga
    setModoConexion('desconocido');

    try {
      // Intenta iniciar sesión usando la función que maneja API + fallback
      const result = await loginRequest(email, password);

      if (result.success && result.data) {
        // Determinar si se usó API real o credenciales de prueba
        if (result.data.token === 'fake-jwt-token-for-testing') {
          setModoConexion('prueba');
          console.log('🧪 Sesión iniciada con credenciales de prueba');
        } else {
          setModoConexion('api');
          console.log('🌐 Sesión iniciada con API real');
        }

        // Guardar sesión en localStorage con toda la información
        const sessionData = {
          token: result.data.token,
          administrador: result.data.administrador,
          expires: Date.now() + SESSION_DURATION_MS,
          loginTime: new Date().toISOString(),
          mode: result.data.token === 'fake-jwt-token-for-testing' ? 'prueba' : 'api'
        };

        localStorage.setItem("session", JSON.stringify(sessionData));

        // Mostrar mensaje de éxito breve antes de redirigir
        setTimeout(() => {
          navigate("/dashboard"); // Redirige al dashboard
        }, 500);

      } else {
        // Si las credenciales son incorrectas, mostrar mensaje de error
        setError(result.error || "Credenciales incorrectas. Intenta nuevamente.");
      }
    } catch (error) {
      console.error("Error inesperado en login:", error);
      setError("Error inesperado. Intenta nuevamente.");
    } finally {
      setLoading(false); // Desactiva estado de carga
    }
  };

  // Función para limpiar los campos del formulario si se cancela
  const handleCancel = () => {
    setEmail("");     // Limpia el email ingresado
    setPassword("");  // Limpia la contraseña ingresada
    setError("");     // Limpia mensaje de error si existía
    setModoConexion('desconocido');
  };

  // Función para auto-llenar credenciales de prueba
  const usarCredencialesPrueba = () => {
    setEmail("admin@example.com");
    setPassword("1234");
    setError("");
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

        {/* Indicador de modo de conexión */}
        {modoConexion !== 'desconocido' && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.85rem',
            textAlign: 'center',
            background: modoConexion === 'api' ? 
              'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)' : 
              'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            color: modoConexion === 'api' ? '#2e7d32' : '#e65100',
            border: modoConexion === 'api' ? '1px solid #4caf50' : '1px solid #ff9800'
          }}>
            {modoConexion === 'api' ? '🌐 Conectado con API real' : '🧪 Modo de prueba activo'}
          </div>
        )}

        {/* Campo de email */}
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          placeholder="ej: admin@docuvalle.com"
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
              {modoConexion === 'api' ? 'Verificando con API...' : 
               modoConexion === 'prueba' ? 'Verificando credenciales...' : 
               'Verificando...'}
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
          aria-label="Limpiar campos"
        >
          ❌ Limpiar Campos
        </button>

        {/* NUEVO: Información de credenciales de prueba */}
        <div className="demo-credentials">
          <p>🔑 <strong>Credenciales de prueba:</strong></p>
          <p>Email: admin@example.com</p>
          <p>Contraseña: 1234</p>
          <button
            type="button"
            onClick={usarCredencialesPrueba}
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            🚀 Usar Credenciales de Prueba
          </button>
        </div>

        {/* NUEVO: Información del sistema */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          fontSize: '0.8rem',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>🔧 Sistema de Autenticación Híbrido</strong>
          </p>
          <p style={{ margin: 0 }}>
            Conecta automáticamente con la API real o usa credenciales de prueba como fallback
          </p>
        </div>
      </form>
    </div>
  );
};

// Exporta el componente Login para usarlo en el Router principal
export default Login;