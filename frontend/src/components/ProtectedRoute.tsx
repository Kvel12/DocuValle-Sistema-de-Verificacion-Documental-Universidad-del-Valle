import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = JSON.parse(localStorage.getItem("session") || "{}");
  const isValidSession = session.expires && session.expires > Date.now();

  if (!isValidSession) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
