// UploadDocumento.tsx - Versión Final con Análisis Híbrido y Correcciones TypeScript
// Este archivo maneja todo el flujo de subida y análisis de documentos con IA

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

// ==================== DEFINICIÓN DE TIPOS E INTERFACES ====================
// Estas interfaces definen exactamente qué datos esperamos del backend

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

// NUEVAS INTERFACES para el análisis híbrido (Vision API + Gemini)
interface AnalisisHibrido {
  visionAPI: {
    usado: boolean;
    objetosDetectados: number;
    logosProcesados: number;
    confianzaTexto: number;
  };
  geminiAPI: {
    usado: boolean;
    scoreAutenticidad: number;
    tipoDocumento: string;
    elementosSospechosos: number;
    institucionDetectada?: string;
  };
}

// Esta interface contiene los detalles de cómo se calculó el score
interface DetallesScoring {
  factorTexto: number;
  factorElementos: number;
  factorCalidad: number;
  bonificaciones: number;
  confianza: number;
  razonamiento: string[];
}

// Resultado principal que recibimos del análisis
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
  
  // CAMPOS OPCIONALES para análisis híbrido (el ? significa que pueden no existir)
  analisisHibrido?: AnalisisHibrido;
  detallesScoring?: DetallesScoring;
  esPDF?: boolean;
  metodosProcesamiento?: string[];
}

interface AsignacionUsuario {
  documentoId: string;
  nombreUsuario: string;
  tipoDocumento: string;
  fechaAsignacion: string;
}

interface RevisionManual {
  documentoId: string;
  decision: 'accept' | 'review' | 'reject';
  comentario: string;
  revisorId: string;
  fechaRevision: string;
}

// NUEVO: Tipo para documentos listados
interface DocumentoListado {
  id: string;
  nombreArchivo: string;
  userId: string;
  fechaProcesamiento: string;
  scoreAutenticidad: number;
  recomendacion: string;
  estadoRevision?: string;
  archivoUrl: string;
}

// URL del backend - se toma de variables de entorno o usa la URL por defecto
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://docuvalle-backend-166554040569.us-central1.run.app';

// ==================== COMPONENTE PRINCIPAL ====================

