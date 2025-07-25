import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdministradoresProcesados from './Admin/AdministradoresProcesados';

// Configuración de API - ajusta según tu configuración
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
        
        {/* Sección de bienvenida y acciones principales */}
        <div className="welcome-section" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '2rem',
          marginBottom: '2rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            margin: '0 0 0.5rem 0', 
            fontSize: '2.2rem', 
            fontWeight: '700' 
          }}>
            ¡Bienvenido a DocuValle! 📄
          </h1>
          <p style={{ 
            margin: '0 0 2rem 0', 
            fontSize: '1.1rem', 
            opacity: 0.9 
          }}>
            Sistema inteligente de análisis y verificación de documentos
          </p>

          {/* Botón de acción principal */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center' 
          }}>
            <button
              onClick={() => navigate('/upload')}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                borderRadius: '15px',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: '200px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>📤</span>
              Analizar Documento
            </button>
          </div>
        </div>

        {/* Título del dashboard */}
        <h2 style={{ 
          color: '#333', 
          marginBottom: '2rem',
          fontSize: '1.8rem',
          fontWeight: '600'
        }}>
          📊 Dashboard Analítico
        </h2>

        {/* Placeholder para estadísticas futuras */}
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginBottom: '2rem'
        }}>
          <div style={{ 
            fontSize: '2rem', 
            marginBottom: '1rem' 
          }}>📈</div>
          <h3 style={{ 
            color: '#333', 
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '0.5rem'
          }}>
            Estadísticas del Sistema
          </h3>
          <p style={{ 
            color: '#666', 
            fontSize: '1rem',
            margin: 0
          }}>
            Las métricas y gráficos del sistema se mostrarán aquí próximamente
          </p>
        </div>
        
      </div>
      
      {/* NUEVA SECCIÓN: Gestión de Administradores */}
      <div style={{ 
        paddingBottom: '3rem',
        background: 'linear-gradient(135deg, #f8f9fc 0%, #eef2f7 100%)',
        paddingTop: '2rem'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem' }}>
          {/* Título de la sección */}
          <h2 style={{ 
            color: '#333', 
            marginBottom: '2rem',
            fontSize: '1.8rem',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            🔧 Gestión del Sistema
          </h2>

          {/* Contenedor para el componente de administradores - Centrado */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            margin: '0 auto',
            maxWidth: '600px'
          }}>
            {/* Componente de Administradores */}
            <div style={{
              width: '100%',
              maxWidth: '400px'
            }}>
              <AdministradoresProcesados 
                apiBaseUrl={API_BASE_URL}
                mostrarBotonAbrir={true}
                titulo="👨‍💼 Administradores del Sistema"
              />
            </div>
          </div>

          {/* Información adicional sobre la gestión */}
          <div style={{
            marginTop: '3rem',
            textAlign: 'center',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              color: '#495057',
              fontSize: '1.2rem',
              fontWeight: '600'
            }}>
              💡 Centro de Control de Administradores
            </h3>
            <p style={{ 
              margin: 0, 
              color: '#6c757d',
              fontSize: '1rem',
              lineHeight: '1.6'
            }}>
              Gestiona las cuentas de administradores del sistema DocuValle. Puedes crear nuevos 
              administradores, cambiar su estado (activo/inactivo) y eliminar cuentas cuando sea necesario.
            </p>
          </div>

          {/* Nota sobre funcionalidades adicionales */}
          <div style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            padding: '1rem',
            background: 'rgba(255, 193, 7, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 193, 7, 0.3)'
          }}>
            <p style={{ 
              margin: 0, 
              color: '#856404',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              📝 <strong>Nota:</strong> Las funcionalidades de gestión de documentos y estadísticas 
              avanzadas se integrarán en futuras actualizaciones del dashboard.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;