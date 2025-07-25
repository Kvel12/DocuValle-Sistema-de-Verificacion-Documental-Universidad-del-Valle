// Importa React para usar JSX y tipos de React
import React from "react";

// Importa Navigate de react-router-dom para redirigir rutas programáticamente
import { Navigate } from "react-router-dom";

// Define el componente funcional ProtectedRoute
// Este componente recibe un prop: `children` que representa los componentes hijos que se van a renderizar si la sesión es válida
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // Obtiene del localStorage el objeto `session` almacenado como string
  // Si no existe, usa "{}" para evitar errores al parsear
  const session = JSON.parse(localStorage.getItem("session") || "{}");

  // Verifica si la sesión es válida:
  // 1. Existe `expires`
  // 2. La fecha de expiración es mayor a la fecha y hora actual
  const isValidSession = session.expires && session.expires > Date.now();

  // Si la sesión NO es válida (no existe o ya expiró)
  if (!isValidSession) {
    // Redirige al usuario a la ruta de login
    // `replace` asegura que esta navegación reemplace la entrada actual del historial
    // evitando que el usuario vuelva atrás con el botón "Atrás"
    return <Navigate to="/login" replace />;
  }

  // Si la sesión es válida, renderiza los componentes hijos normalmente
  return <>{children}</>;
};

// Exporta el componente para poder usarlo en otras partes de la aplicación
export default ProtectedRoute;
