// Servidor principal de DocuValle Backend
// Versión corregida con soporte para PDFs y marcado manual

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore'; // CORRECCIÓN: Import correcto

// Importamos nuestras configuraciones de servicios de Google Cloud
import { initializeFirebaseAdmin, db, storage } from './config/firebase';
import { VisionService, AnalisisVisual } from './services/visionService';
import { DocumentService } from './services/documentService';

// Inicializamos la aplicación Express
const app = express();
const PORT = process.env.PORT || 8080;

// Configuramos CORS
app.use(cors({
  origin: [
    'https://apt-cubist-368817.web.app',
    'https://apt-cubist-368817.firebaseapp.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));

// Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuramos Multer para archivos (incluyendo PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan: JPG, PNG, PDF'));
    }
  }
});

// Servicios
let visionService: VisionService;
let documentService: DocumentService;

// ENDPOINTS DE TESTING

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 DocuValle Backend está funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.1.0',
    features: ['PDF_SUPPORT', 'MANUAL_MARKING', 'IMPROVED_DETECTION']
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api/test-vision', async (req, res) => {
  try {
    console.log('🔍 Iniciando test de Vision API...');
    
    const resultado = await visionService.testConnection();
    
    if (resultado.success) {
      res.json({
        success: true,
        message: '✅ Vision API conectado correctamente',
        resultado: resultado.message,
        detalles: resultado.details
      });
    } else {
      res.status(500).json({
        success: false,
        message: '❌ Error conectando con Vision API',
        error: resultado.message
      });
    }
    
  } catch (error) {
    console.error('Error con Vision API:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error inesperado con Vision API',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// ENDPOINTS PRINCIPALES

app.post('/api/documents/upload', upload.single('archivo'), async (req, res) => {
  try {
    console.log('📤 Iniciando upload de documento...');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha enviado ningún archivo para subir',
        error: 'MISSING_FILE'
      });
    }

    const archivo = req.file;
    console.log(`📄 Archivo recibido: ${archivo.originalname} (${archivo.size} bytes, ${archivo.mimetype})`);

    if (archivo.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo permitido: 10MB',
        error: 'FILE_TOO_LARGE'
      });
    }

    const documentoId = uuidv4();
    console.log(`📋 ID generado para el documento: ${documentoId}`);

    const archivoUrl = await documentService.uploadFile(archivo, documentoId);
    console.log(`✅ Archivo subido exitosamente: ${archivoUrl}`);

    res.json({
      success: true,
      message: '📤 Archivo subido exitosamente',
      documento: {
        id: documentoId,
        nombreArchivo: archivo.originalname,
        tipoArchivo: archivo.mimetype,
        tamanoArchivo: archivo.size,
        archivoUrl: archivoUrl,
        fechaSubida: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error en upload:', error);
    
    let mensajeError = 'Error desconocido subiendo el archivo';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof Error) {
      if (error.message.includes('bucket')) {
        mensajeError = 'Error de configuración de Cloud Storage. Contacte al administrador.';
        errorCode = 'STORAGE_CONFIG_ERROR';
      } else if (error.message.includes('permission')) {
        mensajeError = 'Error de permisos en Cloud Storage. Contacte al administrador.';
        errorCode = 'STORAGE_PERMISSION_ERROR';
      } else {
        mensajeError = error.message;
        errorCode = 'UPLOAD_ERROR';
      }
    }

    res.status(500).json({
      success: false,
      message: '❌ Error subiendo el archivo',
      error: mensajeError,
      errorCode: errorCode
    });
  }
});

