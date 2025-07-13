// Servidor principal de DocuValle Backend
// Este archivo orquesta todos los servicios y APIs que DocuValle necesita

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Importamos nuestras configuraciones de servicios de Google Cloud
import { initializeFirebaseAdmin, db, storage } from './config/firebase';
import { VisionService, AnalisisVisual } from './services/visionService';
import { DocumentService } from './services/documentService';

// Inicializamos la aplicación Express - nuestro servidor web
const app = express();
const PORT = process.env.PORT || 8080;

// Configuramos CORS para permitir comunicación entre Firebase Hosting y Cloud Run
app.use(cors({
  origin: [
    'https://apt-cubist-368817.web.app',
    'https://apt-cubist-368817.firebaseapp.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));

// Middlewares para procesar peticiones
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuramos Multer para manejar subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Máximo 50MB por archivo
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

// Inicializamos los servicios que DocuValle usará
let visionService: VisionService;
let documentService: DocumentService;

// ENDPOINTS DE TESTING Y HEALTH CHECK

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 DocuValle Backend está funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0' // Versión actualizada
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api/test-firebase', async (req, res) => {
  try {
    const testDoc = {
      mensaje: 'Conexión exitosa con Firebase',
      timestamp: new Date(),
      servicio: 'Firestore'
    };
    
    const docRef = await db.collection('pruebas').add(testDoc);
    
    res.json({
      success: true,
      message: '✅ Firebase conectado correctamente',
      documentoId: docRef.id
    });
  } catch (error) {
    console.error('Error conectando con Firebase:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error conectando con Firebase',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
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

app.get('/api/test-vision-complete', async (req, res) => {
  try {
    console.log('🧪 Iniciando test completo de Vision API...');
    
    const resultado = await visionService.testWithSyntheticImage();
    
    res.json({
      success: resultado.success,
      message: resultado.message,
      resultado: resultado.resultado,
      nota: 'Test realizado con imagen sintética para verificar pipeline completo'
    });
    
  } catch (error) {
    console.error('Error en test completo de Vision API:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error en test completo de Vision API',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.get('/api/test-storage', async (req, res) => {
  try {
    console.log('🧪 Probando conexión con Cloud Storage...');
    
    const resultado = await documentService.testStorageConnection();
    
    if (resultado.success) {
      res.json({
        success: true,
        message: '✅ Cloud Storage conectado correctamente',
        detalles: resultado.details
      });
    } else {
      res.status(500).json({
        success: false,
        message: '❌ Error conectando con Cloud Storage',
        error: resultado.message
      });
    }
    
  } catch (error) {
    console.error('Error probando Cloud Storage:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error inesperado con Cloud Storage',
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
      } else if (error.message.includes('timeout')) {
        mensajeError = 'El archivo está tardando mucho en subirse. Intente con un archivo más pequeño.';
        errorCode = 'UPLOAD_TIMEOUT';
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
    
    // Extraer la ruta completa del archivo dentro del bucket
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
        error: 'FILE_NOT_FOUND',
        details: {
          bucketName,
          filePath,
          originalUrl: archivoUrl
        }
      });
    }

    console.log('📥 Descargando archivo de Cloud Storage...');
    const [fileBuffer] = await file.download();

    console.log('🤖 Procesando con Vision API mejorado...');
    // CAMBIO PRINCIPAL: Usar el análisis completo en lugar de solo texto
    const analisisCompleto: AnalisisVisual = await visionService.analizarDocumentoCompleto(fileBuffer, tipoArchivo);

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
        // Nuevos metadatos del análisis visual
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
        // Datos adicionales del análisis mejorado
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

    if (!nombreUsuario) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del usuario es obligatorio',
        error: 'MISSING_USER_NAME'
      });
    }

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
        fechaProcesamiento: data.fechaProcesamiento.toDate().toISOString(),
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

// ENDPOINT LEGACY PARA COMPATIBILIDAD
app.post('/api/procesar-documento', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha enviado ningún archivo para procesar'
      });
    }

    const archivo = req.file;
    const userId = req.body.userId || 'usuario-anonimo';
    
    console.log(`📄 Procesando documento: ${archivo.originalname} (${archivo.size} bytes)`);

    const procesamientoId = uuidv4();
    const archivoUrl = await documentService.uploadFile(archivo, procesamientoId);
    
    // Usar el nuevo método de análisis completo
    const analisisCompleto = await visionService.analizarDocumentoCompleto(archivo.buffer, archivo.mimetype);
    
    const resultado = await documentService.saveProcessingResult({
      id: procesamientoId,
      userId,
      nombreArchivo: archivo.originalname,
      tipoArchivo: archivo.mimetype,
      tamanoArchivo: archivo.size,
      archivoUrl,
      textoExtraido: analisisCompleto.textoExtraido,
      fechaProcesamiento: new Date(),
      estado: 'completado'
    });

    res.json({
      success: true,
      message: '🎉 Documento procesado exitosamente',
      resultado: {
        id: procesamientoId,
        textoExtraido: analisisCompleto.textoExtraido.substring(0, 500) + (analisisCompleto.textoExtraido.length > 500 ? '...' : ''),
        numeroCaracteres: analisisCompleto.textoExtraido.length,
        archivoUrl
      }
    });

  } catch (error) {
    console.error('Error procesando documento:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error procesando el documento',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.get('/api/documentos/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const documentos = await documentService.getUserDocuments(userId);
    
    res.json({
      success: true,
      documentos,
      total: documentos.length
    });
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error obteniendo documentos',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// FUNCIÓN MEJORADA DE SCORING DE AUTENTICIDAD

/**
 * Algoritmo mejorado de scoring de autenticidad basado en análisis visual
 * Ahora utiliza elementos realmente detectados por Vision API
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

  // Factor 2: Elementos de seguridad REALMENTE detectados (45 puntos máximo)
  if (elementos.sellos && analisisVisual.elementosSeguridad.detallesSellos.length > 0) {
    // Puntuación basada en la calidad de la detección de sellos
    const confianzaSellos = extraerConfianzaPromedio(analisisVisual.elementosSeguridad.detallesSellos);
    detallesScoring.factorElementosSeguridad += Math.round(18 * confianzaSellos);
    console.log(`🏛️ Sellos detectados con confianza promedio: ${Math.round(confianzaSellos * 100)}%`);
  }

  if (elementos.firmas && analisisVisual.elementosSeguridad.detallesFirmas.length > 0) {
    const confianzaFirmas = extraerConfianzaPromedio(analisisVisual.elementosSeguridad.detallesFirmas);
    detallesScoring.factorElementosSeguridad += Math.round(15 * confianzaFirmas);
    console.log(`✍️ Firmas detectadas con confianza promedio: ${Math.round(confianzaFirmas * 100)}%`);
  }

  if (elementos.logos && analisisVisual.elementosSeguridad.detallesLogos.length > 0) {
    const confianzaLogos = extraerConfianzaPromedio(analisisVisual.elementosSeguridad.detallesLogos);
    detallesScoring.factorElementosSeguridad += Math.round(12 * confianzaLogos);
    console.log(`🎯 Logos detectados con confianza promedio: ${Math.round(confianzaLogos * 100)}%`);
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
  
  // Verificar palabras clave de documentos formales
  const palabrasFormalesEncontradas = [
    'certificado', 'diploma', 'título', 'universidad', 'colegio', 'instituto',
    'director', 'rector', 'registro', 'oficial', 'certificate', 'degree'
  ].filter(palabra => textoLower.includes(palabra)).length;

  if (palabrasFormalesEncontradas >= 3) {
    detallesScoring.factorEstructura = 10;
  } else if (palabrasFormalesEncontradas >= 2) {
    detallesScoring.factorEstructura = 6;
  } else if (palabrasFormalesEncontradas >= 1) {
    detallesScoring.factorEstructura = 3;
  }

  // Bonificaciones por múltiples elementos de seguridad (bonus hasta 10 puntos)
  const elementosDetectados = [elementos.sellos, elementos.firmas, elementos.logos].filter(Boolean).length;
  
  if (elementosDetectados === 3) {
    detallesScoring.bonificaciones = 10; // Documento muy completo
  } else if (elementosDetectados === 2) {
    detallesScoring.bonificaciones = 5;
  }

  // Bonificación por alta calidad general
  if (analisisVisual.calidad.claridadTexto === 'alta' && 
      analisisVisual.calidad.estructuraDocumento === 'formal') {
    detallesScoring.bonificaciones += 5;
  }

  // Calcular score final
  score = detallesScoring.factorTexto + 
          detallesScoring.factorElementosSeguridad + 
          detallesScoring.factorCalidad + 
          detallesScoring.factorEstructura + 
          detallesScoring.bonificaciones;

  // Asegurar que el score esté entre 0 y 100
  score = Math.min(100, Math.max(0, score));

  // Determinar recomendación con umbrales ajustados
  let recomendacion: 'accept' | 'review' | 'reject';
  if (score >= 85) {
    recomendacion = 'accept';
  } else if (score >= 60) {
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

/**
 * Extrae el promedio de confianza de un array de strings con formato "Elemento (XX%)"
 */
function extraerConfianzaPromedio(detalles: string[]): number {
  if (detalles.length === 0) return 0;
  
  const confianzas = detalles.map(detalle => {
    const match = detalle.match(/\((\d+)%\)/);
    return match ? parseInt(match[1]) / 100 : 0.5; // Default 50% si no se puede extraer
  });
  
  return confianzas.reduce((a, b) => a + b, 0) / confianzas.length;
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

// INICIALIZACIÓN Y CONFIGURACIÓN

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

// Función principal para arrancar el servidor
async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`🚀 DocuValle Backend ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📄 Documentación API disponible en: http://localhost:${PORT}/api/`);
    console.log(`🔍 Versión con detección de elementos de seguridad mejorada activada`);
  });
}

// Arrancamos el servidor solo si este archivo se ejecuta directamente
if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Error arrancando el servidor:', error);
    process.exit(1);
  });
}

export default app;