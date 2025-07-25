import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Interfaces
interface Administrador {
  id: string;
  nombreAdmin: string;
  email: string;
  rol: string;
  fechaCreacion: string;
  fechaUltimoAcceso?: string | null;
  estado: string;
}

interface AdministradoresProcesadosProps {
  apiBaseUrl?: string;
  mostrarBotonAbrir?: boolean;
  titulo?: string;
  onAdministradorSeleccionado?: (administrador: Administrador) => void;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AdministradoresProcesados: React.FC<AdministradoresProcesadosProps> = ({
  apiBaseUrl = API_BASE_URL,
  mostrarBotonAbrir = true,
  titulo = '👨‍💼 Administradores del Sistema',
  onAdministradorSeleccionado
}) => {
  // Estados principales
  const [mostrarModal, setMostrarModal] = useState(false);
  const [administradores, setAdministradores] = useState<Administrador[]>([]);
  const [cargandoAdministradores, setCargandoAdministradores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Estados para crear administrador
  const [nuevoAdmin, setNuevoAdmin] = useState({
    nombreAdmin: '',
    email: '',
    rol: 'administrador',
    password: '',
    generarPasswordAutomatica: true
  });
  const [mostrarCrearAdmin, setMostrarCrearAdmin] = useState(false);
  const [creandoAdmin, setCreandoAdmin] = useState(false);
  const [passwordGenerada, setPasswordGenerada] = useState<string | null>(null);

  // Estados para actualizar estado
  const [adminSeleccionado, setAdminSeleccionado] = useState<Administrador | null>(null);
  const [mostrarModalEstado, setMostrarModalEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<'activo' | 'inactivo'>('activo');
  const [actualizandoEstado, setActualizandoEstado] = useState(false);

  // Estados para eliminar
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [eliminandoAdmin, setEliminandoAdmin] = useState(false);

  // Estados para cambiar contraseña
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  const [datosPassword, setDatosPassword] = useState({
    nuevaPassword: '',
    confirmarPassword: '',
    passwordActual: ''
  });
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [mostrarPasswords, setMostrarPasswords] = useState({
    nueva: false,
    confirmar: false,
    actual: false
  });

  // Estados para resetear contraseña
  const [mostrarModalReset, setMostrarModalReset] = useState(false);
  const [reseteandoPassword, setReseteandoPassword] = useState(false);
  const [passwordReseteada, setPasswordReseteada] = useState<string | null>(null);

  // Estados para migración
  const [mostrarModalMigracion, setMostrarModalMigracion] = useState(false);
  const [migrandoPasswords, setMigrandoPasswords] = useState(false);
  const [resultadoMigracion, setResultadoMigracion] = useState<any>(null);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const adminsPorPagina = 10;

  // Cargar administradores al abrir el modal
  useEffect(() => {
    if (mostrarModal) {
      cargarAdministradores();
    }
  }, [mostrarModal]);

  // Función para mostrar mensajes de error
  const mostrarError = (mensaje: string) => {
    setError(mensaje);
    setMensajeExito(null);
    setTimeout(() => setError(null), 5000);
  };

  // Función para mostrar mensajes de éxito
  const mostrarExito = (mensaje: string) => {
    setMensajeExito(mensaje);
    setError(null);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  // Función para cargar administradores
  const cargarAdministradores = async () => {
    setCargandoAdministradores(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/admins/list`);
      if (response.data.success) {
        setAdministradores(response.data.administradores);
        console.log('✅ Administradores cargados:', response.data.administradores.length);
      }
    } catch (error) {
      console.error('❌ Error cargando administradores:', error);
      mostrarError('Error cargando lista de administradores');
    } finally {
      setCargandoAdministradores(false);
    }
  };

  // Función para crear administrador
  const crearAdministrador = async () => {
    if (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim()) {
      mostrarError('El nombre y email del administrador son obligatorios');
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(nuevoAdmin.email.trim())) {
      mostrarError('Por favor ingrese un email válido');
      return;
    }

    // Validar contraseña si no es automática
    if (!nuevoAdmin.generarPasswordAutomatica) {
      if (!nuevoAdmin.password.trim() || nuevoAdmin.password.length < 6) {
        mostrarError('La contraseña debe tener al menos 6 caracteres');
        return;
      }
    }

    setCreandoAdmin(true);
    try {
      const datosCreacion: any = {
        nombreAdmin: nuevoAdmin.nombreAdmin.trim(),
        email: nuevoAdmin.email.trim(),
        rol: nuevoAdmin.rol
      };

      // Solo incluir password si no es automática
      if (!nuevoAdmin.generarPasswordAutomatica && nuevoAdmin.password.trim()) {
        datosCreacion.password = nuevoAdmin.password.trim();
      }

      const response = await axios.post(`${apiBaseUrl}/api/admins/create-or-get`, datosCreacion);

      if (response.data.success) {
        if (response.data.esNuevo) {
          mostrarExito(`✅ Administrador "${nuevoAdmin.nombreAdmin}" creado exitosamente`);
          
          // Mostrar contraseña temporal si fue generada automáticamente
          if (response.data.passwordTemporal) {
            setPasswordGenerada(response.data.passwordTemporal);
          }
        } else {
          mostrarExito(`ℹ️ Administrador "${nuevoAdmin.nombreAdmin}" ya existía`);
        }
        
        // Recargar administradores y limpiar formulario
        await cargarAdministradores();
        setNuevoAdmin({ 
          nombreAdmin: '', 
          email: '', 
          rol: 'administrador', 
          password: '', 
          generarPasswordAutomatica: true 
        });
        setMostrarCrearAdmin(false);
      }
    } catch (error: any) {
      console.error('❌ Error creando administrador:', error);
      const mensajeError = error.response?.data?.message || 'Error creando administrador';
      mostrarError(mensajeError);
    } finally {
      setCreandoAdmin(false);
    }
  };

  // Función para actualizar estado
  const actualizarEstadoAdmin = async () => {
    if (!adminSeleccionado) return;

    setActualizandoEstado(true);
    try {
      const response = await axios.put(`${apiBaseUrl}/api/admins/${adminSeleccionado.id}/update-status`, {
        estado: nuevoEstado
      });

      if (response.data.success) {
        mostrarExito(`✅ Estado actualizado a: ${nuevoEstado}`);
        setMostrarModalEstado(false);
        await cargarAdministradores();
      }
    } catch (error: any) {
      console.error('❌ Error actualizando estado:', error);
      const mensajeError = error.response?.data?.message || 'Error actualizando estado';
      mostrarError(mensajeError);
    } finally {
      setActualizandoEstado(false);
    }
  };

  // Función para cambiar contraseña
  const cambiarPassword = async () => {
    if (!adminSeleccionado) return;

    if (!datosPassword.nuevaPassword || datosPassword.nuevaPassword.length < 6) {
      mostrarError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (datosPassword.nuevaPassword !== datosPassword.confirmarPassword) {
      mostrarError('Las contraseñas no coinciden');
      return;
    }

    setCambiandoPassword(true);
    try {
      const response = await axios.put(`${apiBaseUrl}/api/admins/${adminSeleccionado.id}/change-password`, {
        nuevaPassword: datosPassword.nuevaPassword,
        passwordActual: datosPassword.passwordActual || undefined
      });

      if (response.data.success) {
        mostrarExito('✅ Contraseña actualizada exitosamente');
        setMostrarModalPassword(false);
        setDatosPassword({ nuevaPassword: '', confirmarPassword: '', passwordActual: '' });
      }
    } catch (error: any) {
      console.error('❌ Error cambiando contraseña:', error);
      const mensajeError = error.response?.data?.message || 'Error cambiando contraseña';
      mostrarError(mensajeError);
    } finally {
      setCambiandoPassword(false);
    }
  };

  // Función para resetear contraseña
  const resetearPassword = async () => {
    if (!adminSeleccionado) return;

    setReseteandoPassword(true);
    try {
      const response = await axios.put(`${apiBaseUrl}/api/admins/${adminSeleccionado.id}/reset-password`);

      if (response.data.success) {
        setPasswordReseteada(response.data.passwordTemporal);
        mostrarExito('✅ Contraseña reseteada exitosamente');
        // No cerrar el modal aún para mostrar la nueva contraseña
      }
    } catch (error: any) {
      console.error('❌ Error reseteando contraseña:', error);
      const mensajeError = error.response?.data?.message || 'Error reseteando contraseña';
      mostrarError(mensajeError);
    } finally {
      setReseteandoPassword(false);
    }
  };

  // Función para migrar contraseñas
  const migrarPasswords = async () => {
    setMigrandoPasswords(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/api/admins/migrate-passwords`);

      if (response.data.success) {
        setResultadoMigracion(response.data);
        mostrarExito(`✅ Migración completada: ${response.data.adminsMigrados} administradores`);
        await cargarAdministradores();
      }
    } catch (error: any) {
      console.error('❌ Error en migración:', error);
      const mensajeError = error.response?.data?.message || 'Error en migración';
      mostrarError(mensajeError);
    } finally {
      setMigrandoPasswords(false);
    }
  };

  // Función para eliminar administrador
  const eliminarAdministrador = async () => {
    if (!adminSeleccionado) return;

    setEliminandoAdmin(true);
    try {
      const response = await axios.delete(`${apiBaseUrl}/api/admins/${adminSeleccionado.id}`);

      if (response.data.success) {
        mostrarExito(`✅ Administrador "${adminSeleccionado.nombreAdmin}" eliminado exitosamente`);
        setMostrarModalEliminar(false);
        await cargarAdministradores();
      }
    } catch (error: any) {
      console.error('❌ Error eliminando administrador:', error);
      const mensajeError = error.response?.data?.message || 'Error eliminando administrador';
      mostrarError(mensajeError);
    } finally {
      setEliminandoAdmin(false);
    }
  };

  // Funciones de paginación
  const calcularPaginacion = () => {
    const totalPaginas = Math.ceil(administradores.length / adminsPorPagina);
    const inicio = (paginaActual - 1) * adminsPorPagina;
    const fin = inicio + adminsPorPagina;
    const adminsPaginados = administradores.slice(inicio, fin);

    return {
      totalPaginas,
      adminsPaginados,
      inicio: inicio + 1,
      fin: Math.min(fin, administradores.length),
      total: administradores.length
    };
  };

  const cambiarPagina = (nuevaPagina: number) => {
    const { totalPaginas } = calcularPaginacion();
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaActual(nuevaPagina);
    }
  };

  // Componente de navegación de páginas
  const NavegacionPaginas = () => {
    const { totalPaginas, inicio, fin, total } = calcularPaginacion();

    if (totalPaginas <= 1) return null;

    const generarNumerosPagina = () => {
      const numeros = [];
      const maxVisible = 5;
      let inicioNumeros = Math.max(1, paginaActual - 2);
      let finNumeros = Math.min(totalPaginas, inicioNumeros + maxVisible - 1);

      if (finNumeros - inicioNumeros < maxVisible - 1) {
        inicioNumeros = Math.max(1, finNumeros - maxVisible + 1);
      }

      for (let i = inicioNumeros; i <= finNumeros; i++) {
        numeros.push(i);
      }

      return numeros;
    };

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '20px',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: '12px',
        border: '1px solid #dee2e6'
      }}>
        {/* Información de registros */}
        <div style={{ fontSize: '0.9rem', color: '#6c757d', fontWeight: '500' }}>
          Mostrando {inicio} - {fin} de {total} administradores
        </div>

        {/* Navegación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Botón Primera página */}
          <button
            onClick={() => cambiarPagina(1)}
            disabled={paginaActual === 1}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              background: paginaActual === 1 ? '#f8f9fa' : 'white',
              color: paginaActual === 1 ? '#6c757d' : '#495057',
              cursor: paginaActual === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            title="Primera página"
          >
            ⏮️
          </button>

          {/* Botón Anterior */}
          <button
            onClick={() => cambiarPagina(paginaActual - 1)}
            disabled={paginaActual === 1}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              background: paginaActual === 1 ? '#f8f9fa' : 'white',
              color: paginaActual === 1 ? '#6c757d' : '#495057',
              cursor: paginaActual === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            title="Página anterior"
          >
            ◀️ Anterior
          </button>

          {/* Números de página */}
          {generarNumerosPagina().map(numero => (
            <button
              key={numero}
              onClick={() => cambiarPagina(numero)}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: numero === paginaActual ? 
                  'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)' : 'white',
                color: numero === paginaActual ? 'white' : '#495057',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: numero === paginaActual ? '600' : '500',
                minWidth: '36px',
                transition: 'all 0.2s ease',
                boxShadow: numero === paginaActual ? '0 2px 8px rgba(33, 150, 243, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (numero !== paginaActual) {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (numero !== paginaActual) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              {numero}
            </button>
          ))}

          {/* Botón Siguiente */}
          <button
            onClick={() => cambiarPagina(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              background: paginaActual === totalPaginas ? '#f8f9fa' : 'white',
              color: paginaActual === totalPaginas ? '#6c757d' : '#495057',
              cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            title="Página siguiente"
          >
            Siguiente ▶️
          </button>

          {/* Botón Última página */}
          <button
            onClick={() => cambiarPagina(totalPaginas)}
            disabled={paginaActual === totalPaginas}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              background: paginaActual === totalPaginas ? '#f8f9fa' : 'white',
              color: paginaActual === totalPaginas ? '#6c757d' : '#495057',
              cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            title="Última página"
          >
            ⏭️
          </button>
        </div>
      </div>
    );
  };

  // Función para abrir modal de estado
  const abrirModalEstado = (admin: Administrador) => {
    setAdminSeleccionado(admin);
    setNuevoEstado(admin.estado === 'activo' ? 'inactivo' : 'activo');
    setMostrarModalEstado(true);
  };

  // Función para abrir modal de eliminar
  const abrirModalEliminar = (admin: Administrador) => {
    setAdminSeleccionado(admin);
    setMostrarModalEliminar(true);
  };

  // Función para abrir modal de contraseña
  const abrirModalPassword = (admin: Administrador) => {
    setAdminSeleccionado(admin);
    setDatosPassword({ nuevaPassword: '', confirmarPassword: '', passwordActual: '' });
    setMostrarModalPassword(true);
  };

  // Función para abrir modal de reset
  const abrirModalReset = (admin: Administrador) => {
    setAdminSeleccionado(admin);
    setPasswordReseteada(null);
    setMostrarModalReset(true);
  };

  // Función para obtener el color del estado
  const getEstadoColor = (estado: string): string => {
    return estado === 'activo' ? '#4caf50' : '#f44336';
  };

  // Función para copiar al portapapeles
  const copiarAlPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      mostrarExito('✅ Contraseña copiada al portapapeles');
    }).catch(() => {
      mostrarError('❌ Error copiando al portapapeles');
    });
  };

  return (
    <>
      {/* Botón para abrir modal (opcional) */}
      {mostrarBotonAbrir && (
        <div style={{ margin: '32px 0 0 0', textAlign: 'center' }}>
          <button
            style={{
              background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setMostrarModal(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(156, 39, 176, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(156, 39, 176, 0.3)';
            }}
          >
            👨‍💼 Gestionar Administradores
          </button>
        </div>
      )}

      {/* Modal principal */}
      {mostrarModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            width: '95vw',
            maxWidth: '1400px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
          }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              borderBottom: '2px solid #f0f0f0',
              paddingBottom: '16px'
            }}>
              <h2 style={{ 
                margin: 0, 
                color: '#333',
                fontSize: '1.5rem',
                fontWeight: '700'
              }}>
                {titulo}
              </h2>
              <button
                onClick={() => setMostrarModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = '#666';
                }}
              >
                ✕
              </button>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div style={{
                background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                border: '1px solid #f44336',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#c62828',
                fontSize: '0.9rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#c62828',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Mensaje de éxito */}
            {mensajeExito && (
              <div style={{
                background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
                border: '1px solid #4caf50',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#2e7d32',
                fontSize: '0.9rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{mensajeExito}</span>
                <button
                  onClick={() => setMensajeExito(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2e7d32',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Mostrar contraseña generada */}
            {passwordGenerada && (
              <div style={{
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                border: '2px solid #ff9800',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                color: '#e65100'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#e65100', fontWeight: '600' }}>
                  🔑 Contraseña Temporal Generada
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <code style={{
                    background: 'rgba(230, 81, 0, 0.1)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    border: '1px solid rgba(230, 81, 0, 0.3)',
                    flex: 1
                  }}>
                    {passwordGenerada}
                  </code>
                  <button
                    onClick={() => copiarAlPortapapeles(passwordGenerada)}
                    style={{
                      background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    📋 Copiar
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>
                  ⚠️ Guarde esta contraseña de forma segura. El administrador deberá cambiarla en su primer acceso.
                </p>
                <button
                  onClick={() => setPasswordGenerada(null)}
                  style={{
                    marginTop: '12px',
                    background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  ✕ Cerrar
                </button>
              </div>
            )}

            {/* Controles */}
            <div style={{
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                color: '#495057',
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                🔧 Gestión de Administradores
              </h3>
              
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={cargarAdministradores}
                  disabled={cargandoAdministradores}
                  style={{
                    background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: cargandoAdministradores ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: cargandoAdministradores ? 0.7 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {cargandoAdministradores ? '🔄 Cargando...' : '🔄 Recargar'}
                </button>

                <button
                  onClick={() => {
                    if (mostrarCrearAdmin) {
                      setNuevoAdmin({ 
                        nombreAdmin: '', 
                        email: '', 
                        rol: 'administrador', 
                        password: '', 
                        generarPasswordAutomatica: true 
                      });
                      setPasswordGenerada(null);
                    }
                    setMostrarCrearAdmin(!mostrarCrearAdmin);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {mostrarCrearAdmin ? '❌ Cancelar' : '➕ Nuevo Administrador'}
                </button>

                <button
                  onClick={() => setMostrarModalMigracion(true)}
                  style={{
                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  🔑 Migrar Contraseñas
                </button>

                <span style={{ 
                  fontSize: '0.9rem', 
                  color: '#6c757d', 
                  padding: '8px 12px',
                  background: 'rgba(108, 117, 125, 0.1)',
                  borderRadius: '6px',
                  fontWeight: '500'
                }}>
                  📊 Total: {administradores.length} administradores
                </span>
              </div>

              {/* Formulario para crear administrador */}
              {mostrarCrearAdmin && (
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid #9c27b0',
                  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.15)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 16px 0', 
                    color: '#7b1fa2',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}>
                    ➕ Crear Nuevo Administrador
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontWeight: '500', 
                        color: '#495057',
                        fontSize: '0.9rem'
                      }}>
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: María García López"
                        value={nuevoAdmin.nombreAdmin}
                        onChange={(e) => setNuevoAdmin(prev => ({ ...prev, nombreAdmin: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '2px solid #dee2e6',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          transition: 'border-color 0.3s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#9c27b0'}
                        onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontWeight: '500', 
                        color: '#495057',
                        fontSize: '0.9rem'
                      }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        placeholder="ej: maria.garcia@empresa.com"
                        value={nuevoAdmin.email}
                        onChange={(e) => setNuevoAdmin(prev => ({ ...prev, email: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '2px solid #dee2e6',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          transition: 'border-color 0.3s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#9c27b0'}
                        onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontWeight: '500', 
                        color: '#495057',
                        fontSize: '0.9rem'
                      }}>
                        Rol
                      </label>
                      <select
                        value={nuevoAdmin.rol}
                        onChange={(e) => setNuevoAdmin(prev => ({ ...prev, rol: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '2px solid #dee2e6',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          transition: 'border-color 0.3s ease',
                          boxSizing: 'border-box',
                          background: 'white'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#9c27b0'}
                        onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                      >
                        <option value="administrador">Administrador</option>
                        <option value="super_admin">Super Administrador</option>
                        <option value="moderador">Moderador</option>
                      </select>
                    </div>
                  </div>

                  {/* Configuración de contraseña */}
                  <div style={{ marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 12px 0', color: '#495057', fontSize: '0.9rem' }}>
                      🔐 Configuración de Contraseña
                    </h5>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={nuevoAdmin.generarPasswordAutomatica}
                          onChange={(e) => setNuevoAdmin(prev => ({ 
                            ...prev, 
                            generarPasswordAutomatica: e.target.checked,
                            password: e.target.checked ? '' : prev.password
                          }))}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#495057' }}>
                          Generar contraseña temporal automáticamente (recomendado)
                        </span>
                      </label>
                    </div>

                    {!nuevoAdmin.generarPasswordAutomatica && (
                      <div>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '6px', 
                          fontWeight: '500', 
                          color: '#495057',
                          fontSize: '0.9rem'
                        }}>
                          Contraseña personalizada (mínimo 6 caracteres)
                        </label>
                        <input
                          type="password"
                          placeholder="Ingrese contraseña personalizada"
                          value={nuevoAdmin.password}
                          onChange={(e) => setNuevoAdmin(prev => ({ ...prev, password: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            border: '2px solid #dee2e6',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            transition: 'border-color 0.3s ease',
                            boxSizing: 'border-box'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#9c27b0'}
                          onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setMostrarCrearAdmin(false);
                        setNuevoAdmin({ 
                          nombreAdmin: '', 
                          email: '', 
                          rol: 'administrador', 
                          password: '', 
                          generarPasswordAutomatica: true 
                        });
                        setPasswordGenerada(null);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      ❌ Cancelar
                    </button>
                    <button
                      onClick={crearAdministrador}
                      disabled={!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || 
                               (!nuevoAdmin.generarPasswordAutomatica && !nuevoAdmin.password.trim()) || 
                               creandoAdmin}
                      style={{
                        background: (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || 
                                   (!nuevoAdmin.generarPasswordAutomatica && !nuevoAdmin.password.trim()) || 
                                   creandoAdmin) ? 
                          'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                          'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontWeight: '600',
                        cursor: (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || 
                                (!nuevoAdmin.generarPasswordAutomatica && !nuevoAdmin.password.trim()) || 
                                creandoAdmin) ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        opacity: (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || 
                                 (!nuevoAdmin.generarPasswordAutomatica && !nuevoAdmin.password.trim()) || 
                                 creandoAdmin) ? 0.7 : 1,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {creandoAdmin ? '⏳ Creando...' : '✅ Crear Administrador'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tabla de administradores */}
            <div style={{ overflowX: 'auto' }}>
              {cargandoAdministradores ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #9c27b0',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }}></div>
                  <p>Cargando administradores...</p>
                </div>
              ) : administradores.length > 0 ? (
                <>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: 'white',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Administrador
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Email
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Rol
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Estado
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Último Acceso
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcularPaginacion().adminsPaginados.map((admin, index) => (
                        <tr 
                          key={admin.id} 
                          style={{ 
                            borderBottom: '1px solid #dee2e6',
                            background: index % 2 === 0 ? 'white' : '#f8f9fa',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e3f2fd'}
                          onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8f9fa'}
                        >
                          <td style={{ padding: '12px' }}>
                            <div>
                              <p style={{ 
                                margin: '0 0 4px 0', 
                                fontWeight: '500', 
                                color: '#333', 
                                fontSize: '0.9rem'
                              }}>
                                {admin.nombreAdmin}
                              </p>
                              <p style={{ 
                                margin: 0, 
                                fontSize: '0.8rem', 
                                color: '#6c757d'
                              }}>
                                ID: {admin.id.substring(0, 8)}...
                              </p>
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.9rem', color: '#333' }}>
                            {admin.email}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              borderRadius: '12px',
                              background: admin.rol === 'super_admin' ? '#e1f5fe' :
                                         admin.rol === 'administrador' ? '#f3e5f5' : '#fff3e0',
                              color: admin.rol === 'super_admin' ? '#0277bd' :
                                     admin.rol === 'administrador' ? '#7b1fa2' : '#e65100',
                              border: `1px solid ${admin.rol === 'super_admin' ? '#0277bd40' :
                                                  admin.rol === 'administrador' ? '#7b1fa240' : '#e6510040'}`
                            }}>
                              {admin.rol === 'super_admin' ? '👑 Super Admin' :
                               admin.rol === 'administrador' ? '👨‍💼 Admin' : '👮 Moderador'}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              borderRadius: '12px',
                              background: admin.estado === 'activo' ? '#e8f5e8' : '#ffebee',
                              color: getEstadoColor(admin.estado),
                              border: `1px solid ${getEstadoColor(admin.estado)}40`
                            }}>
                              {admin.estado === 'activo' ? '✅ Activo' : '❌ Inactivo'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.8rem', color: '#6c757d' }}>
                            {admin.fechaUltimoAcceso ? 
                              new Date(admin.fechaUltimoAcceso).toLocaleDateString() : 
                              'Nunca'
                            }
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => abrirModalEstado(admin)}
                                style={{
                                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Cambiar estado"
                              >
                                🔄
                              </button>
                              
                              <button
                                onClick={() => abrirModalPassword(admin)}
                                style={{
                                  background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Cambiar contraseña"
                              >
                                🔐
                              </button>

                              <button
                                onClick={() => abrirModalReset(admin)}
                                style={{
                                  background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Resetear contraseña"
                              >
                                🔄
                              </button>
                              
                              <button
                                onClick={() => abrirModalEliminar(admin)}
                                style={{
                                  background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Eliminar administrador"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Navegación de páginas */}
                  <NavegacionPaginas />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👨‍💼</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#495057' }}>No hay administradores registrados</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Crea el primer administrador para comenzar
                  </p>
                </div>
              )}
            </div>

            {/* Información adicional */}
            {administradores.length > 0 && (
              <div style={{ 
                marginTop: '20px', 
                textAlign: 'center', 
                fontSize: '0.9rem', 
                color: '#6c757d',
                padding: '12px',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '8px'
              }}>
                📊 Total: {administradores.length} administradores registrados
                {calcularPaginacion().totalPaginas > 1 && (
                  <>
                    {' | '}Página {paginaActual} de {calcularPaginacion().totalPaginas}
                    {' | '}Mostrando {calcularPaginacion().inicio}-{calcularPaginacion().fin}
                  </>
                )}
                <br />
                <small style={{ color: '#6c757d' }}>
                  🔐 Sistema de autenticación con contraseñas habilitado | Última actualización: {new Date().toLocaleTimeString()}
                </small>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de cambiar estado */}
      {mostrarModalEstado && adminSeleccionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#333', 
              textAlign: 'center',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              🔄 Cambiar Estado del Administrador
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#495057' }}>
                <strong>Administrador:</strong> {adminSeleccionado.nombreAdmin}
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#495057' }}>
                <strong>Email:</strong> {adminSeleccionado.email}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
                <strong>Estado actual:</strong> 
                <span style={{ 
                  marginLeft: '8px',
                  color: getEstadoColor(adminSeleccionado.estado),
                  fontWeight: '700'
                }}>
                  {adminSeleccionado.estado}
                </span>
              </p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500', 
                color: '#495057',
                fontSize: '0.9rem'
              }}>
                Nuevo Estado
              </label>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value as 'activo' | 'inactivo')}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  background: 'white',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff9800'}
                onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setMostrarModalEstado(false)}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={actualizarEstadoAdmin}
                disabled={actualizandoEstado}
                style={{
                  background: actualizandoEstado ? 
                    'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                    'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: actualizandoEstado ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {actualizandoEstado ? '⏳ Actualizando...' : '✅ Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cambiar contraseña */}
      {mostrarModalPassword && adminSeleccionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#2196f3', 
              textAlign: 'center',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              🔐 Cambiar Contraseña
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#495057' }}>
                <strong>Administrador:</strong> {adminSeleccionado.nombreAdmin}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
                <strong>Email:</strong> {adminSeleccionado.email}
              </p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500', 
                color: '#495057',
                fontSize: '0.9rem'
              }}>
                Nueva Contraseña (mínimo 6 caracteres)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarPasswords.nueva ? 'text' : 'password'}
                  value={datosPassword.nuevaPassword}
                  onChange={(e) => setDatosPassword(prev => ({ ...prev, nuevaPassword: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    background: 'white',
                    transition: 'border-color 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                  onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPasswords(prev => ({ ...prev, nueva: !prev.nueva }))}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {mostrarPasswords.nueva ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500', 
                color: '#495057',
                fontSize: '0.9rem'
              }}>
                Confirmar Nueva Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarPasswords.confirmar ? 'text' : 'password'}
                  value={datosPassword.confirmarPassword}
                  onChange={(e) => setDatosPassword(prev => ({ ...prev, confirmarPassword: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    background: 'white',
                    transition: 'border-color 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                  onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPasswords(prev => ({ ...prev, confirmar: !prev.confirmar }))}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {mostrarPasswords.confirmar ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500', 
                color: '#495057',
                fontSize: '0.9rem'
              }}>
                Contraseña Actual (opcional, para verificación)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarPasswords.actual ? 'text' : 'password'}
                  value={datosPassword.passwordActual}
                  onChange={(e) => setDatosPassword(prev => ({ ...prev, passwordActual: e.target.value }))}
                  placeholder="Dejar vacío si es primera configuración"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    background: 'white',
                    transition: 'border-color 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                  onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPasswords(prev => ({ ...prev, actual: !prev.actual }))}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {mostrarPasswords.actual ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setMostrarModalPassword(false);
                  setDatosPassword({ nuevaPassword: '', confirmarPassword: '', passwordActual: '' });
                  setMostrarPasswords({ nueva: false, confirmar: false, actual: false });
                }}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={cambiarPassword}
                disabled={!datosPassword.nuevaPassword || datosPassword.nuevaPassword.length < 6 || 
                         datosPassword.nuevaPassword !== datosPassword.confirmarPassword || cambiandoPassword}
                style={{
                  background: (!datosPassword.nuevaPassword || datosPassword.nuevaPassword.length < 6 || 
                             datosPassword.nuevaPassword !== datosPassword.confirmarPassword || cambiandoPassword) ? 
                    'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                    'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                                          cursor: (!datosPassword.nuevaPassword || datosPassword.nuevaPassword.length < 6 || 
                          datosPassword.nuevaPassword !== datosPassword.confirmarPassword || cambiandoPassword) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {cambiandoPassword ? '⏳ Cambiando...' : '🔐 Cambiar Contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resetear contraseña */}
      {mostrarModalReset && adminSeleccionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#9c27b0', 
              textAlign: 'center',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              🔄 Resetear Contraseña
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f3e5f5', borderRadius: '8px', border: '1px solid #9c27b0' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#7b1fa2' }}>
                <strong>⚠️ ADVERTENCIA:</strong> Se generará una nueva contraseña temporal.
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#495057' }}>
                <strong>Administrador:</strong> {adminSeleccionado.nombreAdmin}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
                <strong>Email:</strong> {adminSeleccionado.email}
              </p>
            </div>

            {passwordReseteada && (
              <div style={{
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                border: '2px solid #ff9800',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                color: '#e65100'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#e65100', fontWeight: '600' }}>
                  🔑 Nueva Contraseña Temporal
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <code style={{
                    background: 'rgba(230, 81, 0, 0.1)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    border: '1px solid rgba(230, 81, 0, 0.3)',
                    flex: 1
                  }}>
                    {passwordReseteada}
                  </code>
                  <button
                    onClick={() => copiarAlPortapapeles(passwordReseteada)}
                    style={{
                      background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    📋 Copiar
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>
                  ⚠️ Guarde esta contraseña de forma segura. El administrador deberá cambiarla en su primer acceso.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setMostrarModalReset(false);
                  setPasswordReseteada(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                ❌ Cancelar
              </button>
              {!passwordReseteada && (
                <button
                  onClick={resetearPassword}
                  disabled={reseteandoPassword}
                  style={{
                    background: reseteandoPassword ? 
                      'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                      'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: reseteandoPassword ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {reseteandoPassword ? '⏳ Reseteando...' : '🔄 Resetear Contraseña'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminar */}
      {mostrarModalEliminar && adminSeleccionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#f44336', 
              textAlign: 'center',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              🗑️ Eliminar Administrador
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#ffebee', borderRadius: '8px', border: '1px solid #f44336' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#c62828' }}>
                <strong>⚠️ ADVERTENCIA:</strong> Esta acción no se puede deshacer.
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#495057' }}>
                <strong>Administrador:</strong> {adminSeleccionado.nombreAdmin}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
                <strong>Email:</strong> {adminSeleccionado.email}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setMostrarModalEliminar(false)}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={eliminarAdministrador}
                disabled={eliminandoAdmin}
                style={{
                  background: eliminandoAdmin ? 
                    'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                    'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: eliminandoAdmin ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {eliminandoAdmin ? '⏳ Eliminando...' : '🗑️ Eliminar Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de migración de contraseñas */}
      {mostrarModalMigracion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#ff9800', 
              textAlign: 'center',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              🔑 Migración de Contraseñas
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#fff3e0', borderRadius: '8px', border: '1px solid #ff9800' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#e65100' }}>
                <strong>ℹ️ Información:</strong> Esta función generará contraseñas temporales para todos los administradores que no tengan contraseña configurada.
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#495057', fontStyle: 'italic' }}>
                Solo se procesarán administradores que no tengan contraseña previamente configurada.
              </p>
            </div>

            {resultadoMigracion && (
              <div style={{
                background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
                border: '2px solid #4caf50',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                color: '#2e7d32'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#2e7d32', fontWeight: '600' }}>
                  ✅ Migración Completada
                </h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                  <strong>Administradores migrados:</strong> {resultadoMigracion.adminsMigrados}
                </p>
                
                {resultadoMigracion.passwordsGeneradas && Object.keys(resultadoMigracion.passwordsGeneradas).length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: '600' }}>
                      🔐 Contraseñas generadas:
                    </p>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(46, 125, 50, 0.1)', padding: '8px', borderRadius: '6px' }}>
                      {Object.entries(resultadoMigracion.passwordsGeneradas).map(([nombre, password]) => (
                        <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '6px', background: 'white', borderRadius: '4px' }}>
                          <div>
                            <strong>{nombre}:</strong> <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>{String(password)}</code>
                          </div>
                          <button
                            onClick={() => copiarAlPortapapeles(password as string)}
                            style={{
                              background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            📋
                          </button>
                        </div>
                      ))}
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      ⚠️ Guarde estas contraseñas de forma segura.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setMostrarModalMigracion(false);
                  setResultadoMigracion(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                ❌ Cancelar
              </button>
              {!resultadoMigracion && (
                <button
                  onClick={migrarPasswords}
                  disabled={migrandoPasswords}
                  style={{
                    background: migrandoPasswords ? 
                      'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                      'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: migrandoPasswords ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {migrandoPasswords ? '⏳ Migrando...' : '🔑 Iniciar Migración'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estilos para animación de spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
};

export default AdministradoresProcesados;