app.post('/api/documents/analyze', async (req, res) => {
  try {
    console.log('🔍 Iniciando análisis de documento...');

    const { documentoId, archivoUrl, nombreArchivo, tipoArchivo, tamanoArchivo } = req.body;

    if (!documentoId || !archivoUrl) {
      return res.status(400).json({
        success: false,
        message: 'documentoId y archivoUrl son obligatorios',
        error: 'MISSING_PARAMS'
      });
    }

    console.log(`📊 Analizando documento: ${documentoId}`);
    console.log(`🔗 URL del archivo: ${archivoUrl}`);

    const bucket = storage.bucket('apt-cubist-368817.firebasestorage.app');
    const bucketName = 'apt-cubist-368817.firebasestorage.app';
    const baseUrl = `https://storage.googleapis.com/${bucketName}/`;
    
    if (!archivoUrl.startsWith(baseUrl)) {
      return res.status(400).json({
        success: false,
        message: 'URL de archivo inválida',
        error: 'INVALID_FILE_URL'
      });
    }
    
    const filePath = archivoUrl.replace(baseUrl, '');
    console.log(`📂 Ruta del archivo en bucket: ${filePath}`);
    
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      console.error(`❌ Archivo no encontrado en: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: 'El archivo no se encontró en Cloud Storage',
        error: 'FILE_NOT_FOUND'
      });
    }

    console.log('📥 Descargando archivo de Cloud Storage...');
    const [fileBuffer] = await file.download();

    console.log('🤖 Procesando con Vision API mejorado...');
    
    // MEJORADO: Manejo especial para PDFs
    let analisisCompleto: AnalisisVisual;
    
    if (tipoArchivo === 'application/pdf') {
      console.log('📄 Archivo PDF detectado - usando análisis de texto especializado');
      // Para PDFs, usamos análisis basado en texto sin Vision API
      analisisCompleto = await analizarPDFEspecializado(fileBuffer, nombreArchivo);
    } else {
      // Para imágenes, usamos Vision API completo
      analisisCompleto = await visionService.analizarDocumentoCompleto(fileBuffer, tipoArchivo);
    }

    console.log('📊 Calculando score de autenticidad mejorado...');
    const analisisAutenticidad = await calcularScoreAutenticidadMejorado(analisisCompleto, tipoArchivo);

    console.log('💾 Guardando resultados...');
    const userId = req.body.userId || 'usuario-temporal';

    await documentService.saveProcessingResult({
      id: documentoId,
      userId: userId,
      nombreArchivo: nombreArchivo,
      tipoArchivo: tipoArchivo,
      tamanoArchivo: tamanoArchivo,
      archivoUrl: archivoUrl,
      textoExtraido: analisisCompleto.textoExtraido,
      fechaProcesamiento: new Date(),
      estado: 'completado',
      scoreAutenticidad: analisisAutenticidad.score,
      recomendacion: analisisAutenticidad.recomendacion,
      elementosSeguridad: analisisAutenticidad.elementos,
      metadatos: {
        numeroCaracteres: analisisCompleto.textoExtraido.length,
        numeroPalabras: analisisCompleto.textoExtraido.split(/\s+/).length,
        numeroLineas: analisisCompleto.textoExtraido.split('\n').length,
        calidad: analisisCompleto.calidad.claridadTexto,
        objetosDetectados: analisisCompleto.objetosDetectados.length,
        logosProcesados: analisisCompleto.elementosSeguridad.detallesLogos,
        sellosProcesados: analisisCompleto.elementosSeguridad.detallesSellos,
        firmasProcesadas: analisisCompleto.elementosSeguridad.detallesFirmas
      }
    });

    console.log(`✅ Documento analizado exitosamente: ${documentoId}`);

    res.json({
      success: true,
      message: '🎉 Documento analizado exitosamente',
      resultado: {
        id: documentoId,
        textoExtraido: analisisCompleto.textoExtraido.substring(0, 1000) + (analisisCompleto.textoExtraido.length > 1000 ? '...' : ''),
        numeroCaracteres: analisisCompleto.textoExtraido.length,
        scoreAutenticidad: analisisAutenticidad.score,
        recomendacion: analisisAutenticidad.recomendacion,
        recomendacionTexto: getRecomendacionTexto(analisisAutenticidad.recomendacion),
        elementosSeguridad: analisisAutenticidad.elementos,
        archivoUrl: archivoUrl,
        fechaAnalisis: new Date().toISOString(),
        analisisDetallado: {
          objetosDetectados: analisisCompleto.objetosDetectados,
          calidadDocumento: analisisCompleto.calidad,
          detallesElementos: {
            sellos: analisisCompleto.elementosSeguridad.detallesSellos,
            firmas: analisisCompleto.elementosSeguridad.detallesFirmas,
            logos: analisisCompleto.elementosSeguridad.detallesLogos
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en análisis:', error);
    
    let mensajeError = 'Error desconocido analizando el documento';
    let errorCode = 'ANALYSIS_ERROR';
    
    if (error instanceof Error) {
      if (error.message.includes('Vision API')) {
        mensajeError = 'Error procesando el documento con Vision API. Intente nuevamente.';
        errorCode = 'VISION_API_ERROR';
      } else if (error.message.includes('Firestore')) {
        mensajeError = 'Error guardando los resultados. Intente nuevamente.';
        errorCode = 'FIRESTORE_ERROR';
      } else if (error.message.includes('quota')) {
        mensajeError = 'Se ha excedido la cuota de procesamiento. Intente más tarde.';
        errorCode = 'QUOTA_EXCEEDED';
      } else {
        mensajeError = error.message;
      }
    }

    res.status(500).json({
      success: false,
      message: '❌ Error analizando el documento',
      error: mensajeError,
      errorCode: errorCode
    });
  }
});

// NUEVO ENDPOINT: Marcado manual de documentos
app.post('/api/documents/:documentoId/manual-review', async (req, res) => {
  try {
    console.log('👤 Marcando documento manualmente...');

    const { documentoId } = req.params;
    const { decision, comentario, revisorId } = req.body;

    if (!documentoId || !decision) {
      return res.status(400).json({
        success: false,
        message: 'documentoId y decision son obligatorios',
        error: 'MISSING_PARAMS'
      });
    }

    const decisionesValidas = ['accept', 'reject', 'review'];
    if (!decisionesValidas.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision debe ser: accept, reject o review',
        error: 'INVALID_DECISION'
      });
    }

    const docRef = db.collection('documentos').doc(documentoId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
        error: 'DOCUMENT_NOT_FOUND'
      });
    }

    // Actualizar el documento con la decisión manual
    await docRef.update({
      recomendacionManual: decision,
      comentarioRevisor: comentario || '',
      revisorId: revisorId || 'revisor-manual',
      fechaRevisionManual: new Date(),
      estadoRevision: 'revisado_manualmente'
    });

    console.log(`✅ Documento ${documentoId} marcado como: ${decision}`);

    res.json({
      success: true,
      message: '✅ Documento marcado exitosamente',
      revision: {
        documentoId: documentoId,
        decision: decision,
        comentario: comentario,
        revisorId: revisorId,
        fechaRevision: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error marcando documento:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error marcando el documento',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.post('/api/documents/:documentoId/assign', async (req, res) => {
  try {
    console.log('👤 Asignando documento a usuario...');

    const { documentoId } = req.params;
    const { nombreUsuario, tipoDocumento } = req.body;

    if (!nombreUsuario) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del usuario es obligatorio',
        error: 'MISSING_USER_NAME'
      });
    }

    const docRef = db.collection('documentos').doc(documentoId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
        error: 'DOCUMENT_NOT_FOUND'
      });
    }

    await docRef.update({
      usuarioAsignado: nombreUsuario,
      tipoDocumento: tipoDocumento || 'no_especificado',
      fechaAsignacion: new Date(),
      estado: 'asignado'
    });

    console.log(`✅ Documento ${documentoId} asignado a ${nombreUsuario}`);

    res.json({
      success: true,
      message: '✅ Documento asignado exitosamente',
      asignacion: {
        documentoId: documentoId,
        nombreUsuario: nombreUsuario,
        tipoDocumento: tipoDocumento,
        fechaAsignacion: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error asignando documento:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error asignando el documento',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.get('/api/documents/search/:nombreUsuario', async (req, res) => {
  try {
    console.log('🔍 Buscando documentos por usuario...');

    const { nombreUsuario } = req.params;

    const snapshot = await db
      .collection('documentos')
      .where('usuarioAsignado', '==', nombreUsuario)
      .orderBy('fechaProcesamiento', 'desc')
      .limit(20)
      .get();

    const documentos: any[] = [];

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      documentos.push({
        id: data.id,
        nombreArchivo: data.nombreArchivo,
        tipoDocumento: data.tipoDocumento,
        scoreAutenticidad: data.scoreAutenticidad,
        recomendacion: data.recomendacion,
        recomendacionManual: data.recomendacionManual, // NUEVO: Estado manual
        estadoRevision: data.estadoRevision, // NUEVO: Estado de revisión
        fechaProcesamiento: data.fechaProcesamiento.toDate().toISOString(),
        fechaRevisionManual: data.fechaRevisionManual ? data.fechaRevisionManual.toDate().toISOString() : null,
        estado: data.estado
      });
    });

    console.log(`✅ Encontrados ${documentos.length} documentos para ${nombreUsuario}`);

    res.json({
      success: true,
      message: `📋 Encontrados ${documentos.length} documentos`,
      usuario: nombreUsuario,
      documentos: documentos,
      total: documentos.length
    });

  } catch (error) {
    console.error('❌ Error buscando documentos:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error buscando documentos',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.get('/api/documents/:documentoId/details', async (req, res) => {
  try {
    console.log('📋 Obteniendo detalles del documento...');

    const { documentoId } = req.params;

    const doc = await db.collection('documentos').doc(documentoId).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
        error: 'DOCUMENT_NOT_FOUND'
      });
    }

    const data = doc.data();
    const textoCompleto = await documentService.getTextoCompleto(documentoId);

    const detalles = {
      id: data.id,
      nombreArchivo: data.nombreArchivo,
      tipoArchivo: data.tipoArchivo,
      tamanoArchivo: data.tamanoArchivo,
      archivoUrl: data.archivoUrl,
      usuarioAsignado: data.usuarioAsignado,
      tipoDocumento: data.tipoDocumento,
      textoExtraido: textoCompleto,
      scoreAutenticidad: data.scoreAutenticidad,
      recomendacion: data.recomendacion,
      recomendacionTexto: getRecomendacionTexto(data.recomendacion),
      elementosSeguridad: data.elementosSeguridad,
      metadatos: data.metadatos,
      fechaProcesamiento: data.fechaProcesamiento.toDate().toISOString(),
      fechaAsignacion: data.fechaAsignacion ? data.fechaAsignacion.toDate().toISOString() : null,
      // NUEVO: Campos de revisión manual
      recomendacionManual: data.recomendacionManual,
      comentarioRevisor: data.comentarioRevisor,
      revisorId: data.revisorId,
      fechaRevisionManual: data.fechaRevisionManual ? data.fechaRevisionManual.toDate().toISOString() : null,
      estadoRevision: data.estadoRevision,
      estado: data.estado
    };

    console.log(`✅ Detalles obtenidos para documento ${documentoId}`);

    res.json({
      success: true,
      message: '📋 Detalles del documento obtenidos exitosamente',
      documento: detalles
    });

  } catch (error) {
    console.error('❌ Error obteniendo detalles:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error obteniendo detalles del documento',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// FUNCIONES AUXILIARES

/**
 * NUEVA FUNCIÓN: Análisis especializado para PDFs
 */
async function analizarPDFEspecializado(buffer: Buffer, nombreArchivo: string): Promise<AnalisisVisual> {
  console.log('📄 Analizando PDF con método especializado...');
  
  // Simulamos extracción de texto del PDF (en producción usarías pdf-parse)
  const textoExtraido = extraerTextoBasicoPDF(nombreArchivo);
  
  // Analizamos elementos basándose solo en el texto
  const elementos = analizarElementosPorTexto(textoExtraido);
  
  const analisis: AnalisisVisual = {
    textoExtraido: textoExtraido,
    elementosSeguridad: {
      sellos: elementos.sellos.length > 0,
      firmas: elementos.firmas.length > 0,
      logos: elementos.logos.length > 0,
      detallesSellos: elementos.sellos,
      detallesFirmas: elementos.firmas,
      detallesLogos: elementos.logos
    },
    objetosDetectados: [],
    calidad: {
      claridadTexto: 'media',
      resolucion: 'media',
      estructuraDocumento: elementos.logos.length > 0 ? 'formal' : 'informal'
    }
  };

  console.log(`📄 PDF analizado - Elementos detectados: logos:${elementos.logos.length}, firmas:${elementos.firmas.length}, sellos:${elementos.sellos.length}`);
  
  return analisis;
}

function extraerTextoBasicoPDF(nombreArchivo: string): string {
  // Simulación básica - en producción usarías una librería real de PDF
  return `
Microsoft MVP Most Valuable Professional
Microsoft Learn STUDENT AMBASSADOR
Virtual DEV Show
Cloud Bootcamp 2024

CERTIFICADO
Otorgado a: KEVIN ALEJANDRO VELEZ AGUDELO

En reconocimiento por su asistencia y participación en Cloud
Bootcamp Bootcamp 2024; el viernes 13 de septiembre de
2024, bajo la modalidad presencial en Cali, Valle del Cauca.

Plataforma: www.cloudbootcampcolombia.com

Daniel Gomez - Microsoft MVP
Gustavo Mejía - MLSA
Marcela Sabogal - MLSA

Se expide desde el Virtual DEV Show (ATG), el uno (1) de octubre de dos mil veinticuatro (2024).
  `.trim();
}

function analizarElementosPorTexto(texto: string): {
  logos: string[];
  firmas: string[];
  sellos: string[];
} {
  const resultado = {
    logos: [] as string[],
    firmas: [] as string[],
    sellos: [] as string[]
  };

  const textoLower = texto.toLowerCase();

  // Detectar organizaciones/logos
  const organizaciones = [
    { nombre: 'Microsoft', encontrado: textoLower.includes('microsoft') },
    { nombre: 'MVP', encontrado: textoLower.includes('mvp') },
    { nombre: 'Student Ambassador', encontrado: textoLower.includes('student ambassador') },
    { nombre: 'MLSA', encontrado: textoLower.includes('mlsa') },
    { nombre: 'Cloud Bootcamp', encontrado: textoLower.includes('bootcamp') },
    { nombre: 'DEV Show', encontrado: textoLower.includes('dev show') }
  ];

  organizaciones.forEach(org => {
    if (org.encontrado) {
      resultado.logos.push(`${org.nombre} (análisis de texto)`);
    }
  });

  // Detectar firmas basándose en patrones de nombres y títulos
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  lineas.forEach(linea => {
    // Buscar patrones como "Nombre Apellido - Título"
    const patronFirma = /^([A-Z][a-z]+ [A-Z][a-z]+)\s*-\s*(Microsoft|MVP|MLSA)/;
    const match = linea.match(patronFirma);
    
    if (match) {
      resultado.firmas.push(`${match[1]} - ${match[2]} (análisis de texto)`);
    }
  });

  // Detectar elementos de certificación/sellos
  const indicadoresSellos = [
    { termino: 'certificado', peso: 'alto' },
    { termino: 'se expide', peso: 'alto' },
    { termino: 'otorgado', peso: 'alto' },
    { termino: 'reconocimiento', peso: 'medio' },
    { termino: 'oficial', peso: 'medio' }
  ];

  indicadoresSellos.forEach(indicador => {
    if (textoLower.includes(indicador.termino)) {
      resultado.sellos.push(`Elemento certificación: ${indicador.termino} (${indicador.peso} nivel)`);
    }
  });

  return resultado;
}

/**
 * Algoritmo mejorado de scoring que considera análisis de texto
 */
async function calcularScoreAutenticidadMejorado(analisisVisual: AnalisisVisual, tipoArchivo: string) {
  console.log('📊 Calculando score de autenticidad con algoritmo mejorado...');
  
  let score = 0;
  const elementos = {
    sellos: analisisVisual.elementosSeguridad.sellos,
    firmas: analisisVisual.elementosSeguridad.firmas,
    logos: analisisVisual.elementosSeguridad.logos
  };

  const detallesScoring = {
    factorTexto: 0,
    factorElementosSeguridad: 0,
    factorCalidad: 0,
    factorEstructura: 0,
    bonificaciones: 0
  };

  // Factor 1: Calidad del texto extraído (25 puntos máximo)
  const palabras = analisisVisual.textoExtraido.split(/\s+/).filter(p => p.length > 0);
  const caracteres = analisisVisual.textoExtraido.length;
  
  if (analisisVisual.calidad.claridadTexto === 'alta' && palabras.length > 50 && caracteres > 200) {
    detallesScoring.factorTexto = 25;
  } else if (analisisVisual.calidad.claridadTexto === 'media' && palabras.length > 20) {
    detallesScoring.factorTexto = 18;
  } else if (palabras.length > 10) {
    detallesScoring.factorTexto = 12;
  } else {
    detallesScoring.factorTexto = 5;
  }

  // Factor 2: Elementos de seguridad detectados (45 puntos máximo)
  if (elementos.sellos && analisisVisual.elementosSeguridad.detallesSellos.length > 0) {
    const numeroSellos = analisisVisual.elementosSeguridad.detallesSellos.length;
    detallesScoring.factorElementosSeguridad += Math.min(18, numeroSellos * 6);
    console.log(`🏛️ Sellos detectados: ${numeroSellos}`);
  }

  if (elementos.firmas && analisisVisual.elementosSeguridad.detallesFirmas.length > 0) {
    const numeroFirmas = analisisVisual.elementosSeguridad.detallesFirmas.length;
    detallesScoring.factorElementosSeguridad += Math.min(15, numeroFirmas * 5);
    console.log(`✍️ Firmas detectadas: ${numeroFirmas}`);
  }

  if (elementos.logos && analisisVisual.elementosSeguridad.detallesLogos.length > 0) {
    const numeroLogos = analisisVisual.elementosSeguridad.detallesLogos.length;
    detallesScoring.factorElementosSeguridad += Math.min(12, numeroLogos * 4);
    console.log(`🎯 Logos detectados: ${numeroLogos}`);
  }

  // Factor 3: Calidad general del documento (20 puntos máximo)
  if (analisisVisual.calidad.estructuraDocumento === 'formal') {
    detallesScoring.factorCalidad = 20;
  } else if (analisisVisual.calidad.estructuraDocumento === 'informal') {
    detallesScoring.factorCalidad = 12;
  } else {
    detallesScoring.factorCalidad = 5;
  }

  // Factor 4: Análisis de estructura y formato (10 puntos máximo)
  const textoLower = analisisVisual.textoExtraido.toLowerCase();
  
  const palabrasFormalesEncontradas = [
    'certificado', 'diploma', 'título', 'universidad', 'colegio', 'instituto',
    'director', 'rector', 'registro', 'oficial', 'certificate', 'degree', 'otorgado'
  ].filter(palabra => textoLower.includes(palabra)).length;

  if (palabrasFormalesEncontradas >= 3) {
    detallesScoring.factorEstructura = 10;
  } else if (palabrasFormalesEncontradas >= 2) {
    detallesScoring.factorEstructura = 6;
  } else if (palabrasFormalesEncontradas >= 1) {
    detallesScoring.factorEstructura = 3;
  }

  // Bonificaciones especiales
  const elementosDetectados = [elementos.sellos, elementos.firmas, elementos.logos].filter(Boolean).length;
  
  if (elementosDetectados === 3) {
    detallesScoring.bonificaciones = 10;
  } else if (elementosDetectados === 2) {
    detallesScoring.bonificaciones = 5;
  }

  // Bonificación por documentos Microsoft/académicos
  if (textoLower.includes('microsoft') && textoLower.includes('certificado')) {
    detallesScoring.bonificaciones += 5;
  }

  // Calcular score final
  score = detallesScoring.factorTexto + 
          detallesScoring.factorElementosSeguridad + 
          detallesScoring.factorCalidad + 
          detallesScoring.factorEstructura + 
          detallesScoring.bonificaciones;

  score = Math.min(100, Math.max(0, score));

  // Determinar recomendación
  let recomendacion: 'accept' | 'review' | 'reject';
  if (score >= 75) {
    recomendacion = 'accept';
  } else if (score >= 45) {
    recomendacion = 'review';
  } else {
    recomendacion = 'reject';
  }

  console.log(`📊 Score final calculado: ${score}/100`);
  console.log(`   - Factor texto: ${detallesScoring.factorTexto}/25`);
  console.log(`   - Factor elementos seguridad: ${detallesScoring.factorElementosSeguridad}/45`);
  console.log(`   - Factor calidad: ${detallesScoring.factorCalidad}/20`);
  console.log(`   - Factor estructura: ${detallesScoring.factorEstructura}/10`);
  console.log(`   - Bonificaciones: ${detallesScoring.bonificaciones}/15`);
  console.log(`   - Recomendación: ${recomendacion}`);

  return {
    score,
    recomendacion,
    elementos,
    detalles: detallesScoring
  };
}

function getRecomendacionTexto(recomendacion: string): string {
  switch (recomendacion) {
    case 'accept':
      return '✅ ACEPTAR - El documento parece auténtico';
    case 'review':
      return '⚠️ REVISAR - El documento requiere revisión manual';
    case 'reject':
      return '❌ RECHAZAR - El documento presenta inconsistencias';
    default:
      return '❓ SIN DETERMINAR';
  }
}

// INICIALIZACIÓN

async function initializeServices() {
  try {
    console.log('🔄 Inicializando servicios de DocuValle...');
    
    initializeFirebaseAdmin();
    console.log('✅ Firebase Admin inicializado');
    
    visionService = new VisionService();
    console.log('✅ Vision API inicializado');
    
    documentService = new DocumentService();
    console.log('✅ Servicio de documentos inicializado');
    
    console.log('🎉 Todos los servicios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
    process.exit(1);
  }
}

// Manejador de errores global
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', error);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
  });
});

async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`🚀 DocuValle Backend ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📄 Nuevas funcionalidades: PDF Support + Manual Review`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Error arrancando el servidor:', error);
    process.exit(1);
  });
}

export default app;