const UploadDocumento: React.FC = () => {
  // ESTADOS PRINCIPALES - Controlan el flujo de la aplicación
  const [pasoActual, setPasoActual] = useState(1); // 1=Seleccionar, 2=Subir, 3=Resultados, 4=Completado
  const [archivo, setArchivo] = useState<File | null>(null); // Archivo seleccionado por el usuario
  const [archivoSubido, setArchivoSubido] = useState<ArchivoSubido | null>(null); // Archivo ya subido al servidor
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null); // Resultados del análisis
  const [asignacion, setAsignacion] = useState<AsignacionUsuario | null>(null); // Asignación a usuario
  const [revisionManual, setRevisionManual] = useState<RevisionManual | null>(null); // Revisión manual del documento
  
  // ESTADOS DE CARGA - Muestran spinners y bloquean botones mientras se procesa
  const [subiendo, setSubiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [marcandoManual, setMarcandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ESTADOS DE MODALES - Controlan qué ventanas modales están abiertas
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [mostrarAsignacion, setMostrarAsignacion] = useState(false);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [mostrarMarcadoManual, setMostrarMarcadoManual] = useState(false);
  
  // NUEVOS ESTADOS para análisis híbrido
  const [mostrarAnalisisTecnico, setMostrarAnalisisTecnico] = useState(false);
  const [progresoProcesamiento, setProgresoProcesamiento] = useState<string[]>([]);
  
  // Estados para el marcado manual
  const [decisionManual, setDecisionManual] = useState<'accept' | 'review' | 'reject'>('review');
  const [comentarioRevisor, setComentarioRevisor] = useState('');

  // ESTADOS PARA LISTADO DE DOCUMENTOS
  const [mostrarListaDocumentos, setMostrarListaDocumentos] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoListado[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<DocumentoListado | null>(null);
  const [inputUsuario, setInputUsuario] = useState('');
  const [inputFechaDesde, setInputFechaDesde] = useState('');
  const [inputFechaHasta, setInputFechaHasta] = useState('');


  // ==================== CONFIGURACIÓN DE DROPZONE ====================
  // Esta función se ejecuta cuando el usuario suelta archivos en la zona de drag & drop

  const onDrop = useCallback((archivosAceptados: File[]) => {
    // Solo procesar si hay archivos y no hay uno ya subido
    if (archivosAceptados.length > 0 && !archivoSubido) {
      // Reiniciar todo el estado para empezar de nuevo
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

  // Configuración de react-dropzone con restricciones de archivos
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],     // Imágenes
      'application/pdf': ['.pdf']               // PDFs
    },
    maxFiles: 1,                                // Solo un archivo a la vez
    maxSize: 10 * 1024 * 1024,                 // Máximo 10MB
    disabled: subiendo || analizando || !!archivoSubido // Deshabilitar si está procesando
  });

  // ==================== MÉTODOS DE PROCESAMIENTO ====================

  /**
   * Simula el progreso del análisis para dar feedback visual al usuario
   * Diferentes pasos dependiendo del tipo de archivo
   */
  const simularProgresoAnalisis = async (esPDF: boolean) => {
    // Pasos específicos para PDFs (más complejos porque usan análisis híbrido)
    const pasosPDF = [
      '📄 Preparando PDF para análisis híbrido...',
      '🤖 Extrayendo texto con Google Vision API...',
      '🖼️ Convirtiendo primera página a imagen...',
      '🧠 Analizando elementos de seguridad con Gemini...',
      '🔍 Detectando sellos y firmas...',
      '🎯 Identificando logos institucionales...',
      '📊 Combinando análisis Vision + Gemini...',
      '⚖️ Calculando score de autenticidad híbrido...'
    ];
    
    // Pasos para imágenes (más directos)
    const pasosImagen = [
      '🖼️ Preparando imagen para análisis...',
      '🤖 Extrayendo texto con Google Vision API...',
      '🧠 Analizando con Gemini Vision...',
      '🔍 Detectando elementos de seguridad...',
      '🎯 Identificando logos y sellos...',
      '📊 Calculando score de autenticidad...'
    ];

    const pasos = esPDF ? pasosPDF : pasosImagen;

    // Simular cada paso con una pausa realista
    for (let i = 0; i < pasos.length; i++) {
      setProgresoProcesamiento(prev => [...prev, pasos[i]]);
      // Pausa aleatoria entre 1-2.5 segundos para que parezca más realista
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
    }
  };

  /**
   * Subir archivo al servidor
   * Primer paso del proceso: mover el archivo del navegador al servidor
   */
  const subirArchivo = async () => {
    // Validación básica
    if (!archivo) {
      setError('Por favor selecciona un archivo primero');
      return;
    }

    setSubiendo(true);
    setError(null);

    try {
      // Crear FormData para enviar archivo
      const formData = new FormData();
      formData.append('archivo', archivo);

      console.log('📤 Subiendo archivo:', archivo.name, `(${(archivo.size / 1024 / 1024).toFixed(2)} MB)`);

      // Enviar archivo al backend
      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000, // 1 minuto de timeout
        }
      );

      // Si todo salió bien, avanzar al siguiente paso
      setArchivoSubido(respuesta.data.documento);
      setPasoActual(2);
      console.log('✅ Archivo subido exitosamente:', respuesta.data.documento);

    } catch (error) {
      console.error('❌ Error subiendo archivo:', error);
      
      // Manejo de errores específicos
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

  /**
   * Analizar documento con IA híbrida (Vision API + Gemini)
   * Este es el corazón del sistema - donde ocurre la magia de la IA
   */
  const analizarDocumento = async () => {
    if (!archivoSubido) {
      setError('Primero debes subir un archivo');
      return;
    }

    setAnalizando(true);
    setError(null);
    setProgresoProcesamiento([]); // Limpiar progreso anterior

    try {
      // Preparar datos para enviar al backend
      const payload = {
        documentoId: archivoSubido.id,
        archivoUrl: archivoSubido.archivoUrl,
        nombreArchivo: archivoSubido.nombreArchivo,
        tipoArchivo: archivoSubido.tipoArchivo,
        tamanoArchivo: archivoSubido.tamanoArchivo,
        userId: 'admin-usuario'
      };

      // Mostrar progreso visual mientras se procesa
      const esPDF = archivoSubido.tipoArchivo === 'application/pdf';
      await simularProgresoAnalisis(esPDF);

      console.log('🚀 Iniciando análisis híbrido del documento...');

      // Enviar solicitud de análisis al backend (timeout más largo para IA)
      const respuesta = await axios.post(
        `${API_BASE_URL}/api/documents/analyze`,
        payload,
        { timeout: 180000 } // 3 minutos - el análisis híbrido puede tomar tiempo
      );

      const resultadoAnalisis = respuesta.data.resultado;
      
      // Enriquecer resultado con información adicional
      const resultadoEnriquecido: ResultadoAnalisis = {
        ...resultadoAnalisis,
        esPDF: esPDF,
        metodosProcesamiento: esPDF 
          ? ['Google Vision API (PDF nativo)', 'Gemini Vision (imagen convertida)', 'Análisis híbrido combinado']
          : ['Google Vision API', 'Gemini Vision', 'Análisis híbrido']
      };

      setResultado(resultadoEnriquecido);
      setPasoActual(3); // Avanzar a mostrar resultados
      
      console.log('🎉 Documento analizado con IA híbrida:', resultadoEnriquecido);

    } catch (error) {
      console.error('❌ Error analizando documento:', error);
      
      // Manejo de errores específicos
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        setError(errorData?.message || 'Error analizando el documento con IA híbrida');
      } else {
        setError('Error de conexión analizando el documento');
      }
    } finally {
      setAnalizando(false);
      setProgresoProcesamiento([]); // Limpiar progreso
    }
  };

  /**
   * Marcar documento manualmente
   * Permite que un revisor humano override la decisión de la IA
   */
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

  /**
   * Asignar documento a un usuario específico
   * Útil para tracking y organización
   */
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
      setPasoActual(4); // Proceso completado
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

  /**
   * Reiniciar todo el proceso para procesar un nuevo documento
   */
  const reiniciarProceso = () => {
    // Limpiar todos los estados
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
    setMostrarAnalisisTecnico(false);
    setProgresoProcesamiento([]);
  };

  // ==================== FUNCIONES AUXILIARES ====================
  // Estas funciones nos ayudan con el formateo y estilizado

  const obtenerColorScore = (score: number): string => {
    if (score >= 75) return '#4caf50';  // Verde para scores altos
    if (score >= 45) return '#ff9800';  // Naranja para scores medios
    return '#f44336';                   // Rojo para scores bajos
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

  const obtenerClaseRecomendacion = (recomendacion: string): string => {
    // Estas clases corresponden al CSS que tienes
    switch (recomendacion) {
      case 'accept': return 'recomendacion accept';
      case 'reject': return 'recomendacion reject';
      case 'review': return 'recomendacion review';
      default: return 'recomendacion';
    }
  };

    // ==================== LISTADO DE DOCUMENTOS ====================
  const buscarDocumentos = async () => {
  setCargandoDocumentos(true);
  setDocumentoSeleccionado(null);
  try {
    // Construir body para el backend
    const body: any = {
      nombreUsuario: filtroUsuario.trim()
    };
    if (filtroFechaDesde) body.fechaDesde = filtroFechaDesde;
    if (filtroFechaHasta) body.fechaHasta = filtroFechaHasta;

    // Usar el endpoint POST correcto
    const res = await axios.post(`${API_BASE_URL}/api/documents/search`, body);
    setDocumentos(res.data.documentos || []);
  } catch (e) {
    setError('Error obteniendo documentos');
  } finally {
    setCargandoDocumentos(false);
  }
};

    // NUEVO: Colores para el score
  const colorScore = (score: number) => {
    if (score >= 75) return '#4caf50';
    if (score >= 45) return '#ff9800';
    return '#f44336';
  };

  // ==================== COMPONENTES INTERNOS ====================

  /**
   * Componente que muestra el progreso del análisis en tiempo real
   */
  const ProgresoAnalisisDetallado = () => (
    <div className="progreso-analisis">
      <div className="spinner"></div>
      <h4>🔍 Analizando documento con IA híbrida...</h4>
      
      {/* Lista de pasos completados */}
      <div className="pasos-analisis">
        {progresoProcesamiento.map((paso, index) => (
          <div key={index} className="paso-analisis-item">
            {paso}
          </div>
        ))}
      </div>
      
      {/* Indicadores de las tecnologías activas */}
      <div className="info-tecnologias" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(33, 150, 243, 0.1)', padding: '8px 16px', borderRadius: '20px' }}>
          <span style={{ fontSize: '1.2rem' }}>🤖</span>
          <span style={{ fontWeight: '600', color: '#1976d2' }}>Google Vision API</span>
          <span style={{ color: '#4caf50', fontWeight: '600', fontSize: '0.8rem' }}>ACTIVO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(156, 39, 176, 0.1)', padding: '8px 16px', borderRadius: '20px' }}>
          <span style={{ fontSize: '1.2rem' }}>🧠</span>
          <span style={{ fontWeight: '600', color: '#7b1fa2' }}>Gemini Vision</span>
          <span style={{ color: '#4caf50', fontWeight: '600', fontSize: '0.8rem' }}>ACTIVO</span>
        </div>
      </div>
    </div>
  );

  /**
   * Componente que muestra el análisis técnico detallado
   * CORREGIDO para manejar datos faltantes sin romper TypeScript
   */
  const AnalisisTecnicoDetallado = () => {
    // VERIFICACIÓN TEMPRANA: Si no tenemos los datos necesarios, mostrar mensaje informativo
    if (!resultado?.analisisHibrido || !resultado?.detallesScoring) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>Información técnica detallada no disponible para este análisis.</p>
          {!resultado?.analisisHibrido && (
            <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
              • Análisis híbrido no realizado
            </p>
          )}
          {!resultado?.detallesScoring && (
            <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
              • Detalles de scoring no disponibles
            </p>
          )}
        </div>
      );
    }

    // AHORA TypeScript SABE que estos datos existen - no más errores de compilación
    const { detallesScoring, analisisHibrido } = resultado;

    return (
      <div>
        {/* Información del procesamiento */}
        <div className="seccion-detalles">
          <h4>📋 Métodos de Procesamiento Utilizados</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            {resultado.metodosProcesamiento?.map((metodo, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                background: 'white', 
                padding: '12px', 
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
              }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {metodo.includes('Vision') ? '🤖' : metodo.includes('Gemini') ? '🧠' : '🔧'}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{metodo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparación Vision vs Gemini */}
        <div className="seccion-detalles">
          <h4>⚖️ Análisis Comparativo</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* Análisis Vision API */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 3px 10px rgba(0,0,0,0.08)' }}>
              <h5 style={{ margin: '0 0 15px 0', color: '#1976d2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🤖</span> Google Vision API
              </h5>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Estado:</span>
                  <span style={{ fontWeight: '600', color: analisisHibrido.visionAPI.usado ? '#4caf50' : '#f44336' }}>
                    {analisisHibrido.visionAPI.usado ? 'Utilizado' : 'No utilizado'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Objetos detectados:</span>
                  <span style={{ fontWeight: '600' }}>{analisisHibrido.visionAPI.objetosDetectados}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Logos procesados:</span>
                  <span style={{ fontWeight: '600' }}>{analisisHibrido.visionAPI.logosProcesados}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: '#666' }}>Confianza texto:</span>
                  <span style={{ fontWeight: '600', color: '#4caf50' }}>{analisisHibrido.visionAPI.confianzaTexto}%</span>
                </div>
              </div>
            </div>

            {/* Análisis Gemini */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 3px 10px rgba(0,0,0,0.08)' }}>
              <h5 style={{ margin: '0 0 15px 0', color: '#7b1fa2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🧠</span> Gemini Vision AI
              </h5>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Estado:</span>
                  <span style={{ fontWeight: '600', color: analisisHibrido.geminiAPI.usado ? '#4caf50' : '#f44336' }}>
                    {analisisHibrido.geminiAPI.usado ? 'Utilizado' : 'No disponible'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Score autenticidad:</span>
                  <span style={{ fontWeight: '600' }}>{analisisHibrido.geminiAPI.scoreAutenticidad}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Tipo detectado:</span>
                  <span style={{ fontWeight: '600' }}>{analisisHibrido.geminiAPI.tipoDocumento}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>Elementos sospechosos:</span>
                  <span style={{ fontWeight: '600', color: analisisHibrido.geminiAPI.elementosSospechosos > 0 ? '#f44336' : '#4caf50' }}>
                    {analisisHibrido.geminiAPI.elementosSospechosos}
                  </span>
                </div>
                {analisisHibrido.geminiAPI.institucionDetectada && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#666' }}>Institución:</span>
                    <span style={{ fontWeight: '600', color: '#2196f3' }}>{analisisHibrido.geminiAPI.institucionDetectada}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desglose del scoring */}
        <div className="seccion-detalles">
          <h4>📊 Desglose del Score de Autenticidad</h4>
          <div style={{ display: 'grid', gap: '15px' }}>
            
            {/* Barras de progreso para cada factor - SEGURAS con valores por defecto */}
            {[
              { label: 'Factor Texto', valor: detallesScoring.factorTexto || 0, color: '#2196f3' },
              { label: 'Factor Elementos', valor: detallesScoring.factorElementos || 0, color: '#4caf50' },
              { label: 'Factor Calidad', valor: detallesScoring.factorCalidad || 0, color: '#ff9800' },
              { label: 'Bonificaciones', valor: detallesScoring.bonificaciones || 0, color: '#9c27b0' }
            ].map((factor, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '15px',
                background: 'white',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
              }}>
                <span style={{ minWidth: '120px', fontWeight: '500', color: '#555' }}>{factor.label}:</span>
                <div style={{ 
                  flex: 1, 
                  height: '8px', 
                  background: '#f0f0f0', 
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{ 
                    width: `${Math.min(factor.valor, 100)}%`, 
                    height: '100%', 
                    background: factor.color,
                    borderRadius: '4px',
                    transition: 'width 1s ease-out'
                  }}></div>
                </div>
                <span style={{ minWidth: '50px', fontWeight: '600', color: factor.color }}>{factor.valor}%</span>
              </div>
            ))}
            
            {/* Confianza total */}
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
              borderRadius: '10px',
              border: '2px solid #2196f3',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1976d2' }}>
                Confianza del análisis: {detallesScoring.confianza || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Razonamiento del algoritmo - CORREGIDO para evitar errores TypeScript */}
        <div className="seccion-detalles">
          <h4>🧮 Razonamiento del Algoritmo</h4>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px' }}>
            {/* VERIFICACIÓN SEGURA: Solo mostrar si existe razonamiento */}
            {detallesScoring.razonamiento && detallesScoring.razonamiento.length > 0 ? (
              detallesScoring.razonamiento.map((razon, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '10px 0',
                  // LÍNEA CORREGIDA: Usar verificación segura para evitar el error de TypeScript
                  borderBottom: index < (detallesScoring.razonamiento?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none'
                }}>
                  <span style={{ 
                    minWidth: '24px', 
                    height: '24px', 
                    background: '#2196f3', 
                    color: 'white', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: '600'
                  }}>
                    {index + 1}
                  </span>
                  <span style={{ color: '#333', lineHeight: '1.5' }}>{razon}</span>
                </div>
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '20px', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                <p>No hay razonamiento detallado disponible para este análisis.</p>
              </div>
            )}
          </div>
        </div>

        {/* Información específica de PDF */}
        {resultado.esPDF && (
          <div className="seccion-detalles">
            <h4>📄 Información Específica de PDF</h4>
            <div style={{ 
              background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: '2px solid #ff9800'
            }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#4caf50', fontSize: '1.2rem' }}>✅</span>
                  <span style={{ color: '#e65100', fontWeight: '500' }}>Documento PDF procesado con análisis híbrido</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🤖</span>
                  <span style={{ color: '#e65100' }}>Vision API: Texto extraído directamente del PDF</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🧠</span>
                  <span style={{ color: '#e65100' }}>Gemini: Análisis visual de página convertida a imagen</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🔄</span>
                  <span style={{ color: '#e65100' }}>Resultados combinados para máxima precisión</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Componente que muestra el botón para ver documentos procesados
   * y maneja la lógica de mostrar/ocultar la lista de documentos
   */
  const DocumentosProcesadosModal: React.FC<{
  mostrarListaDocumentos: boolean;
  setMostrarListaDocumentos: React.Dispatch<React.SetStateAction<boolean>>;
  filtroUsuario: string;
  setFiltroUsuario: React.Dispatch<React.SetStateAction<string>>;
  filtroFechaDesde: string;
  setFiltroFechaDesde: React.Dispatch<React.SetStateAction<string>>;
  filtroFechaHasta: string;
  setFiltroFechaHasta: React.Dispatch<React.SetStateAction<string>>;
  buscarDocumentos: () => void;
  documentos: DocumentoListado[];
  cargandoDocumentos: boolean;
  documentoSeleccionado: DocumentoListado | null;
  setDocumentoSeleccionado: React.Dispatch<React.SetStateAction<DocumentoListado | null>>;
  colorScore: (score: number) => string;
  }> = ({
    mostrarListaDocumentos,
    setMostrarListaDocumentos,
    filtroUsuario,
    setFiltroUsuario,
    filtroFechaDesde,
    setFiltroFechaDesde,
    filtroFechaHasta,
    setFiltroFechaHasta,
    buscarDocumentos,
    documentos,
    cargandoDocumentos,
    documentoSeleccionado,
    setDocumentoSeleccionado,
    colorScore
  }) => {
    // Estados locales para los inputs de filtro
    const [inputUsuario, setInputUsuario] = React.useState(filtroUsuario);
    const [inputFechaDesde, setInputFechaDesde] = React.useState(filtroFechaDesde);
    const [inputFechaHasta, setInputFechaHasta] = React.useState(filtroFechaHasta);

    // Sincroniza los inputs locales con los filtros globales cuando se abre el modal
    React.useEffect(() => {
      if (mostrarListaDocumentos) {
        setInputUsuario(filtroUsuario);
        setInputFechaDesde(filtroFechaDesde);
        setInputFechaHasta(filtroFechaHasta);
      }
      // eslint-disable-next-line
    }, [mostrarListaDocumentos]);

    // Al hacer click en buscar, actualiza los filtros globales y ejecuta la búsqueda
    const handleBuscar = () => {
      setFiltroUsuario(inputUsuario);
      setFiltroFechaDesde(inputFechaDesde);
      setFiltroFechaHasta(inputFechaHasta);
      buscarDocumentos();
    };

    return (
      <>
        <div style={{ margin: '32px 0 0 0', textAlign: 'center' }}>
          <button
            className="btn-ver-documentos"
            style={{
              background: 'linear-gradient(90deg, #2196f3 0%, #21cbf3 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 22px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
            onClick={() => {
              setMostrarListaDocumentos(true);
              buscarDocumentos();
            }}
          >
            📚 Ver Documentos Procesados
          </button>
        </div>

        {mostrarListaDocumentos && (
          <div className="modal-lista-documentos" style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="modal-content-large" style={{
              background: 'white', borderRadius: '14px', padding: '32px', width: '90vw', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3>📚 Documentos Procesados</h3>
                <button onClick={() => setMostrarListaDocumentos(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>
                  ✕
                </button>
              </div>
              {/* Filtros */}
              <div style={{ display: 'flex', gap: '18px', marginBottom: 18, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Filtrar por usuario asignado"
                  value={inputUsuario}
                  onChange={e => setInputUsuario(e.target.value)}
                  style={{ padding: '7px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '180px' }}
                />
                <input
                  type="date"
                  value={inputFechaDesde}
                  onChange={e => setInputFechaDesde(e.target.value)}
                  style={{ padding: '7px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
                <input
                  type="date"
                  value={inputFechaHasta}
                  onChange={e => setInputFechaHasta(e.target.value)}
                  style={{ padding: '7px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
                <button
                  onClick={handleBuscar}
                  style={{
                    background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px',
                    padding: '7px 18px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  🔍 Buscar
                </button>
              </div>
              {/* Lista de documentos */}
              {cargandoDocumentos ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Cargando documentos...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.98rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '8px' }}>Usuario</th>
                        <th style={{ padding: '8px' }}>Archivo</th>
                        <th style={{ padding: '8px' }}>Fecha</th>
                        <th style={{ padding: '8px' }}>Score</th>
                        <th style={{ padding: '8px' }}>Estado</th>
                        <th style={{ padding: '8px' }}>Ver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentos.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                            No se encontraron documentos.
                          </td>
                        </tr>
                      ) : (
                        documentos.map(doc => (
                          <tr key={doc.id} style={{ borderBottom: '1px solid #eee', background: documentoSeleccionado?.id === doc.id ? '#e3f2fd' : 'white' }}>
                            <td style={{ padding: '8px' }}>{doc.userId || <span style={{ color: '#aaa' }}>Sin asignar</span>}</td>
                            <td style={{ padding: '8px' }}>{doc.nombreArchivo}</td>
                            <td style={{ padding: '8px' }}>{new Date(doc.fechaProcesamiento).toLocaleString()}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{
                                fontWeight: 700,
                                color: colorScore(doc.scoreAutenticidad),
                                background: '#f0f0f0',
                                borderRadius: '6px',
                                padding: '2px 10px'
                              }}>
                                {doc.scoreAutenticidad}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <span style={{
                                color: doc.recomendacion === 'accept' ? '#4caf50' :
                                  doc.recomendacion === 'review' ? '#ff9800' : '#f44336',
                                fontWeight: 600
                              }}>
                                {doc.recomendacion?.toUpperCase() || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <button
                                style={{
                                  background: '#1976d2', color: 'white', border: 'none',
                                  borderRadius: '5px', padding: '3px 12px', cursor: 'pointer'
                                }}
                                onClick={() => setDocumentoSeleccionado(doc)}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Detalles del documento seleccionado */}
              {documentoSeleccionado && (
                <div style={{
                  marginTop: '28px', background: '#f9f9f9', borderRadius: '10px', padding: '18px 22px'
                }}>
                  <h4>📄 Detalles del Documento</h4>
                  <p><b>Usuario:</b> {documentoSeleccionado.userId}</p>
                  <p><b>Archivo:</b> {documentoSeleccionado.nombreArchivo}</p>
                  <p><b>Fecha:</b> {new Date(documentoSeleccionado.fechaProcesamiento).toLocaleString()}</p>
                  <p><b>Score:</b> <span style={{ color: colorScore(documentoSeleccionado.scoreAutenticidad), fontWeight: 700 }}>{documentoSeleccionado.scoreAutenticidad}</span></p>
                  <p><b>Estado:</b> {documentoSeleccionado.recomendacion?.toUpperCase()}</p>
                  <p>
                    <b>Enlace:</b> <a href={documentoSeleccionado.archivoUrl} target="_blank" rel="noopener noreferrer">Ver archivo</a>
                  </p>
                  <button
                    style={{
                      marginTop: '10px', background: '#1976d2', color: 'white', border: 'none',
                      borderRadius: '5px', padding: '7px 18px', cursor: 'pointer'
                    }}
                    onClick={() => setDocumentoSeleccionado(null)}
                  >
                    Ocultar Detalles
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  // ==================== RENDERIZADO PRINCIPAL ====================

  return (
    <>
    <div className="upload-documento-container">
      
      {/* Indicador de progreso de pasos */}
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

      <h2>📄 Procesar Documento (Con IA Híbrida Avanzada)</h2>
      
      {/* Mensaje de error */}
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
                
                {/* Preview para imágenes */}
                {archivo.type.startsWith('image/') && (
                  <div className="preview-imagen">
                    <img 
                      src={URL.createObjectURL(archivo)} 
                      alt="Preview"
                      style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                
                {/* Preview para PDFs */}
                {archivo.type === 'application/pdf' && (
                  <div className="preview-pdf">
                    <div className="pdf-icon">📄</div>
                    <p>Archivo PDF listo para procesamiento híbrido</p>
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
            
            {/* Información del método de análisis */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#2e7d32', fontSize: '1rem' }}>🔬 Método de Análisis Híbrido:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(33, 150, 243, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                  <span>🤖</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Google Vision API</span>
                  <span style={{ color: '#4caf50', fontSize: '0.8rem', fontWeight: '600' }}>✓ Activo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(156, 39, 176, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                  <span>🧠</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Gemini Vision AI</span>
                  <span style={{ color: '#4caf50', fontSize: '0.8rem', fontWeight: '600' }}>✓ Activo</span>
                </div>
                {archivoSubido.tipoArchivo === 'application/pdf' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 152, 0, 0.1)', padding: '8px 12px', borderRadius: '8px', gridColumn: '1 / -1' }}>
                    <span>📄</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Procesamiento híbrido especial para PDF</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="botones-analisis">
            <button 
              onClick={analizarDocumento} 
              disabled={analizando}
              className="btn-analizar"
            >
              {analizando ? '⏳ Analizando con IA Híbrida...' : '🚀 Analizar con IA Híbrida (Vision + Gemini)'}
            </button>
            
            <button 
              onClick={reiniciarProceso}
              className="btn-nuevo-small"
            >
              📄 Subir Otro Archivo
            </button>
          </div>

          {/* Progreso del análisis */}
          {analizando && <ProgresoAnalisisDetallado />}
        </section>
      )}

      {/* PASO 3: Resultados del análisis */}
      {resultado && (
        <section className="paso-resultados">
          <h3>Paso 3: Resultados del Análisis IA Híbrida 📊</h3>
          
          <div className="resultado-analisis">
            
            {/* Score principal con información híbrida */}
            <div className="score-autenticidad">
              <h4>Score de Autenticidad Híbrida</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                <div 
                  className="score-numero"
                  style={{ color: obtenerColorScore(resultado.scoreAutenticidad) }}
                >
                  {resultado.scoreAutenticidad}/100
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Mostrar confianza solo si existe - CORREGIDO */}
                  {resultado.detallesScoring && (
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      Confianza: <span style={{ fontWeight: '600', color: '#333' }}>{resultado.detallesScoring.confianza}%</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {resultado.analisisHibrido?.visionAPI.usado && (
                      <span style={{ 
                        background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)', 
                        color: 'white', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🤖 Vision
                      </span>
                    )}
                    {resultado.analisisHibrido?.geminiAPI.usado && (
                      <span style={{ 
                        background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)', 
                        color: 'white', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🧠 Gemini
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Recomendación con clase CSS correcta */}
              <p className={obtenerClaseRecomendacion(resultado.recomendacion)}>
                {resultado.recomendacionTexto}
              </p>
              
              {/* Estado de revisión manual */}
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
              {!revisionManual && (
                <button 
                  onClick={() => setMostrarMarcadoManual(true)}
                  className="btn-marcar-manual"
                >
                  👨‍⚖️ Marcar Manualmente
                </button>
              )}
              
              {/* Botón para análisis técnico detallado */}
              <button 
                onClick={() => setMostrarAnalisisTecnico(true)}
                className="btn-detalles"
                style={{ background: 'linear-gradient(135deg, #673ab7 0%, #512da8 100%)' }}
              >
                🔬 Análisis Técnico Híbrido
              </button>
              
              {resultado.analisisDetallado && (
                <button 
                  onClick={() => setMostrarDetalles(true)}
                  className="btn-detalles"
                >
                  🔍 Ver Elementos Detectados
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

      {/* ==================== MODALES ==================== */}

      {/* Modal de análisis técnico híbrido */}
      {mostrarAnalisisTecnico && resultado && (
        <div className="modal-detalles">
          <div className="modal-content-large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3>🔬 Análisis Técnico Híbrido Detallado</h3>
              <button 
                onClick={() => setMostrarAnalisisTecnico(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer',
                  color: '#666',
                  padding: '8px'
                }}
              >
                ✕
              </button>
            </div>
            
            <AnalisisTecnicoDetallado />
            
            <div className="botones-modal">
              <button 
                onClick={() => setMostrarAnalisisTecnico(false)}
                className="btn-cerrar"
              >
                ✕ Cerrar Análisis Técnico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de marcado manual */}
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

      {/* Modal de análisis detallado de elementos */}
      {mostrarDetalles && resultado?.analisisDetallado && (
        <div className="modal-detalles">
          <div className="modal-content-large">
            <h3>🔍 Análisis Detallado de Elementos</h3>
            
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
                  <option value="certificado_tecnologico">Certificado Tecnológico</option>
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
              {resultado?.analisisHibrido && (
                <p><strong>Análisis:</strong> {resultado.analisisHibrido.visionAPI.usado && resultado.analisisHibrido.geminiAPI.usado ? 'Híbrido (Vision + Gemini)' : 'Básico'}</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
    <DocumentosProcesadosModal
    mostrarListaDocumentos={mostrarListaDocumentos}
    setMostrarListaDocumentos={setMostrarListaDocumentos}
    filtroUsuario={filtroUsuario}
    setFiltroUsuario={setFiltroUsuario}
    filtroFechaDesde={filtroFechaDesde}
    setFiltroFechaDesde={setFiltroFechaDesde}
    filtroFechaHasta={filtroFechaHasta}
    setFiltroFechaHasta={setFiltroFechaHasta}
    buscarDocumentos={buscarDocumentos}
    documentos={documentos}
    cargandoDocumentos={cargandoDocumentos}
    documentoSeleccionado={documentoSeleccionado}
    setDocumentoSeleccionado={setDocumentoSeleccionado}
    colorScore={colorScore}/>
    </>
  );
};

export default UploadDocumento;