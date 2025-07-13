// Subir y Procesar Documento - Versión mejorada con análisis visual

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

// Interfaces expandidas para el análisis visual
interface ArchivoSubido {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoArchivo: number;
  archivoUrl: string;
  fechaSubida: string;
}

interface ElementosSeguridad {
  sellos: boolean;
  firmas: boolean;
  logos: boolean;
}

interface AnalisisDetallado {
  objetosDetectados: Array<{
    nombre: string;
    confianza: number;
    categoria: 'sello' | 'firma' | 'logo' | 'otro';
  }>;
  calidadDocumento: {
    claridadTexto: 'alta' | 'media' | 'baja';
    resolucion: 'alta' | 'media' | 'baja';
    estructuraDocumento: 'formal' | 'informal' | 'dudosa';
  };
  detallesElementos: {
    sellos: string[];
    firmas: string[];
    logos: string[];
  };
}

interface ResultadoAnalisis {
  id: string;
  textoExtraido: string;
  numeroCaracteres: number;
  scoreAutenticidad: number;
  recomendacion: 'accept' | 'review' | 'reject';
  recomendacionTexto: string;
  elementosSeguridad: ElementosSeguridad;
  archivoUrl: string;
  fechaAnalisis: string;
  // Nuevos campos del análisis mejorado
  analisisDetallado?: AnalisisDetallado;
}

interface AsignacionUsuario {
  documentoId: string;
  nombreUsuario: string;
  tipoDocumento: string;
  fechaAsignacion: string;
}

// URL del backend
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://docuvalle-backend-166554040569.us-central1.run.app';

