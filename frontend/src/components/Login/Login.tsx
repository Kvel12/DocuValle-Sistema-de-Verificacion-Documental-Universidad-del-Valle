// Importa React y el hook useState para manejar estados locales del componente
import React, { useState } from "react";

// Importa useNavigate de react-router-dom para cambiar de ruta de forma programática (sin recargar)
import { useNavigate } from "react-router-dom";

// Importa el archivo de estilos CSS para el formulario Login
import "./Login.css";

// Define la duración de la sesión en milisegundos (1 hora)
// Se usa para establecer cuándo expira la sesión simulada
const SESSION_DURATION_MS = 60 * 60 * 1000;

/**
 * Función para enviar la solicitud de inicio de sesión.
 * Aquí deberías reemplazar la llamada fakeLogin por una solicitud real a tu backend (fetch o axios).
 * Por ahora, solo simula una respuesta usando la función fakeLogin.
 *
 * @param email - Correo electrónico ingresado por el usuario
 * @param password - Contraseña ingresada por el usuario
 * @returns Promise<boolean> - true si las credenciales son correctas, false en caso contrario
 */
const loginRequest = async (email: string, password: string): Promise<boolean> => {
  return await fakeLogin(email, password);
};

/**
 * Función simulada para validar credenciales sin un backend real.
 * Comprueba si email y password coinciden con valores fijos.
 * Agrega un retraso de 1 segundo para simular el tiempo de respuesta de un servidor real.
 *
 * @param email - Correo ingresado
 * @param password - Contraseña ingresada
 * @returns Promise<boolean> - true si es correcto, false si no lo es
 */
const fakeLogin = async (email: string, password: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (email === "user@example.com" && password === "123456") {
        resolve(true);
      } else {
        resolve(false);
      }
    }, 1000); // Simula retardo de servidor
  });
};

// Declaración del componente funcional Login, tipado como React.FC (Functional Component)
const Login: React.FC = () => {
  // Estado local para almacenar el correo electrónico ingresado
  const [email, setEmail] = useState("");

  // Estado local para la contraseña ingresada
  const [password, setPassword] = useState("");

  // Estado local para mostrar mensajes de error si las credenciales no coinciden
  const [error, setError] = useState("");

  // useNavigate se usa para redirigir al usuario a otra ruta del SPA
  const navigate = useNavigate();

  /**
   * Maneja el envío del formulario de inicio de sesión.
   * Evita la recarga de página, limpia errores previos,
   * llama a loginRequest para verificar las credenciales,
   * guarda la sesión simulada en localStorage si es exitoso
   * y redirige al dashboard. Si falla, muestra mensaje de error.
   *
   * @param e - Evento de formulario
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Previene recarga completa de la página
    setError(""); // Limpia errores anteriores

    const success = await loginRequest(email, password); // Llama a la función de validación

    if (success) {
      // Si las credenciales son correctas, guarda una "sesión" simulada con fecha de expiración
      localStorage.setItem(
        "session",
        JSON.stringify({ expires: Date.now() + SESSION_DURATION_MS })
      );

      // Redirige al dashboard (puedes reemplazar window.location.href por navigate('/dashboard') si quieres SPA)
      window.location.href = "/dashboard";
    } else {
      // Si las credenciales son incorrectas, muestra mensaje de error
      setError("Credenciales incorrectas. Intenta nuevamente.");
    }
  };

  /**
   * Maneja la acción de cancelar o cerrar el formulario.
   * Usa navigate("/") para volver a la ruta principal (pantalla principal).
   */
  const handleCancel = () => {
    navigate("/"); // Redirige a la ruta raíz
  };

  /**
   * Estructura visual del formulario de login:
   * - Campos de entrada para email y contraseña
   * - Mensaje de error si las credenciales son inválidas
   * - Botón para enviar el formulario
   * - Botón ❌ (cerrar) para volver a la página principal
   */
  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        {/* Título del formulario */}
        <h2>Iniciar Sesión</h2>

        {/* Campo de entrada para el correo electrónico */}
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          placeholder="correo@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)} // Actualiza estado al escribir
          required
        />

        {/* Campo de entrada para la contraseña */}
        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)} // Actualiza estado al escribir
          required
        />

        {/* Mensaje de error si las credenciales no coinciden */}
        {error && <p className="error-message">{error}</p>}

        {/* Botón para enviar el formulario */}
        <button type="submit">Ingresar</button>

        {/* Botón ❌ para cancelar y volver a la pantalla principal */}
        <button
          type="button"
          className="close-button"
          onClick={handleCancel} // Llama a handleCancel al hacer clic
          aria-label="Cerrar"
        >
          ❌ Cerrar
        </button>
      </form>
    </div>
  );
};

// Exporta el componente para poder usarlo en App.tsx u otros módulos
export default Login;
