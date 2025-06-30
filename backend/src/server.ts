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
const PORT = process.env.PORT || 8080; // Cloud Run siempre usa el puerto 8080

// Configuramos CORS para permitir comunicación entre Firebase Hosting y Cloud Run
// Es como abrir la puerta entre el frontend y backend
app.use(cors({
  origin: [
    'https://apt-cubist-368817.web.app',    // URL de Firebase Hosting en producción
    'https://apt-cubist-368817.firebaseapp.com', // URL alternativa de Firebase
    'http://localhost:3000',                 // Para desarrollo local del frontend
    'http://localhost:3001'                  // Puerto alternativo para desarrollo
  ],
  credentials: true
}));

// Middlewares para procesar peticiones
app.use(express.json({ limit: '50mb' })); // Permitimos archivos grandes (hasta 50MB)
app.use(express.urlencoded({ extended: true }));

// Configuramos Multer para manejar subida de archivos
// Es como tener un asistente especializado en recibir documentos
const upload = multer({
  storage: multer.memoryStorage(), // Guardamos en memoria temporalmente
  limits: {
    fileSize: 50 * 1024 * 1024, // Máximo 50MB por archivo
  },
  fileFilter: (req, file, cb) => {
    // Solo aceptamos ciertos tipos de archivos para seguridad
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

// Ruta de prueba para verificar que el servidor funciona
// Es como un "ping" para asegurar que todo está vivo
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 DocuValle Backend está funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Ruta para probar la conexión con Firebase
app.get('/api/test-firebase', async (req, res) => {
  try {
    // Intentamos escribir un documento de prueba en Firestore
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

// Ruta para probar Vision API - VERSIÓN COMPLETAMENTE CORREGIDA
app.get('/api/test-vision', async (req, res) => {
  try {
    console.log('🔍 Iniciando test de Vision API...');
    
    // Usamos el nuevo método de test que no requiere imágenes reales
    const resultado = await visionService.testConnection();
    
    if (resultado.success) {
      res.json({
        success: true,
        message: '✅ Vision API conectado correctamente',
        resultado: resultado.message,
        detalles: resultado.details
      });
    } else {
      // Si el test básico falla, enviamos un error 500
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

// Ruta adicional para test completo con imagen sintética (opcional)
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

// Ruta principal para procesar documentos (la funcionalidad core de DocuValle)
app.post('/api/procesar-documento', upload.single('archivo'), async (req, res) => {
  try {
    // Verificamos que se haya enviado un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha enviado ningún archivo para procesar'
      });
    }

    const archivo = req.file;
    const userId = req.body.userId || 'usuario-anonimo'; // En producción esto vendrá del token de autenticación
    
    console.log(`📄 Procesando documento: ${archivo.originalname} (${archivo.size} bytes)`);

    // Generamos un ID único para este procesamiento
    const procesamientoId = uuidv4();
    
    // Paso 1: Guardamos el archivo original en Cloud Storage
    const archivoUrl = await documentService.uploadFile(archivo, procesamientoId);
    
    // Paso 2: Extraemos texto usando Vision API
    const textoExtraido = await visionService.detectTextFromBuffer(archivo.buffer, archivo.mimetype);
    
    // Paso 3: Guardamos los resultados en Firestore
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
        textoExtraido: textoExtraido.substring(0, 500) + (textoExtraido.length > 500 ? '...' : ''), // Limitamos la respuesta
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

// Ruta para obtener el historial de documentos procesados
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

// Función para inicializar todos los servicios antes de arrancar el servidor
async function initializeServices() {
  try {
    console.log('🔄 Inicializando servicios de DocuValle...');
    
    // Inicializamos Firebase Admin
    initializeFirebaseAdmin();
    console.log('✅ Firebase Admin inicializado');
    
    // Inicializamos Vision API
    visionService = new VisionService();
    console.log('✅ Vision API inicializado');
    
    // Inicializamos el servicio de documentos
    documentService = new DocumentService();
    console.log('✅ Servicio de documentos inicializado');
    
    console.log('🎉 Todos los servicios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
    process.exit(1); // Si algo falla, detenemos el servidor
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

// Endpoint de health simple para Cloud Run 
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
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