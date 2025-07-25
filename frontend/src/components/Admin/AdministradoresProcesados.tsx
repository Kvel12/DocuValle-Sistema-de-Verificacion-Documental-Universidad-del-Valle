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
    rol: 'administrador'
  });
  const [mostrarCrearAdmin, setMostrarCrearAdmin] = useState(false);
  const [creandoAdmin, setCreandoAdmin] = useState(false);

  // Estados para actualizar estado
  const [adminSeleccionado, setAdminSeleccionado] = useState<Administrador | null>(null);
  const [mostrarModalEstado, setMostrarModalEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<'activo' | 'inactivo'>('activo');
  const [actualizandoEstado, setActualizandoEstado] = useState(false);

  // Estados para eliminar
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [eliminandoAdmin, setEliminandoAdmin] = useState(false);

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

    setCreandoAdmin(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/api/admins/create-or-get`, {
        nombreAdmin: nuevoAdmin.nombreAdmin.trim(),
        email: nuevoAdmin.email.trim(),
        rol: nuevoAdmin.rol
      });

      if (response.data.success) {
        if (response.data.esNuevo) {
          mostrarExito(`✅ Administrador "${nuevoAdmin.nombreAdmin}" creado exitosamente`);
        } else {
          mostrarExito(`ℹ️ Administrador "${nuevoAdmin.nombreAdmin}" ya existía`);
        }
        
        // Recargar administradores y limpiar formulario
        await cargarAdministradores();
        setNuevoAdmin({ nombreAdmin: '', email: '', rol: 'administrador' });
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

  // Función para obtener el color del estado
  const getEstadoColor = (estado: string): string => {
    return estado === 'activo' ? '#4caf50' : '#f44336';
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
            maxWidth: '1200px',
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
                      setNuevoAdmin({ nombreAdmin: '', email: '', rol: 'administrador' });
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
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setMostrarCrearAdmin(false);
                        setNuevoAdmin({ nombreAdmin: '', email: '', rol: 'administrador' });
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
                      disabled={!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || creandoAdmin}
                      style={{
                        background: (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || creandoAdmin) ? 
                          'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                          'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontWeight: '600',
                        cursor: (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || creandoAdmin) ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        opacity: (!nuevoAdmin.nombreAdmin.trim() || !nuevoAdmin.email.trim() || creandoAdmin) ? 0.7 : 1,
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
                          Fecha Creación
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
                            {new Date(admin.fechaCreacion).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => abrirModalEstado(admin)}
                                style={{
                                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '0.8rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(255, 152, 0, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                🔄 Estado
                              </button>
                              
                              <button
                                onClick={() => abrirModalEliminar(admin)}
                                style={{
                                  background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '0.8rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(244, 67, 54, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                🗑️ Eliminar
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
                  Última actualización: {new Date().toLocaleTimeString()}
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