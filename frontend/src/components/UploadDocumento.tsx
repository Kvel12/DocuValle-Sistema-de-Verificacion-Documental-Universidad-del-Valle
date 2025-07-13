// Subir y Procesar Documento - Versión final con marcado manual y diseño mejorado

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

// Interfaces expandidas
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
  analisisDetallado?: AnalisisDetallado;
}

interface AsignacionUsuario {
  documentoId: string;
  nombreUsuario: string;
  tipoDocumento: string;
  fechaAsignacion: string;
}

// NUEVA: Interfaz para marcado manual
interface RevisionManual {
  documentoId: string;
  decision: 'accept' | 'review' | 'reject';
  comentario: string;
  revisorId: string;
  fechaRevision: string;
}

// URL del backend
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://docuvalle-backend-166554040569.us-central1.run.app';

const UploadDocumento: React.FC = () => {
  // Estados principales
  const [pasoActual, setPasoActual] = useState(1); // NUEVO: Control de pasos
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoSubido, setArchivoSubido] = useState<ArchivoSubido | null>(null);
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [asignacion, setAsignacion] = useState<AsignacionUsuario | null>(null);
  const [revisionManual, setRevisionManual] = useState<RevisionManual | null>(null);
  
  // Estados de carga
  const [subiendo, setSubiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [marcandoManual, setMarcandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de modales
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [mostrarAsignacion, setMostrarAsignacion] = useState(false);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [mostrarMarcadoManual, setMostrarMarcadoManual] = useState(false);
  
  // Estados para marcado manual
  const [decisionManual, setDecisionManual] = useState<'accept' | 'review' | 'reject'>('review');
  const [comentarioRevisor, setComentarioRevisor] = useState('');

  // Configuración de react-dropzone
  const onDrop = useCallback((archivosAceptados: File[]) => {
    if (archivosAceptados.length > 0 && !archivoSubido) {
      setArchivo(archivosAceptados[0]);
      setArchivoSubido(null);
      setResultado(null);
      setAsignacion(null);
      setRevisionManual(null);
      setError(null);
      setPasoActual(1);
      console.log('📄 Archivo seleccionado:', archivosAceptados[0].name);
    }
  }, [archivoSubido]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
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
      const formData = new FormData();
      formData.append('archivo', archivo);

      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        }
      );

      setArchivoSubido(respuesta.data.documento);
      setPasoActual(2);
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

  // PASO 2: Analizar documento
  const analizarDocumento = async () => {
    if (!archivoSubido) {
      setError('Primero debes subir un archivo');
      return;
    }

    setAnalizando(true);
    setError(null);

    try {
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
        { timeout: 120000 }
      );

      setResultado(respuesta.data.resultado);
      setPasoActual(3);
      console.log('🎉 Documento analizado exitosamente:', respuesta.data.resultado);

    } catch (error) {
      console.error('❌ Error analizando documento:', error);
      
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        setError(errorData?.message || 'Error analizando el documento');
      } else {
        setError('Error de conexión analizando el documento');
      }
    } finally {
      setAnalizando(false);
    }
  };

  // NUEVO: Marcado manual del documento
  const marcarManualmente = async () => {
    if (!resultado) {
      setError('No hay documento para marcar');
      return;
    }

    setMarcandoManual(true);
    setError(null);

    try {
      const payload = {
        decision: decisionManual,
        comentario: comentarioRevisor,
        revisorId: 'revisor-manual'
      };

      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/${resultado.id}/manual-review`,
        payload
      );

      setRevisionManual(respuesta.data.revision);
      setMostrarMarcadoManual(false);
      console.log('✅ Documento marcado manualmente:', respuesta.data.revision);

    } catch (error) {
      console.error('❌ Error marcando documento:', error);
      
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        setError(errorData?.message || 'Error marcando el documento');
      } else {
        setError('Error de conexión marcando el documento');
      }
    } finally {
      setMarcandoManual(false);
    }
  };

  // Asignar documento a usuario
  const asignarDocumento = async () => {
    if (!resultado || !nombreUsuario.trim()) {
      setError('Completa el nombre del usuario');
      return;
    }

    setAsignando(true);
    setError(null);

    try {
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
      setPasoActual(4);
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

  // Reiniciar proceso
  const reiniciarProceso = () => {
    setArchivo(null);
    setArchivoSubido(null);
    setResultado(null);
    setAsignacion(null);
    setRevisionManual(null);
    setError(null);
    setPasoActual(1);
    setNombreUsuario('');
    setTipoDocumento('');
    setComentarioRevisor('');
    setDecisionManual('review');
    setMostrarAsignacion(false);
    setMostrarDetalles(false);
    setMostrarMarcadoManual(false);
  };

  // Funciones auxiliares
  const obtenerColorScore = (score: number): string => {
    if (score >= 75) return '#4caf50';
    if (score >= 45) return '#ff9800';
    return '#f44336';
  };

  const obtenerIconoCategoria = (categoria: string): string => {
    switch (categoria) {
      case 'sello': return '🏛️';
      case 'firma': return '✍️';
      case 'logo': return '🎯';
      default: return '📄';
    }
  };

  const obtenerColorCalidad = (calidad: string): string => {
    switch (calidad) {
      case 'alta': return '#4caf50';
      case 'media': return '#ff9800';
      case 'baja': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const obtenerTextoDecision = (decision: string): string => {
    switch (decision) {
      case 'accept': return '✅ ACEPTADO';
      case 'reject': return '❌ RECHAZADO';
      case 'review': return '⚠️ REQUIERE REVISIÓN';
      default: return '❓ SIN MARCAR';
    }
  };

  return (
    <div className="upload-documento-container">
      {/* NUEVO: Indicador de progreso */}
      <div className="progreso-pasos">
        <div className="paso-progreso">
          <div className={`paso-numero ${pasoActual >= 1 ? 'activo' : ''} ${pasoActual > 1 ? 'completado' : ''}`}>1</div>
          <span className="paso-texto">Subir</span>
        </div>
        <div className={`linea-progreso ${pasoActual > 1 ? 'completada' : ''}`}></div>
        
        <div className="paso-progreso">
          <div className={`paso-numero ${pasoActual >= 2 ? 'activo' : ''} ${pasoActual > 2 ? 'completado' : ''}`}>2</div>
          <span className="paso-texto">Analizar</span>
        </div>
        <div className={`linea-progreso ${pasoActual > 2 ? 'completada' : ''}`}></div>
        
        <div className="paso-progreso">
          <div className={`paso-numero ${pasoActual >= 3 ? 'activo' : ''} ${pasoActual > 3 ? 'completado' : ''}`}>3</div>
          <span className="paso-texto">Resultados</span>
        </div>
        <div className={`linea-progreso ${pasoActual > 3 ? 'completada' : ''}`}></div>
        
        <div className="paso-progreso">
          <div className={`paso-numero ${pasoActual >= 4 ? 'activo' : ''}`}>4</div>
          <span className="paso-texto">Completado</span>
        </div>
      </div>

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
                <div className="info-archivo">
                  <p><strong>Nombre:</strong> {archivo.name}</p>
                  <p><strong>Tamaño:</strong> {(archivo.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Tipo:</strong> {archivo.type}</p>
                </div>
                
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
              <div className="pasos-analisis">
                <div className="paso-analisis-item">📝 Extrayendo texto</div>
                <div className="paso-analisis-item">🔍 Detectando elementos de seguridad</div>
                <div className="paso-analisis-item">🏛️ Buscando sellos oficiales</div>
                <div className="paso-analisis-item">✍️ Identificando firmas</div>
                <div className="paso-analisis-item">🎯 Reconociendo logos</div>
                <div className="paso-analisis-item">📊 Calculando score de autenticidad</div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* PASO 3: Resultados del análisis */}
      {resultado && (
        <section className="paso-resultados">
          <h3>Paso 3: Resultados del Análisis IA 📊</h3>
          
          <div className="resultado-analisis">
            {/* Score principal con estado de revisión manual */}
            <div className="score-autenticidad">
              <h4>Score de Autenticidad</h4>
              <div 
                className="score-numero"
                style={{ color: obtenerColorScore(resultado.scoreAutenticidad) }}
              >
                {resultado.scoreAutenticidad}/100
              </div>
              <p className="recomendacion">{resultado.recomendacionTexto}</p>
              
              {/* NUEVO: Estado de revisión manual */}
              {revisionManual && (
                <div className="revision-manual-estado">
                  <h5>Estado de Revisión Manual:</h5>
                  <div className={`decision-manual ${revisionManual.decision}`}>
                    {obtenerTextoDecision(revisionManual.decision)}
                  </div>
                  {revisionManual.comentario && (
                    <p className="comentario-revisor">
                      <strong>Comentario:</strong> {revisionManual.comentario}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Elementos de seguridad */}
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

            {/* Calidad del documento */}
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
              {/* NUEVO: Botón de marcado manual */}
              {!revisionManual && (
                <button 
                  onClick={() => setMostrarMarcadoManual(true)}
                  className="btn-marcar-manual"
                >
                  👨‍⚖️ Marcar Manualmente
                </button>
              )}
              
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

      {/* NUEVO: Modal de marcado manual */}
      {mostrarMarcadoManual && (
        <div className="modal-marcado-manual">
          <div className="modal-content">
            <h3>👨‍⚖️ Marcado Manual del Documento</h3>
            
            <div className="form-marcado">
              <div className="campo">
                <label htmlFor="decisionManual">Decisión Manual *</label>
                <select
                  id="decisionManual"
                  value={decisionManual}
                  onChange={(e) => setDecisionManual(e.target.value as 'accept' | 'review' | 'reject')}
                >
                  <option value="accept">✅ ACEPTAR - Documento auténtico</option>
                  <option value="review">⚠️ REVISAR - Requiere más análisis</option>
                  <option value="reject">❌ RECHAZAR - Documento no válido</option>
                </select>
              </div>

              <div className="campo">
                <label htmlFor="comentarioRevisor">Comentario del Revisor</label>
                <textarea
                  id="comentarioRevisor"
                  value={comentarioRevisor}
                  onChange={(e) => setComentarioRevisor(e.target.value)}
                  placeholder="Escribe las razones de tu decisión..."
                  rows={4}
                />
              </div>

              <div className="botones-modal">
                <button 
                  onClick={marcarManualmente}
                  disabled={marcandoManual}
                  className="btn-confirmar"
                >
                  {marcandoManual ? '⏳ Marcando...' : '✅ Confirmar Marcado'}
                </button>
                <button 
                  onClick={() => setMostrarMarcadoManual(false)}
                  className="btn-cancelar"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de análisis detallado */}
      {mostrarDetalles && resultado?.analisisDetallado && (
        <div className="modal-detalles">
          <div className="modal-content-large">
            <h3>🔍 Análisis Detallado del Documento</h3>
            
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

      {/* Modal de asignación de usuario */}
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
                  <option value="certificado_microsoft">Certificado Microsoft</option>
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
            <h3>✅ Proceso Completado Exitosamente</h3>
            <div className="detalles-finales">
              <p><strong>Usuario:</strong> {asignacion.nombreUsuario}</p>
              <p><strong>Tipo:</strong> {asignacion.tipoDocumento}</p>
              <p><strong>Fecha:</strong> {new Date(asignacion.fechaAsignacion).toLocaleString()}</p>
              {revisionManual && (
                <p><strong>Estado Manual:</strong> {obtenerTextoDecision(revisionManual.decision)}</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default UploadDocumento;