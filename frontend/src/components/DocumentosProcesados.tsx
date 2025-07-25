import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Interfaces
interface Usuario {
  id: string;
  nombreUsuario: string;
  fechaCreacion: string;
  documentosAsignados: number;
  estado: string;
}

interface DocumentoListado {
  id: string;
  nombreArchivo: string;
  tipoDocumento: string;
  usuarioAsignado: string;
  scoreAutenticidad: number;
  recomendacion: 'accept' | 'review' | 'reject';
  recomendacionManual?: 'accept' | 'review' | 'reject' | null;
  estadoRevision: string;
  estado: string;
  fechaProcesamiento: string;
  fechaAsignacion?: string | null;
  analisisGemini?: any;
  archivoUrl: string;
}

interface FiltrosBusqueda {
  nombreUsuario?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limite?: number;
}

interface DocumentosProcesadosProps {
  apiBaseUrl?: string;
  mostrarBotonAbrir?: boolean;
  titulo?: string;
  onDocumentoSeleccionado?: (documento: DocumentoListado) => void;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const DocumentosProcesados: React.FC<DocumentosProcesadosProps> = ({
  apiBaseUrl = API_BASE_URL,
  mostrarBotonAbrir = true,
  titulo = '📚 Documentos Procesados',
  onDocumentoSeleccionado
}) => {
  // Estados principales
  const [mostrarModal, setMostrarModal] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoListado[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Estados para filtros
  const [filtros, setFiltros] = useState<FiltrosBusqueda>({
    nombreUsuario: '',
    fechaDesde: '',
    fechaHasta: '',
    limite: 50
  });

  // Estados para gestión de usuarios
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [mostrarCrearUsuario, setMostrarCrearUsuario] = useState(false);

  // Estados para asignación
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<DocumentoListado | null>(null);
  const [usuarioAsignacion, setUsuarioAsignacion] = useState('');
  const [tipoDocumentoAsignacion, setTipoDocumentoAsignacion] = useState('');
  const [mostrarModalAsignacion, setMostrarModalAsignacion] = useState(false);
  const [asignandoDocumento, setAsignandoDocumento] = useState(false);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const documentosPorPagina = 10;

  // Cargar usuarios al abrir el modal
  useEffect(() => {
    if (mostrarModal) {
      cargarUsuarios();
      buscarDocumentos();
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

  // Funciones para gestión de usuarios
  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/users/list`);
      if (response.data.success) {
        setUsuarios(response.data.usuarios);
        console.log('✅ Usuarios cargados:', response.data.usuarios.length);
      }
    } catch (error) {
      console.error('❌ Error cargando usuarios:', error);
      mostrarError('Error cargando lista de usuarios');
    } finally {
      setCargandoUsuarios(false);
    }
  };

  // Funciones de paginación
  const calcularPaginacion = () => {
    const totalPaginas = Math.ceil(documentos.length / documentosPorPagina);
    const inicio = (paginaActual - 1) * documentosPorPagina;
    const fin = inicio + documentosPorPagina;
    const documentosPaginados = documentos.slice(inicio, fin);

    return {
      totalPaginas,
      documentosPaginados,
      inicio: inicio + 1,
      fin: Math.min(fin, documentos.length),
      total: documentos.length
    };
  };

  const cambiarPagina = (nuevaPagina: number) => {
    const { totalPaginas } = calcularPaginacion();
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaActual(nuevaPagina);
      setDocumentoSeleccionado(null); // Limpiar selección al cambiar página
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
          Mostrando {inicio} - {fin} de {total} documentos
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

  const crearUsuario = async () => {
    if (!nuevoUsuario.trim()) {
      mostrarError('El nombre del usuario es obligatorio');
      return;
    }

    try {
      const response = await axios.post(`${apiBaseUrl}/api/users/create-or-get`, {
        nombreUsuario: nuevoUsuario.trim()
      });

      if (response.data.success) {
        if (response.data.esNuevo) {
          mostrarExito(`✅ Usuario "${nuevoUsuario}" creado exitosamente`);
        } else {
          mostrarExito(`ℹ️ Usuario "${nuevoUsuario}" ya existía`);
        }
        
        // Recargar usuarios y limpiar formulario
        await cargarUsuarios();
        setNuevoUsuario('');
        setMostrarCrearUsuario(false);
      }
    } catch (error: any) {
      console.error('❌ Error creando usuario:', error);
      const mensajeError = error.response?.data?.message || 'Error creando usuario';
      mostrarError(mensajeError);
    }
  };

  // Función para buscar documentos
  const buscarDocumentos = async () => {
    setCargandoDocumentos(true);
    setDocumentoSeleccionado(null);
    setPaginaActual(1); // Resetear a la primera página al buscar
    
    try {
      console.log('🔍 Buscando documentos con filtros:', filtros);
      
      // Preparar los datos para el endpoint
      const datosConsulta: any = {
        limite: filtros.limite || 100 // Aumentamos el límite para obtener más datos y paginar localmente
      };

      // Solo incluir nombreUsuario si tiene valor
      if (filtros.nombreUsuario && filtros.nombreUsuario.trim() !== '') {
        datosConsulta.nombreUsuario = filtros.nombreUsuario.trim();
      }

      // Solo incluir fechas si tienen valor
      if (filtros.fechaDesde) {
        datosConsulta.fechaDesde = filtros.fechaDesde;
      }
      if (filtros.fechaHasta) {
        datosConsulta.fechaHasta = filtros.fechaHasta;
      }

      console.log('📤 Enviando consulta:', datosConsulta);

      const response = await axios.post(`${apiBaseUrl}/api/documents/search`, datosConsulta);

      if (response.data.success) {
        setDocumentos(response.data.documentos);
        console.log(`✅ Encontrados ${response.data.documentos.length} documentos`);
        
        if (response.data.documentos.length === 0) {
          mostrarExito('Búsqueda completada - No se encontraron documentos con los filtros aplicados');
        } else {
          mostrarExito(`✅ Encontrados ${response.data.documentos.length} documentos`);
        }
      } else {
        throw new Error(response.data.message);
      }
    } catch (error: any) {
      console.error('❌ Error buscando documentos:', error);
      const mensajeError = error.response?.data?.message || error.message || 'Error buscando documentos';
      mostrarError(mensajeError);
      setDocumentos([]);
    } finally {
      setCargandoDocumentos(false);
    }
  };

  // Función para asignar documento
  const asignarDocumento = async () => {
    if (!documentoSeleccionado || !usuarioAsignacion) {
      mostrarError('Selecciona un usuario para asignar el documento');
      return;
    }

    setAsignandoDocumento(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/api/documents/${documentoSeleccionado.id}/assign`, {
        nombreUsuario: usuarioAsignacion,
        tipoDocumento: tipoDocumentoAsignacion || 'no_especificado'
      });

      if (response.data.success) {
        mostrarExito(`✅ Documento asignado a ${usuarioAsignacion}`);
        setMostrarModalAsignacion(false);
        setUsuarioAsignacion('');
        setTipoDocumentoAsignacion('');
        
        // Recargar documentos y usuarios manteniendo la página actual
        const paginaAnterior = paginaActual;
        await buscarDocumentos();
        await cargarUsuarios();
        
        // Restaurar la página si sigue siendo válida
        const nuevasPaginas = Math.ceil(documentos.length / documentosPorPagina);
        if (paginaAnterior <= nuevasPaginas && paginaAnterior > 0) {
          setPaginaActual(paginaAnterior);
        }
      }
    } catch (error: any) {
      console.error('❌ Error asignando documento:', error);
      const mensajeError = error.response?.data?.message || 'Error asignando documento';
      mostrarError(mensajeError);
    } finally {
      setAsignandoDocumento(false);
    }
  };

  // Función para abrir modal de asignación
  const abrirModalAsignacion = (documento: DocumentoListado) => {
    setDocumentoSeleccionado(documento);
    setUsuarioAsignacion('');
    setTipoDocumentoAsignacion('');
    setMostrarModalAsignacion(true);
  };

  // Función para obtener el color del score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  // Función para obtener el texto de la recomendación
  const getRecomendacionInfo = (recomendacion: string): { texto: string; color: string } => {
    switch (recomendacion) {
      case 'accept':
        return { texto: '✅ ACEPTAR', color: '#4caf50' };
      case 'review':
        return { texto: '⚠️ REVISAR', color: '#ff9800' };
      case 'reject':
        return { texto: '❌ RECHAZAR', color: '#f44336' };
      default:
        return { texto: '❓ SIN DETERMINAR', color: '#9e9e9e' };
    }
  };

  return (
    <>
      {/* Botón para abrir modal (opcional) */}
      {mostrarBotonAbrir && (
        <div style={{ margin: '32px 0 0 0', textAlign: 'center' }}>
          <button
            style={{
              background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setMostrarModal(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(33, 150, 243, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(33, 150, 243, 0.3)';
            }}
          >
            📚 Ver Documentos Procesados
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

            {/* Filtros */}
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
                🔍 Filtros de Búsqueda
              </h3>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '20px',
                marginBottom: '20px'
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '500', 
                    color: '#495057',
                    fontSize: '0.9rem'
                  }}>
                    Usuario Asignado
                  </label>
                  <select
                    value={filtros.nombreUsuario || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, nombreUsuario: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      background: 'white',
                      transition: 'border-color 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                    onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                  >
                    <option value="">Todos los usuarios</option>
                    <option value="Sin asignar">Sin asignar</option>
                    {usuarios.map(usuario => (
                      <option key={usuario.id} value={usuario.nombreUsuario}>
                        {usuario.nombreUsuario} ({usuario.documentosAsignados} docs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '500', 
                    color: '#495057',
                    fontSize: '0.9rem'
                  }}>
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={filtros.fechaDesde || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaDesde: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
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
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '500', 
                    color: '#495057',
                    fontSize: '0.9rem'
                  }}>
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={filtros.fechaHasta || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaHasta: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
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
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={buscarDocumentos}
                  disabled={cargandoDocumentos}
                  style={{
                    background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: cargandoDocumentos ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: cargandoDocumentos ? 0.7 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {cargandoDocumentos ? '🔄 Buscando...' : '🔍 Buscar'}
                </button>

                <button
                  onClick={() => {
                    if (mostrarCrearUsuario) {
                      setNuevoUsuario('');
                    }
                    setMostrarCrearUsuario(!mostrarCrearUsuario);
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
                  {mostrarCrearUsuario ? '❌ Cancelar' : '➕ Nuevo Usuario'}
                </button>

                <button
                  onClick={cargarUsuarios}
                  disabled={cargandoUsuarios}
                  style={{
                    background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: cargandoUsuarios ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: cargandoUsuarios ? 0.7 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {cargandoUsuarios ? '🔄 Cargando...' : '🔄 Recargar Usuarios'}
                </button>

                <span style={{ 
                  fontSize: '0.9rem', 
                  color: '#6c757d', 
                  padding: '8px 12px',
                  background: 'rgba(108, 117, 125, 0.1)',
                  borderRadius: '6px',
                  fontWeight: '500'
                }}>
                  📊 Total usuarios: {usuarios.length}
                </span>
              </div>

              {/* Formulario para crear usuario */}
              {mostrarCrearUsuario && (
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid #2196f3',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.15)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 16px 0', 
                    color: '#1976d2',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}>
                    ➕ Crear Nuevo Usuario
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontWeight: '500', 
                        color: '#495057',
                        fontSize: '0.9rem'
                      }}>
                        Nombre del nuevo usuario *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Juan Pérez González"
                        value={nuevoUsuario}
                        onChange={(e) => setNuevoUsuario(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '2px solid #dee2e6',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          transition: 'border-color 0.3s ease',
                          boxSizing: 'border-box'
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && crearUsuario()}
                        onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                        onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          setMostrarCrearUsuario(false);
                          setNuevoUsuario('');
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
                        onClick={crearUsuario}
                        disabled={!nuevoUsuario.trim()}
                        style={{
                          background: !nuevoUsuario.trim() ? 
                            'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                            'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontWeight: '600',
                          cursor: nuevoUsuario.trim() ? 'pointer' : 'not-allowed',
                          fontSize: '0.9rem',
                          opacity: nuevoUsuario.trim() ? 1 : 0.7,
                          transition: 'all 0.3s ease'
                        }}
                      >
                        ✅ Crear Usuario
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tabla de documentos */}
            <div style={{ overflowX: 'auto' }}>
              {cargandoDocumentos ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #2196f3',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }}></div>
                  <p>Cargando documentos...</p>
                </div>
              ) : documentos.length > 0 ? (
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
                          Archivo
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Usuario Asignado
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Score
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Recomendación
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Estado
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Fecha
                        </th>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.9rem' }}>
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcularPaginacion().documentosPaginados.map((doc, index) => {
                        const recomendacionInfo = getRecomendacionInfo(doc.recomendacionManual || doc.recomendacion);
                        return (
                          <tr 
                            key={doc.id} 
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
                                  fontSize: '0.9rem',
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {doc.nombreArchivo}
                                </p>
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '0.8rem', 
                                  color: '#6c757d',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {doc.tipoDocumento}
                                  {doc.analisisGemini?.habilitado && (
                                    <span style={{ color: '#9c27b0', fontSize: '0.9rem' }}>🧠</span>
                                  )}
                                </p>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div>
                                <p style={{
                                  margin: '0 0 4px 0',
                                  fontWeight: '500',
                                  color: doc.usuarioAsignado === 'Sin asignar' ? '#f44336' : '#333',
                                  fontSize: '0.9rem'
                                }}>
                                  {doc.usuarioAsignado}
                                </p>
                                {doc.fechaAsignacion && (
                                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6c757d' }}>
                                    {new Date(doc.fechaAsignacion).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: getScoreColor(doc.scoreAutenticidad),
                                background: `${getScoreColor(doc.scoreAutenticidad)}20`,
                                padding: '4px 8px',
                                borderRadius: '6px'
                              }}>
                                {doc.scoreAutenticidad}
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
                                background: `${recomendacionInfo.color}20`,
                                color: recomendacionInfo.color,
                                border: `1px solid ${recomendacionInfo.color}40`
                              }}>
                                {recomendacionInfo.texto}
                              </span>
                              {doc.recomendacionManual && (
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: '#9c27b0', fontWeight: '500' }}>
                                  ✋ Revisión manual
                                </p>
                              )}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                borderRadius: '12px',
                                background: doc.estadoRevision === 'revisado_manualmente' ? '#e1f5fe' :
                                           doc.estadoRevision === 'pendiente' ? '#fff3e0' : '#f5f5f5',
                                color: doc.estadoRevision === 'revisado_manualmente' ? '#0277bd' :
                                       doc.estadoRevision === 'pendiente' ? '#e65100' : '#616161'
                              }}>
                                {doc.estadoRevision}
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '0.8rem', color: '#6c757d' }}>
                              {new Date(doc.fechaProcesamiento).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => abrirModalAsignacion(doc)}
                                  style={{
                                    background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
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
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(33, 150, 243, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                >
                                  {doc.usuarioAsignado === 'Sin asignar' ? '➕ Asignar' : '🔄 Reasignar'}
                                </button>
                                
                                {doc.archivoUrl && (
                                  <a
                                    href={doc.archivoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                                      color: 'white',
                                      textDecoration: 'none',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    👁️ Ver
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Navegación de páginas */}
                  <NavegacionPaginas />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#495057' }}>No se encontraron documentos</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Ajusta los filtros o sube algunos documentos para empezar
                  </p>
                </div>
              )}
            </div>

            {/* Información adicional */}
            {documentos.length > 0 && (
              <div style={{ 
                marginTop: '20px', 
                textAlign: 'center', 
                fontSize: '0.9rem', 
                color: '#6c757d',
                padding: '12px',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '8px'
              }}>
                📊 Total: {documentos.length} documentos encontrados
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

      {/* Modal de asignación */}
      {mostrarModalAsignacion && documentoSeleccionado && (
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
              👤 Asignar Documento a Usuario
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#495057' }}>
                <strong>Documento:</strong> {documentoSeleccionado.nombreArchivo}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
                <strong>Score actual:</strong> 
                <span style={{ 
                  marginLeft: '8px',
                  color: getScoreColor(documentoSeleccionado.scoreAutenticidad),
                  fontWeight: '700'
                }}>
                  {documentoSeleccionado.scoreAutenticidad}/100
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
                Seleccionar Usuario *
              </label>
              <select
                value={usuarioAsignacion}
                onChange={(e) => setUsuarioAsignacion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  background: 'white',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
              >
                <option value="">-- Seleccionar usuario --</option>
                {usuarios.map(usuario => (
                  <option key={usuario.id} value={usuario.nombreUsuario}>
                    {usuario.nombreUsuario} ({usuario.documentosAsignados} docs)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500', 
                color: '#495057',
                fontSize: '0.9rem'
              }}>
                Tipo de Documento (Opcional)
              </label>
              <select
                value={tipoDocumentoAsignacion}
                onChange={(e) => setTipoDocumentoAsignacion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  background: 'white',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
              >
                <option value="">-- Seleccionar tipo --</option>
                <option value="diploma">Diploma</option>
                <option value="certificado">Certificado</option>
                <option value="notas">Notas/Calificaciones</option>
                <option value="identificacion">Identificación</option>
                <option value="pasaporte">Pasaporte</option>
                <option value="documento_general">Documento General</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setMostrarModalAsignacion(false)}
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
                onClick={asignarDocumento}
                disabled={!usuarioAsignacion || asignandoDocumento}
                style={{
                  background: !usuarioAsignacion || asignandoDocumento ? 
                    'linear-gradient(135deg, #ccc 0%, #aaa 100%)' :
                    'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  cursor: (!usuarioAsignacion || asignandoDocumento) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {asignandoDocumento ? '⏳ Asignando...' : '✅ Asignar'}
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

export default DocumentosProcesados;