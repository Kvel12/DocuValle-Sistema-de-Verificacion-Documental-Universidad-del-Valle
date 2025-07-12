// Servidor principal de DocuValle Backend
// Este archivo orquesta todos los servicios y APIs que DocuValle necesita

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Importamos nuestras configuraciones de servicios de Google Cloud
import { initializeFirebaseAdmin, db, storage } from './config/firebase';
import { VisionService } from './services/visionService';
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
    version: '1.0.0'
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

// ENDPOINTS NUEVOS

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

    const bucket = storage.bucket('apt-cubist-368817.firebasestorage.app');
    const fileName = archivoUrl.split('/').pop();
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'El archivo no se encontró en Cloud Storage',
        error: 'FILE_NOT_FOUND'
      });
    }

    console.log('📥 Descargando archivo de Cloud Storage...');
    const [fileBuffer] = await file.download();

    console.log('🤖 Procesando con Vision API...');
    const textoExtraido = await visionService.detectTextFromBuffer(fileBuffer, tipoArchivo);

    console.log('📊 Calculando score de autenticidad...');
    const analisisAutenticidad = await calcularScoreAutenticidad(textoExtraido, tipoArchivo);

    console.log('💾 Guardando resultados...');
    const userId = req.body.userId || 'usuario-temporal';

    await documentService.saveProcessingResult({
      id: documentoId,
      userId: userId,
      nombreArchivo: nombreArchivo,
      tipoArchivo: tipoArchivo,
      tamanoArchivo: tamanoArchivo,
      archivoUrl: archivoUrl,
      textoExtraido: textoExtraido,
      fechaProcesamiento: new Date(),
      estado: 'completado',
      scoreAutenticidad: analisisAutenticidad.score,
      recomendacion: analisisAutenticidad.recomendacion,
      elementosSeguridad: analisisAutenticidad.elementos
    });

    console.log(`✅ Documento analizado exitosamente: ${documentoId}`);

    res.json({
      success: true,
      message: '🎉 Documento analizado exitosamente',
      resultado: {
        id: documentoId,
        textoExtraido: textoExtraido.substring(0, 1000) + (textoExtraido.length > 1000 ? '...' : ''),
        numeroCaracteres: textoExtraido.length,
        scoreAutenticidad: analisisAutenticidad.score,
        recomendacion: analisisAutenticidad.recomendacion,
        recomendacionTexto: getRecomendacionTexto(analisisAutenticidad.recomendacion),
        elementosSeguridad: analisisAutenticidad.elementos,
        archivoUrl: archivoUrl,
        fechaAnalisis: new Date().toISOString()
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
    const textoExtraido = await visionService.detectTextFromBuffer(archivo.buffer, archivo.mimetype);
    
    const resultado = await documentService.saveProcessingResult({
      id: procesamientoId,
      userId,
      nombreArchivo: archivo.originalname,
      tipoArchivo: archivo.mimetype,
      tamanoArchivo: archivo.size,
      archivoUrl,
      textoExtraido,
      fechaProcesamiento: new Date(),
      estado: 'completado'
    });

    res.json({
      success: true,
      message: '🎉 Documento procesado exitosamente',
      resultado: {
        id: procesamientoId,
        textoExtraido: textoExtraido.substring(0, 500) + (textoExtraido.length > 500 ? '...' : ''),
        numeroCaracteres: textoExtraido.length,
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

// FUNCIONES AUXILIARES

async function calcularScoreAutenticidad(textoExtraido: string, tipoArchivo: string) {
  console.log('📊 Calculando score de autenticidad...');
  
  let score = 0;
  const elementos = {
    sellos: false,
    firmas: false,
    logos: false
  };

  // Factor 1: Calidad del texto extraído (30 puntos máximo)
  const palabras = textoExtraido.split(/\s+/).filter(p => p.length > 0);
  if (palabras.length > 50 && textoExtraido.length > 200) {
    score += 30;
  } else if (palabras.length > 20) {
    score += 20;
  } else {
    score += 10;
  }

  // Factor 2: Detección de elementos de seguridad (40 puntos máximo)
  const textoLower = textoExtraido.toLowerCase();
  
  if (textoLower.includes('sello') || textoLower.includes('oficial') || textoLower.includes('registro')) {
    elementos.sellos = true;
    score += 15;
  }

  if (textoLower.includes('firma') || textoLower.includes('director') || textoLower.includes('rector')) {
    elementos.firmas = true;
    score += 15;
  }

  if (textoLower.includes('universidad') || textoLower.includes('colegio') || textoLower.includes('instituto')) {
    elementos.logos = true;
    score += 10;
  }

  // Factor 3: Consistencia de formato (30 puntos máximo)
  if (textoLower.includes('certificado') || textoLower.includes('diploma') || textoLower.includes('título')) {
    score += 15;
  }
  if (textoExtraido.match(/\d{4}/)) {
    score += 10;
  }
  if (textoExtraido.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
    score += 5;
  }

  let recomendacion: 'accept' | 'review' | 'reject';
  if (score >= 80) {
    recomendacion = 'accept';
  } else if (score >= 50) {
    recomendacion = 'review';
  } else {
    recomendacion = 'reject';
  }

  console.log(`📊 Score calculado: ${score}/100 - Recomendación: ${recomendacion}`);

  return {
    score,
    recomendacion,
    elementos
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