const UploadDocumento: React.FC = () => {
  // Estados para el flujo
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoSubido, setArchivoSubido] = useState<ArchivoSubido | null>(null);
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [asignacion, setAsignacion] = useState<AsignacionUsuario | null>(null);
  
  // Estados para el UI
  const [subiendo, setSubiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para la asignación de usuario
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [mostrarAsignacion, setMostrarAsignacion] = useState(false);
  
  // Estados para la vista detallada
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  // Configuración de react-dropzone mejorada
  const onDrop = useCallback((archivosAceptados: File[]) => {
    if (archivosAceptados.length > 0 && !archivoSubido) {
      setArchivo(archivosAceptados[0]);
      setArchivoSubido(null);
      setResultado(null);
      setAsignacion(null);
      setError(null);
      console.log('📄 Archivo seleccionado:', archivosAceptados[0].name);
    }
  }, [archivoSubido]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'] // PDF ahora soportado
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB máximo
    disabled: subiendo || analizando || !!archivoSubido
  });

  // PASO 1: Subir archivo
  const subirArchivo = async () => {
    if (!archivo) {
      setError('Por favor selecciona un archivo primero');
      return;
    }

    setSubiendo(true);
    setError(null);

    try {
      console.log(`📤 Subiendo archivo: ${archivo.name} (${archivo.size} bytes)`);

      const formData = new FormData();
      formData.append('archivo', archivo);

      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
        }
      );

      setArchivoSubido(respuesta.data.documento);
      console.log('✅ Archivo subido exitosamente:', respuesta.data.documento);

    } catch (error) {
      console.error('❌ Error subiendo archivo:', error);
      
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        setError(errorData?.message || 'Error subiendo el archivo');
      } else {
        setError('Error de conexión subiendo el archivo');
      }
    } finally {
      setSubiendo(false);
    }
  };

  // PASO 2: Analizar documento con análisis visual mejorado
  const analizarDocumento = async () => {
    if (!archivoSubido) {
      setError('Primero debes subir un archivo');
      return;
    }

    setAnalizando(true);
    setError(null);

    try {
      console.log(`🔍 Analizando documento con IA mejorada: ${archivoSubido.id}`);

      const payload = {
        documentoId: archivoSubido.id,
        archivoUrl: archivoSubido.archivoUrl,
        nombreArchivo: archivoSubido.nombreArchivo,
        tipoArchivo: archivoSubido.tipoArchivo,
        tamanoArchivo: archivoSubido.tamanoArchivo,
        userId: 'admin-usuario'
      };

      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/analyze`,
        payload,
        {
          timeout: 120000, // 2 minutos para el análisis
        }
      );

      setResultado(respuesta.data.resultado);
      console.log('🎉 Documento analizado exitosamente:', respuesta.data.resultado);

    } catch (error) {
      console.error('❌ Error analizando documento:', error);
      
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        if (error.response?.status === 404) {
          setError('El endpoint de análisis no está disponible. Verifica que el backend tenga los nuevos endpoints.');
        } else {
          setError(errorData?.message || 'Error analizando el documento');
        }
      } else {
        setError('Error de conexión analizando el documento');
      }
    } finally {
      setAnalizando(false);
    }
  };

  // HU006 - Asignar documento a usuario
  const asignarDocumento = async () => {
    if (!resultado || !nombreUsuario.trim()) {
      setError('Completa el nombre del usuario');
      return;
    }

    setAsignando(true);
    setError(null);

    try {
      console.log(`👤 Asignando documento ${resultado.id} a ${nombreUsuario}`);

      const payload = {
        nombreUsuario: nombreUsuario.trim(),
        tipoDocumento: tipoDocumento || 'documento_general'
      };

      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/${resultado.id}/assign`,
        payload
      );

      setAsignacion(respuesta.data.asignacion);
      setMostrarAsignacion(false);
      console.log('✅ Documento asignado exitosamente:', respuesta.data.asignacion);

    } catch (error) {
      console.error('❌ Error asignando documento:', error);
      
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        setError(errorData?.message || 'Error asignando el documento');
      } else {
        setError('Error de conexión asignando el documento');
      }
    } finally {
      setAsignando(false);
    }
  };

  // Función para reiniciar el proceso
  const reiniciarProceso = () => {
    setArchivo(null);
    setArchivoSubido(null);
    setResultado(null);
    setAsignacion(null);
    setError(null);
    setNombreUsuario('');
    setTipoDocumento('');
    setMostrarAsignacion(false);
    setMostrarDetalles(false);
  };

  // Función para obtener el color del score
  const obtenerColorScore = (score: number): string => {
    if (score >= 85) return '#4caf50'; // Verde - Umbral ajustado
    if (score >= 60) return '#ff9800'; // Naranja - Umbral ajustado
    return '#f44336'; // Rojo
  };

  // Función para obtener el icono según la categoría
  const obtenerIconoCategoria = (categoria: string): string => {
    switch (categoria) {
      case 'sello': return '🏛️';
      case 'firma': return '✍️';
      case 'logo': return '🎯';
      default: return '📄';
    }
  };

  // Función para obtener el color de la calidad
  const obtenerColorCalidad = (calidad: string): string => {
    switch (calidad) {
      case 'alta': return '#4caf50';
      case 'media': return '#ff9800';
      case 'baja': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <div className="upload-documento-container">
      <h2>📄 Procesar Documento (Con IA Mejorada)</h2>
      
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* PASO 1: Selección de archivo */}
      {!archivoSubido && (
        <section className="paso-seleccion">
          <h3>Paso 1: Seleccionar Archivo</h3>
          
          <div 
            {...getRootProps()} 
            className={`dropzone ${isDragActive ? 'activa' : ''} ${archivo ? 'con-archivo' : ''}`}
          >
            <input {...getInputProps()} />
            {archivo ? (
              <div className="archivo-seleccionado">
                <h4>📁 Archivo seleccionado:</h4>
                <p><strong>Nombre:</strong> {archivo.name}</p>
                <p><strong>Tamaño:</strong> {(archivo.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Tipo:</strong> {archivo.type}</p>
                
                {/* Preview mejorado */}
                {archivo.type.startsWith('image/') && (
                  <div className="preview-imagen">
                    <img 
                      src={URL.createObjectURL(archivo)} 
                      alt="Preview"
                      style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                
                {archivo.type === 'application/pdf' && (
                  <div className="preview-pdf">
                    <div className="pdf-icon">📄</div>
                    <p>Archivo PDF listo para procesar</p>
                  </div>
                )}
                
                <div className="botones-archivo">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setArchivo(null);
                    }} 
                    className="btn-limpiar"
                  >
                    Seleccionar otro archivo
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      subirArchivo();
                    }} 
                    disabled={subiendo}
                    className="btn-subir"
                  >
                    {subiendo ? '⏳ Subiendo...' : '📤 Subir Archivo'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="zona-dropzone">
                {isDragActive ? (
                  <p>🎯 Suelta el archivo aquí...</p>
                ) : (
                  <div>
                    <p>📎 Arrastra un archivo aquí, o haz clic para seleccionar</p>
                    <small>Formatos aceptados: JPG, PNG, PDF (máximo 10MB)</small>
                    <div className="formatos-soportados">
                      <span className="formato">🖼️ Imágenes</span>
                      <span className="formato">📄 PDFs</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* PASO 2: Archivo subido, listo para analizar */}
      {archivoSubido && !resultado && (
        <section className="paso-analisis">
          <h3>Paso 2: Archivo Subido ✅</h3>
          
          <div className="info-archivo-subido">
            <p><strong>📄 Archivo:</strong> {archivoSubido.nombreArchivo}</p>
            <p><strong>🔗 URL:</strong> <a href={archivoSubido.archivoUrl} target="_blank" rel="noopener noreferrer">Ver archivo</a></p>
            <p><strong>📅 Subido:</strong> {new Date(archivoSubido.fechaSubida).toLocaleString()}</p>
          </div>

          <div className="botones-analisis">
            <button 
              onClick={analizarDocumento} 
              disabled={analizando}
              className="btn-analizar"
            >
              {analizando ? '⏳ Analizando con IA...' : '🤖 Analizar con IA Mejorada'}
            </button>
            
            <button 
              onClick={reiniciarProceso}
              className="btn-nuevo-small"
            >
              📄 Subir Otro Archivo
            </button>
          </div>

          {analizando && (
            <div className="progreso-analisis">
              <div className="spinner"></div>
              <p>🔍 Analizando documento con inteligencia artificial...</p>
              <ul className="pasos-analisis">
                <li>📝 Extrayendo texto</li>
                <li>🔍 Detectando elementos de seguridad</li>
                <li>🏛️ Buscando sellos oficiales</li>
                <li>✍️ Identificando firmas</li>
                <li>🎯 Reconociendo logos</li>
                <li>📊 Calculando score de autenticidad</li>
              </ul>
            </div>
          )}
        </section>
      )}

      {/* PASO 3: Resultados del análisis mejorado */}
      {resultado && (
        <section className="paso-resultados">
          <h3>Paso 3: Resultados del Análisis IA 📊</h3>
          
          <div className="resultado-analisis">
            {/* Score principal */}
            <div className="score-autenticidad">
              <h4>Score de Autenticidad</h4>
              <div 
                className="score-numero"
                style={{ color: obtenerColorScore(resultado.scoreAutenticidad) }}
              >
                {resultado.scoreAutenticidad}/100
              </div>
              <p className="recomendacion">{resultado.recomendacionTexto}</p>
            </div>

            {/* Elementos de seguridad mejorados */}
            <div className="elementos-seguridad">
              <h4>🔒 Elementos de Seguridad Detectados</h4>
              <div className="elementos-grid">
                <div className={`elemento ${resultado.elementosSeguridad.sellos ? 'detectado' : 'no-detectado'}`}>
                  🏛️ Sellos: {resultado.elementosSeguridad.sellos ? '✅ Detectado' : '❌ No detectado'}
                </div>
                <div className={`elemento ${resultado.elementosSeguridad.firmas ? 'detectado' : 'no-detectado'}`}>
                  ✍️ Firmas: {resultado.elementosSeguridad.firmas ? '✅ Detectado' : '❌ No detectado'}
                </div>
                <div className={`elemento ${resultado.elementosSeguridad.logos ? 'detectado' : 'no-detectado'}`}>
                  🎯 Logos: {resultado.elementosSeguridad.logos ? '✅ Detectado' : '❌ No detectado'}
                </div>
              </div>
            </div>

            {/* Calidad del documento (nuevo) */}
            {resultado.analisisDetallado && (
              <div className="calidad-documento">
                <h4>📋 Calidad del Documento</h4>
                <div className="calidad-grid">
                  <div className="calidad-item">
                    <span>Claridad del texto:</span>
                    <span 
                      className="badge"
                      style={{ backgroundColor: obtenerColorCalidad(resultado.analisisDetallado.calidadDocumento.claridadTexto) }}
                    >
                      {resultado.analisisDetallado.calidadDocumento.claridadTexto}
                    </span>
                  </div>
                  <div className="calidad-item">
                    <span>Estructura:</span>
                    <span 
                      className="badge"
                      style={{ backgroundColor: obtenerColorCalidad(resultado.analisisDetallado.calidadDocumento.estructuraDocumento) }}
                    >
                      {resultado.analisisDetallado.calidadDocumento.estructuraDocumento}
                    </span>
                  </div>
                  <div className="calidad-item">
                    <span>Resolución:</span>
                    <span 
                      className="badge"
                      style={{ backgroundColor: obtenerColorCalidad(resultado.analisisDetallado.calidadDocumento.resolucion) }}
                    >
                      {resultado.analisisDetallado.calidadDocumento.resolucion}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Texto extraído */}
            <div className="texto-extraido">
              <h4>📝 Texto Extraído ({resultado.numeroCaracteres} caracteres)</h4>
              <textarea 
                value={resultado.textoExtraido} 
                readOnly 
                rows={8}
                className="textarea-resultado"
              />
            </div>

            {/* Botones de acción */}
            <div className="botones-resultado">
              {resultado.analisisDetallado && (
                <button 
                  onClick={() => setMostrarDetalles(true)}
                  className="btn-detalles"
                >
                  🔍 Ver Análisis Detallado
                </button>
              )}
              <button 
                onClick={() => setMostrarAsignacion(true)}
                className="btn-asignar"
              >
                👤 Asignar a Usuario
              </button>
              <button 
                onClick={reiniciarProceso}
                className="btn-nuevo"
              >
                📄 Procesar Nuevo Documento
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MODAL: Análisis detallado */}
      {mostrarDetalles && resultado?.analisisDetallado && (
        <div className="modal-detalles">
          <div className="modal-content-large">
            <h3>🔍 Análisis Detallado del Documento</h3>
            
            {/* Objetos detectados */}
            <div className="seccion-detalles">
              <h4>📊 Objetos Detectados por IA ({resultado.analisisDetallado.objetosDetectados.length})</h4>
              {resultado.analisisDetallado.objetosDetectados.length > 0 ? (
                <div className="objetos-detectados">
                  {resultado.analisisDetallado.objetosDetectados.map((objeto, index) => (
                    <div key={index} className="objeto-detectado">
                      <span className="icono">{obtenerIconoCategoria(objeto.categoria)}</span>
                      <span className="nombre">{objeto.nombre}</span>
                      <span className="categoria">({objeto.categoria})</span>
                      <span className="confianza">{Math.round(objeto.confianza * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-objetos">No se detectaron objetos específicos</p>
              )}
            </div>

            {/* Detalles de elementos de seguridad */}
            <div className="seccion-detalles">
              <h4>🔒 Detalles de Elementos de Seguridad</h4>
              
              <div className="detalles-elementos">
                <div className="elemento-detalle">
                  <h5>🏛️ Sellos Detectados</h5>
                  {resultado.analisisDetallado.detallesElementos.sellos.length > 0 ? (
                    <ul>
                      {resultado.analisisDetallado.detallesElementos.sellos.map((sello, index) => (
                        <li key={index}>{sello}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-detectado">No se detectaron sellos</p>
                  )}
                </div>

                <div className="elemento-detalle">
                  <h5>✍️ Firmas Detectadas</h5>
                  {resultado.analisisDetallado.detallesElementos.firmas.length > 0 ? (
                    <ul>
                      {resultado.analisisDetallado.detallesElementos.firmas.map((firma, index) => (
                        <li key={index}>{firma}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-detectado">No se detectaron firmas</p>
                  )}
                </div>

                <div className="elemento-detalle">
                  <h5>🎯 Logos Detectados</h5>
                  {resultado.analisisDetallado.detallesElementos.logos.length > 0 ? (
                    <ul>
                      {resultado.analisisDetallado.detallesElementos.logos.map((logo, index) => (
                        <li key={index}>{logo}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-detectado">No se detectaron logos</p>
                  )}
                </div>
              </div>
            </div>

            <div className="botones-modal">
              <button 
                onClick={() => setMostrarDetalles(false)}
                className="btn-cerrar"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Asignar documento a usuario */}
      {mostrarAsignacion && (
        <div className="modal-asignacion">
          <div className="modal-content">
            <h3>👤 Asignar Documento a Usuario</h3>
            
            <div className="form-asignacion">
              <div className="campo">
                <label htmlFor="nombreUsuario">Nombre del Usuario/Estudiante *</label>
                <input
                  id="nombreUsuario"
                  type="text"
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                  placeholder="Ej: Juan Pérez González"
                  required
                />
              </div>

              <div className="campo">
                <label htmlFor="tipoDocumento">Tipo de Documento</label>
                <select
                  id="tipoDocumento"
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="diploma_bachillerato">Diploma de Bachillerato</option>
                  <option value="certificado_notas">Certificado de Notas</option>
                  <option value="titulo_universitario">Título Universitario</option>
                  <option value="certificado_idiomas">Certificado de Idiomas</option>
                  <option value="identificacion">Documento de Identificación</option>
                  <option value="pasaporte">Pasaporte</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="botones-modal">
                <button 
                  onClick={asignarDocumento}
                  disabled={asignando || !nombreUsuario.trim()}
                  className="btn-confirmar"
                >
                  {asignando ? '⏳ Asignando...' : '✅ Asignar'}
                </button>
                <button 
                  onClick={() => setMostrarAsignacion(false)}
                  className="btn-cancelar"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de asignación */}
      {asignacion && (
        <section className="confirmacion-asignacion">
          <div className="mensaje-exito">
            <h3>✅ Documento Asignado Exitosamente</h3>
            <p><strong>Usuario:</strong> {asignacion.nombreUsuario}</p>
            <p><strong>Tipo:</strong> {asignacion.tipoDocumento}</p>
            <p><strong>Fecha:</strong> {new Date(asignacion.fechaAsignacion).toLocaleString()}</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default UploadDocumento;