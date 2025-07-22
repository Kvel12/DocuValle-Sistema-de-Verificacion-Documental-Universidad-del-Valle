import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

// Duración de sesión (1 hora)
const SESSION_DURATION_MS = 60 * 60 * 1000;

// Simula petición real
const loginRequest = async (email: string, password: string): Promise<boolean> => {
  return await fakeLogin(email, password);
};

// Mock temporal
const fakeLogin = async (email: string, password: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (email === "admin@example.com" && password === "1234") {
        resolve(true);
      } else {
        resolve(false);
      }
    }, 1000);
  });
};

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const success = await loginRequest(email, password);

    if (success) {
      localStorage.setItem(
        "session",
        JSON.stringify({ expires: Date.now() + SESSION_DURATION_MS })
      );
      navigate("/"); // ✅ Redirige SIN recargar
    } else {
      setError("Credenciales incorrectas. Intenta nuevamente.");
    }
  };

  const handleCancel = () => {
    // Opcional: solo limpia campos en lugar de redirigir
    setEmail("");
    setPassword("");
    setError("");
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Iniciar Sesión</h2>

        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error-message">{error}</p>}

        <button type="submit">Ingresar</button>
        <button
          type="button"
          className="close-button"
          onClick={handleCancel}
          aria-label="Cerrar"
        >
          ❌
        </button>
      </form>
    </div>
  );
};

export default Login;
