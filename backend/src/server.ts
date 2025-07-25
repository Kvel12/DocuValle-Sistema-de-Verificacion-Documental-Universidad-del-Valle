// Servidor principal de DocuValle Backend
import dotenv from 'dotenv';
// Cargar variables de entorno ANTES de importar otras cosas
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore';

// Importamos nuestras configuraciones de servicios de Google Cloud
import { initializeFirebaseAdmin, db, storage } from './config/firebase';
import { VisionService, AnalisisVisual } from './services/visionService';
import { DocumentService } from './services/documentService';

// Inicializamos la aplicación Express
const app = express();
const PORT = process.env.PORT || 3001;

// Configuración para JWT y bcrypt
const JWT_SECRET = process.env.JWT_SECRET || 'docuvalle-secret-key-change-in-production';
const BCRYPT_ROUNDS = 12;

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

// INTERFACES PARA ADMINISTRADORES
interface AdministradorData {
  id: string;
  nombreAdmin: string;
  email: string;
  rol: string;
  fechaCreacion: Date;
  fechaUltimoAcceso?: Date | null;
  estado: string;
  password?: string; // Solo para operaciones internas, nunca se devuelve
}

interface AdministradorResponse {
  id: string;
  nombreAdmin: string;
  email: string;
  rol: string;
  fechaCreacion: string;
  fechaUltimoAcceso?: string | null;
  estado: string;
  // password NO se incluye nunca en las respuestas
}

// FUNCIONES AUXILIARES PARA CONTRASEÑAS

/**
 * Genera una contraseña temporal segura
 */
function generarPasswordTemporal(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const simbolos = '!@#$%&*';
  let password = '';
  
  // Al menos 1 mayúscula, 1 minúscula, 1 número, 1 símbolo
  password += caracteres.charAt(Math.floor(Math.random() * 26)); // Mayúscula
  password += caracteres.charAt(26 + Math.floor(Math.random() * 26)); // Minúscula
  password += caracteres.charAt(52 + Math.floor(Math.random() * 8)); // Número
  password += simbolos.charAt(Math.floor(Math.random() * simbolos.length)); // Símbolo
  
  // Completar hasta 12 caracteres
  for (let i = 4; i < 12; i++) {
    const allChars = caracteres + simbolos;
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Mezclar los caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Hashea una contraseña usando bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifica una contraseña contra su hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Limpia los datos del administrador para respuesta (remueve password)
 */
function limpiarDatosAdmin(adminData: any): AdministradorResponse {
  const { password, ...adminLimpio } = adminData;
  return {
    ...adminLimpio,
    fechaCreacion: adminData.fechaCreacion instanceof Date ? 
      adminData.fechaCreacion.toISOString() : 
      adminData.fechaCreacion.toDate().toISOString(),
    fechaUltimoAcceso: adminData.fechaUltimoAcceso ? 
      (adminData.fechaUltimoAcceso instanceof Date ? 
        adminData.fechaUltimoAcceso.toISOString() : 
        adminData.fechaUltimoAcceso.toDate().toISOString()) : null
  };
}

// ENDPOINTS DE TESTING

app.get('/api/health', (req, res) => {
  const geminiEnabled = process.env.GEMINI_API_KEY ? true : false;
  
  res.json({
    status: 'ok',
    message: '🚀 DocuValle Backend está funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '3.1.0',
    features: ['PDF_SUPPORT', 'MANUAL_MARKING', 'GEMINI_INTEGRATION', 'REAL_ANALYSIS', 'USER_MANAGEMENT', 'ADMIN_MANAGEMENT', 'PASSWORD_AUTH'],
    geminiEnabled: geminiEnabled,
    services: {
      vision: 'active',
      gemini: geminiEnabled ? 'active' : 'disabled',
      firestore: 'active',
      storage: 'active',
      auth: 'active'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    gemini: process.env.GEMINI_API_KEY ? 'enabled' : 'disabled',
    auth: 'enabled'
  });
});

app.get('/api/test-vision', async (req, res) => {
  try {
    console.log('🔍 Iniciando test completo de servicios...');
    
    const resultadoVision = await visionService.testConnection();
    
    res.json({
      success: resultadoVision.success,
      message: resultadoVision.success ? '✅ Servicios conectados correctamente' : '❌ Error en servicios',
      vision: {
        status: resultadoVision.success ? 'connected' : 'error',
        message: resultadoVision.message,
        details: resultadoVision.details
      },
      gemini: {
        status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
        message: process.env.GEMINI_API_KEY ? 'Gemini API Key configurada' : 'Gemini API Key no configurada'
      },
      auth: {
        status: 'configured',
        message: 'Sistema de autenticación configurado'
      }
    });
    
  } catch (error) {
    console.error('Error con servicios:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error inesperado con servicios',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// NUEVOS ENDPOINTS DE AUTENTICACIÓN

/**
 * Login de administradores
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login de administrador...');

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios',
        error: 'MISSING_CREDENTIALS'
      });
    }

    const emailLimpio = email.trim().toLowerCase();

    // Buscar administrador por email
    const adminsRef = db.collection('administradores');
    const consultaAdmin = await adminsRef.where('email', '==', emailLimpio).get();

    if (consultaAdmin.empty) {
      console.log(`❌ Login fallido: Email no encontrado: ${emailLimpio}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        error: 'INVALID_CREDENTIALS'
      });
    }

    const adminDoc = consultaAdmin.docs[0];
    const adminData = adminDoc.data();

    // Verificar estado del administrador
    if (adminData.estado !== 'activo') {
      console.log(`❌ Login fallido: Administrador inactivo: ${emailLimpio}`);
      return res.status(403).json({
        success: false,
        message: 'Cuenta de administrador desactivada',
        error: 'ACCOUNT_DISABLED'
      });
    }

    // Verificar contraseña
    if (!adminData.passwordHash) {
      console.log(`❌ Login fallido: No hay contraseña configurada para: ${emailLimpio}`);
      return res.status(401).json({
        success: false,
        message: 'Contraseña no configurada. Contacte al super administrador.',
        error: 'PASSWORD_NOT_SET'
      });
    }

    const passwordValida = await verifyPassword(password, adminData.passwordHash);
    if (!passwordValida) {
      console.log(`❌ Login fallido: Contraseña incorrecta para: ${emailLimpio}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Actualizar último acceso
    await adminDoc.ref.update({
      fechaUltimoAcceso: new Date()
    });

    // Generar JWT
    const token = jwt.sign(
      {
        adminId: adminData.id,
        email: adminData.email,
        rol: adminData.rol,
        nombreAdmin: adminData.nombreAdmin
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log(`✅ Login exitoso: ${adminData.nombreAdmin} (${emailLimpio})`);

    res.json({
      success: true,
      message: '✅ Login exitoso',
      token,
      administrador: limpiarDatosAdmin({
        ...adminData,
        fechaCreacion: adminData.fechaCreacion.toDate(),
        fechaUltimoAcceso: new Date()
      })
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error interno en login',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Validar token JWT
 */
app.post('/api/auth/validate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token requerido',
        error: 'MISSING_TOKEN'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verificar que el administrador aún existe y está activo
    const adminDoc = await db.collection('administradores').doc(decoded.adminId).get();
    
    if (!adminDoc.exists) {
      return res.status(401).json({
        success: false,
        message: 'Administrador no encontrado',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    const adminData = adminDoc.data();
    if (adminData?.estado !== 'activo') {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada',
        error: 'ACCOUNT_DISABLED'
      });
    }

    res.json({
      success: true,
      message: 'Token válido',
      administrador: limpiarDatosAdmin({
        ...adminData,
        fechaCreacion: adminData.fechaCreacion.toDate(),
        fechaUltimoAcceso: adminData.fechaUltimoAcceso ? adminData.fechaUltimoAcceso.toDate() : null
      })
    });

  } catch (error) {
    console.error('❌ Error validando token:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: 'INVALID_TOKEN'
    });
  }
});

// ENDPOINTS DE GESTIÓN DE ADMINISTRADORES ACTUALIZADOS

/**
 * Crear o obtener un administrador (ACTUALIZADO CON CONTRASEÑA)
 */
app.post('/api/admins/create-or-get', async (req, res) => {
  try {
    console.log('👨‍💼 Creando o obteniendo administrador...');

    const { nombreAdmin, email, rol, password } = req.body;

    if (!nombreAdmin || nombreAdmin.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre del administrador es obligatorio',
        error: 'MISSING_ADMIN_NAME'
      });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El email del administrador es obligatorio',
        error: 'MISSING_ADMIN_EMAIL'
      });
    }

    const nombreAdminLimpio = nombreAdmin.trim();
    const emailLimpio = email.trim().toLowerCase();

    // Buscar si el administrador ya existe por email
    const adminsRef = db.collection('administradores');
    const consultaExistente = await adminsRef.where('email', '==', emailLimpio).get();

    if (!consultaExistente.empty) {
      // Administrador ya existe, devolverlo
      const adminExistente = consultaExistente.docs[0];
      const adminData = adminExistente.data();

      console.log(`✅ Administrador existente encontrado: ${nombreAdminLimpio}`);

      return res.json({
        success: true,
        message: '👨‍💼 Administrador existente encontrado',
        administrador: limpiarDatosAdmin({
          ...adminData,
          fechaCreacion: adminData.fechaCreacion.toDate(),
          fechaUltimoAcceso: adminData.fechaUltimoAcceso ? adminData.fechaUltimoAcceso.toDate() : null
        }),
        esNuevo: false
      });
    }

    // Crear nuevo administrador
    const nuevoAdminId = uuidv4();
    
    // Generar contraseña temporal si no se proporciona
    const passwordFinal = password || generarPasswordTemporal();
    const passwordHash = await hashPassword(passwordFinal);

    const nuevoAdmin = {
      id: nuevoAdminId,
      nombreAdmin: nombreAdminLimpio,
      email: emailLimpio,
      rol: rol || 'administrador',
      fechaCreacion: new Date(),
      fechaUltimoAcceso: null,
      estado: 'activo',
      passwordHash: passwordHash
    };

    await adminsRef.doc(nuevoAdminId).set(nuevoAdmin);

    console.log(`✅ Nuevo administrador creado: ${nombreAdminLimpio}`);
    console.log(`🔐 Contraseña temporal generada: ${passwordFinal}`);

    res.json({
      success: true,
      message: '✅ Administrador creado exitosamente',
      administrador: limpiarDatosAdmin({
        ...nuevoAdmin,
        fechaCreacion: nuevoAdmin.fechaCreacion,
        fechaUltimoAcceso: null
      }),
      esNuevo: true,
      passwordTemporal: password ? undefined : passwordFinal // Solo mostrar si fue generada automáticamente
    });

  } catch (error) {
    console.error('❌ Error creando administrador:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error creando administrador',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Listar todos los administradores (SIN CONTRASEÑAS)
 */
app.get('/api/admins/list', async (req, res) => {
  try {
    console.log('📋 Listando administradores...');

    const adminsRef = db.collection('administradores');
    const snapshot = await adminsRef.orderBy('nombreAdmin', 'asc').get();

    const administradores: AdministradorResponse[] = [];

    snapshot.forEach((doc) => {
      const adminData = doc.data();
      administradores.push(limpiarDatosAdmin({
        ...adminData,
        fechaCreacion: adminData.fechaCreacion.toDate(),
        fechaUltimoAcceso: adminData.fechaUltimoAcceso ? adminData.fechaUltimoAcceso.toDate() : null
      }));
    });

    console.log(`✅ Encontrados ${administradores.length} administradores`);

    res.json({
      success: true,
      message: `📋 Encontrados ${administradores.length} administradores`,
      administradores,
      total: administradores.length
    });

  } catch (error) {
    console.error('❌ Error listando administradores:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error listando administradores',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Actualizar estado de un administrador
 */
app.put('/api/admins/:adminId/update-status', async (req, res) => {
  try {
    console.log('🔄 Actualizando estado de administrador...');

    const { adminId } = req.params;
    const { estado } = req.body;

    if (!estado || !['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado debe ser "activo" o "inactivo"',
        error: 'INVALID_STATUS'
      });
    }

    const adminRef = db.collection('administradores').doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    await adminRef.update({
      estado: estado,
      fechaUltimaActualizacion: new Date()
    });

    console.log(`✅ Estado del administrador ${adminId} actualizado a: ${estado}`);

    res.json({
      success: true,
      message: `✅ Estado actualizado a: ${estado}`,
      adminId: adminId,
      nuevoEstado: estado
    });

  } catch (error) {
    console.error('❌ Error actualizando estado del administrador:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error actualizando estado del administrador',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * NUEVO: Cambiar contraseña de administrador
 */
app.put('/api/admins/:adminId/change-password', async (req, res) => {
  try {
    console.log('🔐 Cambiando contraseña de administrador...');

    const { adminId } = req.params;
    const { nuevaPassword, passwordActual } = req.body;

    if (!nuevaPassword || nuevaPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres',
        error: 'INVALID_PASSWORD'
      });
    }

    const adminRef = db.collection('administradores').doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    const adminData = adminDoc.data();

    // Si tiene contraseña actual, verificarla
    if (adminData.passwordHash && passwordActual) {
      const passwordValida = await verifyPassword(passwordActual, adminData.passwordHash);
      if (!passwordValida) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña actual incorrecta',
          error: 'INVALID_CURRENT_PASSWORD'
        });
      }
    }

    // Hashear nueva contraseña
    const nuevaPasswordHash = await hashPassword(nuevaPassword);

    await adminRef.update({
      passwordHash: nuevaPasswordHash,
      fechaUltimaActualizacion: new Date()
    });

    console.log(`✅ Contraseña actualizada para administrador ${adminId}`);

    res.json({
      success: true,
      message: '✅ Contraseña actualizada exitosamente',
      adminId: adminId
    });

  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error cambiando contraseña',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * NUEVO: Resetear contraseña de administrador (genera una nueva temporal)
 */
app.put('/api/admins/:adminId/reset-password', async (req, res) => {
  try {
    console.log('🔄 Reseteando contraseña de administrador...');

    const { adminId } = req.params;

    const adminRef = db.collection('administradores').doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    // Generar nueva contraseña temporal
    const nuevaPasswordTemporal = generarPasswordTemporal();
    const nuevaPasswordHash = await hashPassword(nuevaPasswordTemporal);

    await adminRef.update({
      passwordHash: nuevaPasswordHash,
      fechaUltimaActualizacion: new Date()
    });

    const adminData = adminDoc.data();
    console.log(`✅ Contraseña reseteada para administrador ${adminData.nombreAdmin}`);

    res.json({
      success: true,
      message: '✅ Contraseña reseteada exitosamente',
      adminId: adminId,
      passwordTemporal: nuevaPasswordTemporal
    });

  } catch (error) {
    console.error('❌ Error reseteando contraseña:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error reseteando contraseña',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Eliminar un administrador
 */
app.delete('/api/admins/:adminId', async (req, res) => {
  try {
    console.log('🗑️ Eliminando administrador...');

    const { adminId } = req.params;

    const adminRef = db.collection('administradores').doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    const adminData = adminDoc.data();
    await adminRef.delete();

    console.log(`✅ Administrador eliminado: ${adminData?.nombreAdmin}`);

    res.json({
      success: true,
      message: '✅ Administrador eliminado exitosamente',
      adminEliminado: {
        id: adminId,
        nombreAdmin: adminData?.nombreAdmin
      }
    });

  } catch (error) {
    console.error('❌ Error eliminando administrador:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error eliminando administrador',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * NUEVO: Migración para administradores existentes sin contraseña
 */
app.post('/api/admins/migrate-passwords', async (req, res) => {
  try {
    console.log('🔄 Migrando administradores sin contraseña...');

    const adminsRef = db.collection('administradores');
    const snapshot = await adminsRef.get();

    let adminsMigrados = 0;
    const passwordsGeneradas: { [key: string]: string } = {};

    for (const doc of snapshot.docs) {
      const adminData = doc.data();
      
      // Solo migrar si no tiene passwordHash
      if (!adminData.passwordHash) {
        const passwordTemporal = generarPasswordTemporal();
        const passwordHash = await hashPassword(passwordTemporal);

        await doc.ref.update({
          passwordHash: passwordHash,
          fechaUltimaActualizacion: new Date()
        });

        passwordsGeneradas[adminData.nombreAdmin] = passwordTemporal;
        adminsMigrados++;
        
        console.log(`✅ Migrado: ${adminData.nombreAdmin}`);
      }
    }

    console.log(`✅ Migración completada: ${adminsMigrados} administradores`);

    res.json({
      success: true,
      message: `✅ Migración completada: ${adminsMigrados} administradores`,
      adminsMigrados,
      passwordsGeneradas: Object.keys(passwordsGeneradas).length > 0 ? passwordsGeneradas : undefined
    });

  } catch (error) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error en migración',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// ENDPOINTS DE GESTIÓN DE USUARIOS (SIN CAMBIOS)

/**
 * Crear o obtener un usuario
 */
app.post('/api/users/create-or-get', async (req, res) => {
  try {
    console.log('👤 Creando o obteniendo usuario...');

    const { nombreUsuario } = req.body;

    if (!nombreUsuario || nombreUsuario.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre del usuario es obligatorio',
        error: 'MISSING_USER_NAME'
      });
    }

    const nombreUsuarioLimpio = nombreUsuario.trim();

    // Buscar si el usuario ya existe
    const usuariosRef = db.collection('usuarios');
    const consultaExistente = await usuariosRef.where('nombreUsuario', '==', nombreUsuarioLimpio).get();

    if (!consultaExistente.empty) {
      // Usuario ya existe, devolverlo
      const usuarioExistente = consultaExistente.docs[0];
      const userData = usuarioExistente.data();

      console.log(`✅ Usuario existente encontrado: ${nombreUsuarioLimpio}`);

      return res.json({
        success: true,
        message: '👤 Usuario existente encontrado',
        usuario: {
          id: usuarioExistente.id,
          nombreUsuario: userData.nombreUsuario,
          fechaCreacion: userData.fechaCreacion.toDate().toISOString(),
          documentosAsignados: userData.documentosAsignados || 0
        },
        esNuevo: false
      });
    }

    // Crear nuevo usuario
    const nuevoUsuarioId = uuidv4();
    const nuevoUsuario = {
      id: nuevoUsuarioId,
      nombreUsuario: nombreUsuarioLimpio,
      fechaCreacion: new Date(),
      documentosAsignados: 0,
      estado: 'activo'
    };

    await usuariosRef.doc(nuevoUsuarioId).set(nuevoUsuario);

    console.log(`✅ Nuevo usuario creado: ${nombreUsuarioLimpio}`);

    res.json({
      success: true,
      message: '✅ Usuario creado exitosamente',
      usuario: {
        id: nuevoUsuario.id,
        nombreUsuario: nuevoUsuario.nombreUsuario,
        fechaCreacion: nuevoUsuario.fechaCreacion.toISOString(),
        documentosAsignados: nuevoUsuario.documentosAsignados
      },
      esNuevo: true
    });

  } catch (error) {
    console.error('❌ Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error creando usuario',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Listar todos los usuarios
 */
app.get('/api/users/list', async (req, res) => {
  try {
    console.log('📋 Listando usuarios...');

    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.orderBy('nombreUsuario', 'asc').get();

    const usuarios: any[] = [];

    for (const doc of snapshot.docs) {
      const userData = doc.data();

      // Contar documentos asignados a este usuario
      const documentosSnapshot = await db.collection('documentos')
        .where('usuarioAsignado', '==', userData.nombreUsuario)
        .get();

      usuarios.push({
        id: doc.id,
        nombreUsuario: userData.nombreUsuario,
        fechaCreacion: userData.fechaCreacion.toDate().toISOString(),
        documentosAsignados: documentosSnapshot.size,
        estado: userData.estado || 'activo'
      });
    }

    console.log(`✅ Encontrados ${usuarios.length} usuarios`);

    res.json({
      success: true,
      message: `📋 Encontrados ${usuarios.length} usuarios`,
      usuarios,
      total: usuarios.length
    });

  } catch (error) {
    console.error('❌ Error listando usuarios:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error listando usuarios',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// ENDPOINTS PRINCIPALES (SIN CAMBIOS MAYORES)

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

/**
 * ENDPOINT PRINCIPAL: Análisis real con Vision + Gemini
 */
app.post('/api/documents/analyze', async (req, res) => {
  try {
    console.log('🔍 Iniciando análisis REAL de documento con IA mejorada...');

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

    // Validar y descargar el archivo de Cloud Storage
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

    // ANÁLISIS REAL SIN DATOS HARDCODEADOS
    console.log('🤖 Procesando con Vision API + Gemini...');
    console.log(`   - Tipo de archivo: ${tipoArchivo}`);
    console.log(`   - Tamaño del buffer: ${fileBuffer.length} bytes`);
    console.log(`   - Gemini habilitado: ${process.env.GEMINI_API_KEY ? 'Sí' : 'No'}`);

    // Usar el VisionService corregido que integra Gemini automáticamente
    const analisisCompleto: AnalisisVisual = await visionService.analizarDocumentoCompleto(fileBuffer, tipoArchivo);

    console.log('📊 Calculando score de autenticidad con algoritmo híbrido...');
    const analisisAutenticidad = await calcularScoreAutenticidadHibrido(analisisCompleto, tipoArchivo);

    console.log('💾 Guardando resultados con información de Gemini...');
    const userId = req.body.userId || 'usuario-temporal';

    // Preparar datos de Gemini para DocumentService
    const datosGemini = analisisCompleto.analisisGemini ? {
      habilitado: true,
      tipoDocumento: analisisCompleto.analisisGemini.documentType || 'unknown',
      scoreAutenticidad: analisisCompleto.analisisGemini.authenticityScore || 0,
      elementosDetectados: [
        ...(analisisCompleto.analisisGemini.hasSignatures ? [`${analisisCompleto.analisisGemini.signatureCount} firmas`] : []),
        ...(analisisCompleto.analisisGemini.hasSeals ? [`${analisisCompleto.analisisGemini.sealCount} sellos`] : []),
        ...(analisisCompleto.analisisGemini.hasWatermarks ? ['marcas de agua'] : [])
      ],
      consistenciaFormato: analisisCompleto.analisisGemini.formatConsistency || 0,
      elementosSospechosos: analisisCompleto.analisisGemini.suspiciousElements || []
    } : {
      habilitado: false,
      tipoDocumento: 'no_determinado',
      scoreAutenticidad: 0,
      elementosDetectados: [],
      consistenciaFormato: 0,
      elementosSospechosos: []
    };

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
      analisisGemini: datosGemini,
      metadatos: {
        numeroCaracteres: analisisCompleto.textoExtraido.length,
        numeroPalabras: analisisCompleto.textoExtraido.split(/\s+/).length,
        numeroLineas: analisisCompleto.textoExtraido.split('\n').length,
        calidad: analisisCompleto.calidad.claridadTexto,
        objetosDetectados: analisisCompleto.objetosDetectados.length,
        logosProcesados: analisisCompleto.elementosSeguridad.detallesLogos,
        sellosProcesados: analisisCompleto.elementosSeguridad.detallesSellos,
        firmasProcesadas: analisisCompleto.elementosSeguridad.detallesFirmas,
        geminiAnalisisCompletado: analisisCompleto.analisisGemini ? true : false,
        versionGemini: analisisCompleto.analisisGemini ? 'gemini-1.5-flash' : null
      }
    }, analisisCompleto.analisisGemini);

    console.log(`✅ Documento analizado exitosamente: ${documentoId}`);
    console.log(`   - Score final: ${analisisAutenticidad.score}/100`);
    console.log(`   - Recomendación: ${analisisAutenticidad.recomendacion}`);
    console.log(`   - Gemini usado: ${analisisCompleto.analisisGemini ? 'Sí' : 'No'}`);

    // Respuesta mejorada con información de Gemini
    res.json({
      success: true,
      message: '🎉 Documento analizado exitosamente con IA híbrida',
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
        
        // NUEVO: Información del análisis híbrido
        analisisHibrido: {
          visionAPI: {
            usado: true,
            objetosDetectados: analisisCompleto.objetosDetectados.length,
            logosProcesados: analisisCompleto.elementosSeguridad.detallesLogos.length
          },
          geminiAPI: {
            usado: analisisCompleto.analisisGemini ? true : false,
            scoreAutenticidad: analisisCompleto.analisisGemini?.authenticityScore || 0,
            tipoDocumento: analisisCompleto.analisisGemini?.documentType || 'no_determinado',
            elementosSospechosos: analisisCompleto.analisisGemini?.suspiciousElements?.length || 0
          }
        },

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
      } else if (error.message.includes('Gemini')) {
        mensajeError = 'Error en análisis avanzado. Continuando con análisis básico.';
        errorCode = 'GEMINI_ERROR';
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

// RESTO DE ENDPOINTS (SIN CAMBIOS)

// ENDPOINT: Marcado manual de documentos
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
      estadoRevision: 'revisado_manualmente',
      fechaUltimaActualizacion: new Date()
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

/**
 * ENDPOINT: Asignar documento a usuario
 */
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

    // Verificar si el usuario existe, si no, crearlo automáticamente
    const usuariosRef = db.collection('usuarios');
    const consultaUsuario = await usuariosRef.where('nombreUsuario', '==', nombreUsuario.trim()).get();

    if (consultaUsuario.empty) {
      // Crear usuario automáticamente
      const nuevoUsuarioId = uuidv4();
      const nuevoUsuario = {
        id: nuevoUsuarioId,
        nombreUsuario: nombreUsuario.trim(),
        fechaCreacion: new Date(),
        documentosAsignados: 0,
        estado: 'activo'
      };

      await usuariosRef.doc(nuevoUsuarioId).set(nuevoUsuario);
      console.log(`✅ Usuario creado automáticamente: ${nombreUsuario}`);
    }

    // Asignar documento
    await docRef.update({
      usuarioAsignado: nombreUsuario.trim(),
      tipoDocumento: tipoDocumento || 'no_especificado',
      fechaAsignacion: new Date(),
      estado: 'asignado',
      fechaUltimaActualizacion: new Date()
    });

    // Actualizar contador de documentos del usuario
    const usuarioActualizado = await usuariosRef.where('nombreUsuario', '==', nombreUsuario.trim()).get();
    if (!usuarioActualizado.empty) {
      const usuarioDoc = usuarioActualizado.docs[0];
      await usuarioDoc.ref.update({
        documentosAsignados: FieldValue.increment(1)
      });
    }

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

/**
 * ENDPOINT: Búsqueda de documentos
 */
app.post('/api/documents/search', async (req, res) => {
  try {
    console.log('🔍 Buscando documentos...');

    const { nombreUsuario, fechaDesde, fechaHasta, limite } = req.body;

    // Hacer que nombreUsuario sea opcional
    let consulta = db.collection('documentos');

    // Solo filtrar por usuario si se proporciona
    if (nombreUsuario && nombreUsuario.trim() !== '') {
      consulta = consulta.where('usuarioAsignado', '==', nombreUsuario.trim());
      console.log(`   - Filtrando por usuario: ${nombreUsuario}`);
    }

    if (fechaDesde) {
      consulta = consulta.where('fechaProcesamiento', '>=', new Date(fechaDesde));
      console.log(`   - Fecha desde: ${fechaDesde}`);
    }
    if (fechaHasta) {
      consulta = consulta.where('fechaProcesamiento', '<=', new Date(fechaHasta));
      console.log(`   - Fecha hasta: ${fechaHasta}`);
    }

    consulta = consulta
      .orderBy('fechaProcesamiento', 'desc')
      .limit(limite || 50);

    const snapshot = await consulta.get();
    const documentos: any[] = [];

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      documentos.push({
        id: data.id,
        nombreArchivo: data.nombreArchivo,
        tipoDocumento: data.tipoDocumento || data.tipoDocumentoDetectado || 'no_especificado',
        usuarioAsignado: data.usuarioAsignado || 'Sin asignar',
        scoreAutenticidad: data.scoreAutenticidad || 0,
        recomendacion: data.recomendacion || 'review',
        recomendacionManual: data.recomendacionManual || null,
        estadoRevision: data.estadoRevision || 'pendiente',
        estado: data.estado || 'completado',
        fechaProcesamiento: data.fechaProcesamiento ? data.fechaProcesamiento.toDate().toISOString() : new Date().toISOString(),
        fechaAsignacion: data.fechaAsignacion ? data.fechaAsignacion.toDate().toISOString() : null,
        analisisGemini: data.analisisGemini || null
      });
    });

    console.log(`✅ Encontrados ${documentos.length} documentos`);

    res.json({
      success: true,
      message: `📋 Encontrados ${documentos.length} documentos`,
      documentos,
      total: documentos.length,
      filtros: {
        nombreUsuario: nombreUsuario || 'todos',
        fechaDesde,
        fechaHasta,
        limite: limite || 50
      }
    });
  } catch (error) {
    console.error('❌ Error buscando documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error buscando documentos',
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
      usuarioAsignado: data.usuarioAsignado || 'Sin asignar',
      tipoDocumento: data.tipoDocumento || data.tipoDocumentoDetectado || 'no_especificado',
      textoExtraido: textoCompleto,
      scoreAutenticidad: data.scoreAutenticidad,
      recomendacion: data.recomendacion,
      recomendacionTexto: getRecomendacionTexto(data.recomendacion),
      elementosSeguridad: data.elementosSeguridad,
      metadatos: data.metadatos,
      fechaProcesamiento: data.fechaProcesamiento.toDate().toISOString(),
      fechaAsignacion: data.fechaAsignacion ? data.fechaAsignacion.toDate().toISOString() : null,
      
      // Campos de revisión manual
      recomendacionManual: data.recomendacionManual,
      comentarioRevisor: data.comentarioRevisor,
      revisorId: data.revisorId,
      fechaRevisionManual: data.fechaRevisionManual ? data.fechaRevisionManual.toDate().toISOString() : null,
      estadoRevision: data.estadoRevision,
      
      // Análisis Gemini
      analisisGemini: data.analisisGemini || null,
      
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

/**
 * ENDPOINT: Obtener documentos de un usuario con filtros avanzados
 */
app.post('/api/documents/user-documents', async (req, res) => {
  try {
    const { userId, filtros } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId es obligatorio',
        error: 'MISSING_USER_ID'
      });
    }

    console.log(`🔍 Obteniendo documentos para usuario: ${userId}`);

    // Si no se envían filtros, usar undefined para obtener todos los documentos del usuario
    let filtrosProcesados = filtros;
    if (!filtros || Object.keys(filtros).length === 0) {
      filtrosProcesados = undefined;
    } else {
      // Convertir fechas de string a Date si vienen como string ISO
      if (filtros.fechaDesde && typeof filtros.fechaDesde === 'string') {
        filtrosProcesados.fechaDesde = new Date(filtros.fechaDesde);
      }
      if (filtros.fechaHasta && typeof filtros.fechaHasta === 'string') {
        filtrosProcesados.fechaHasta = new Date(filtros.fechaHasta);
      }
    }

    const documentos = await documentService.getUserDocuments(userId, filtrosProcesados);

    console.log(`✅ Encontrados ${documentos.length} documentos para usuario ${userId}`);

    res.json({
      success: true,
      message: `📋 Encontrados ${documentos.length} documentos`,
      userId,
      filtros: filtrosProcesados,
      documentos,
      total: documentos.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo documentos del usuario:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error obteniendo documentos del usuario',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// ENDPOINTS DEL DASHBOARD

/**
 * ENDPOINT: Estadísticas del dashboard
 */
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del dashboard...');
    
    const stats = await documentService.obtenerEstadisticasDashboard();
    
    console.log('✅ Estadísticas del dashboard obtenidas');
    
    res.json({ 
      success: true, 
      message: '📊 Estadísticas obtenidas exitosamente',
      stats 
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas del dashboard',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * ENDPOINT: Últimos 5 documentos procesados para el dashboard
 */
app.get('/api/dashboard/ultimos', async (req, res) => {
  try {
    console.log('📋 Obteniendo últimos documentos para dashboard...');
    
    const snapshot = await db
      .collection('documentos')
      .orderBy('fechaProcesamiento', 'desc')
      .limit(5)
      .get();

    const documentos = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id,
        nombre: data.nombreArchivo,
        fecha: data.fechaProcesamiento.toDate().toISOString().split('T')[0],
        estado:
          data.recomendacion === 'accept' ? 'aceptado' :
          data.recomendacion === 'review' ? 'en_revision' :
          data.recomendacion === 'reject' ? 'rechazado' : 'en_revision',
        usuarioAsignado: data.usuarioAsignado || 'Sin asignar',
        scoreAutenticidad: data.scoreAutenticidad || 0
      };
    });

    console.log(`✅ Obtenidos ${documentos.length} últimos documentos`);

    res.json({ 
      success: true, 
      message: `📋 Últimos ${documentos.length} documentos obtenidos`,
      documentos 
    });
  } catch (error) {
    console.error('❌ Error obteniendo últimos documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo últimos documentos',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// FUNCIONES AUXILIARES

/**
 * Algoritmo híbrido que combina Vision API + Gemini de manera inteligente
 */
async function calcularScoreAutenticidadHibrido(analisisVisual: AnalisisVisual, tipoArchivo: string) {
  console.log('📊 Calculando score híbrido (Vision + Gemini)...');
  
  let score = 0;
  const elementos = {
    sellos: analisisVisual.elementosSeguridad.sellos,
    firmas: analisisVisual.elementosSeguridad.firmas,
    logos: analisisVisual.elementosSeguridad.logos
  };

  const detallesScoring = {
    factorTextoVision: 0,
    factorElementosVision: 0,
    factorCalidadVision: 0,
    factorGemini: 0,
    bonificacionesHibridas: 0,
    geminiDisponible: analisisVisual.analisisGemini ? true : false
  };

  // PARTE 1: Análisis de Vision API (60% del peso si no hay Gemini, 40% si hay Gemini)
  const pesoVision = analisisVisual.analisisGemini ? 0.4 : 0.7;
  
  // Factor texto Vision API
  const palabras = analisisVisual.textoExtraido.split(/\s+/).filter(p => p.length > 0);
  const caracteres = analisisVisual.textoExtraido.length;
  
  if (analisisVisual.calidad.claridadTexto === 'alta' && palabras.length > 50 && caracteres > 200) {
    detallesScoring.factorTextoVision = 30;
  } else if (analisisVisual.calidad.claridadTexto === 'media' && palabras.length > 20) {
    detallesScoring.factorTextoVision = 20;
  } else if (palabras.length > 10) {
    detallesScoring.factorTextoVision = 12;
  } else {
    detallesScoring.factorTextoVision = 5;
  }

  // Factor elementos Vision API
  if (elementos.sellos && analisisVisual.elementosSeguridad.detallesSellos.length > 0) {
    detallesScoring.factorElementosVision += Math.min(15, analisisVisual.elementosSeguridad.detallesSellos.length * 5);
  }
  if (elementos.firmas && analisisVisual.elementosSeguridad.detallesFirmas.length > 0) {
    detallesScoring.factorElementosVision += Math.min(12, analisisVisual.elementosSeguridad.detallesFirmas.length * 4);
  }
  if (elementos.logos && analisisVisual.elementosSeguridad.detallesLogos.length > 0) {
    detallesScoring.factorElementosVision += Math.min(10, analisisVisual.elementosSeguridad.detallesLogos.length * 3);
  }

  // Factor calidad Vision API
  if (analisisVisual.calidad.estructuraDocumento === 'formal') {
    detallesScoring.factorCalidadVision = 15;
  } else if (analisisVisual.calidad.estructuraDocumento === 'informal') {
    detallesScoring.factorCalidadVision = 8;
  } else {
    detallesScoring.factorCalidadVision = 3;
  }

  // PARTE 2: Análisis de Gemini (40% del peso si está disponible)
  if (analisisVisual.analisisGemini) {
    const gemini = analisisVisual.analisisGemini;
    
    // Score directo de Gemini (convertido a nuestra escala)
    let scoreGeminiBase = gemini.authenticityScore || 0;
    
    // Ajustes basados en elementos específicos detectados por Gemini
    let ajusteElementos = 0;
    if (gemini.hasSignatures && gemini.signatureCount > 0) {
      ajusteElementos += gemini.signatureCount * 8;
    }
    if (gemini.hasSeals && gemini.sealCount > 0) {
      ajusteElementos += gemini.sealCount * 10;
    }
    if (gemini.hasWatermarks) {
      ajusteElementos += 12;
    }
    
    // Penalización por elementos sospechosos
    const penalizacionSospechosos = (gemini.suspiciousElements?.length || 0) * 5;
    
    // Factor de consistencia de formato
    const factorConsistencia = (gemini.formatConsistency || 0) * 0.2;
    
    detallesScoring.factorGemini = Math.min(60, Math.max(0, 
      scoreGeminiBase * 0.4 + ajusteElementos + factorConsistencia - penalizacionSospechosos
    ));
    
    console.log(`🧠 Análisis Gemini:`);
    console.log(`   - Score base: ${scoreGeminiBase}`);
    console.log(`   - Ajuste elementos: +${ajusteElementos}`);
    console.log(`   - Penalización sospechosos: -${penalizacionSospechosos}`);
    console.log(`   - Factor final Gemini: ${detallesScoring.factorGemini}`);
  }

  // PARTE 3: Bonificaciones híbridas (cuando ambos sistemas coinciden)
  if (analisisVisual.analisisGemini) {
    const gemini = analisisVisual.analisisGemini;
    
    // Bonificación por concordancia en detección de elementos
    if (elementos.firmas && gemini.hasSignatures) {
      detallesScoring.bonificacionesHibridas += 5;
    }
    if (elementos.sellos && gemini.hasSeals) {
      detallesScoring.bonificacionesHibridas += 5;
    }
    
    // Bonificación por tipo de documento coherente
    const textoLower = analisisVisual.textoExtraido.toLowerCase();
    if (gemini.documentType === 'certificate' && textoLower.includes('certificado')) {
      detallesScoring.bonificacionesHibridas += 8;
    }
    if (gemini.documentType === 'diploma' && textoLower.includes('diploma')) {
      detallesScoring.bonificacionesHibridas += 8;
    }
  }

  // CÁLCULO FINAL
  const scoreVision = (detallesScoring.factorTextoVision + detallesScoring.factorElementosVision + detallesScoring.factorCalidadVision) * pesoVision;
  const scoreGeminiPonderado = detallesScoring.factorGemini * (analisisVisual.analisisGemini ? 0.6 : 0);
  
  score = scoreVision + scoreGeminiPonderado + detallesScoring.bonificacionesHibridas;
  score = Math.min(100, Math.max(0, score));

  // Determinar recomendación con lógica híbrida
  let recomendacion: 'accept' | 'review' | 'reject';
  
  if (analisisVisual.analisisGemini) {
    // Con Gemini: criterios más estrictos
    if (score >= 80 && analisisVisual.analisisGemini.suspiciousElements.length === 0) {
      recomendacion = 'accept';
    } else if (score >= 60) {
      recomendacion = 'review';
    } else {
      recomendacion = 'reject';
    }
  } else {
    // Sin Gemini: criterios tradicionales
    if (score >= 75) {
      recomendacion = 'accept';
    } else if (score >= 45) {
      recomendacion = 'review';
    } else {
      recomendacion = 'reject';
    }
  }

  console.log(`📊 Score híbrido calculado: ${score}/100`);
  console.log(`   - Vision API (${Math.round(pesoVision*100)}%): ${Math.round(scoreVision)}`);
  console.log(`   - Gemini API (${analisisVisual.analisisGemini ? '60' : '0'}%): ${Math.round(scoreGeminiPonderado)}`);
  console.log(`   - Bonificaciones híbridas: ${detallesScoring.bonificacionesHibridas}`);
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

/**
 * ENDPOINT TEMPORAL: Crear administrador de prueba
 * Solo para desarrollo - remover en producción
 */
app.post('/api/admin/create-test-admin', async (req, res) => {
  try {
    console.log('🧪 Creando administrador de prueba...');

    const testAdminEmail = 'admin@example.com';
    const testAdminPassword = '1234';

    // Verificar si ya existe
    const adminsRef = db.collection('administradores');
    const existingAdmin = await adminsRef.where('email', '==', testAdminEmail).get();

    if (!existingAdmin.empty) {
      console.log('✅ Administrador de prueba ya existe');
      return res.json({
        success: true,
        message: '✅ Administrador de prueba ya existe',
        admin: {
          email: testAdminEmail,
          password: testAdminPassword
        }
      });
    }

    // Crear administrador de prueba
    const testAdminId = uuidv4();
    const passwordHash = await hashPassword(testAdminPassword);

    const testAdmin = {
      id: testAdminId,
      nombreAdmin: 'Administrador de Prueba',
      email: testAdminEmail,
      rol: 'super_admin',
      fechaCreacion: new Date(),
      fechaUltimoAcceso: null,
      estado: 'activo',
      passwordHash: passwordHash
    };

    await adminsRef.doc(testAdminId).set(testAdmin);

    console.log('✅ Administrador de prueba creado exitosamente');

    res.json({
      success: true,
      message: '✅ Administrador de prueba creado exitosamente',
      admin: {
        id: testAdminId,
        email: testAdminEmail,
        password: testAdminPassword,
        rol: 'super_admin'
      }
    });

  } catch (error) {
    console.error('❌ Error creando administrador de prueba:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error creando administrador de prueba',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// INICIALIZACIÓN

async function initializeServices() {
  try {
    console.log('🔄 Inicializando servicios de DocuValle v3.1...');
    
    initializeFirebaseAdmin();
    console.log('✅ Firebase Admin inicializado');
    
    visionService = new VisionService();
    console.log('✅ Vision API inicializado (con soporte Gemini)');
    
    documentService = new DocumentService();
    console.log('✅ Servicio de documentos inicializado');
    
    // Verificar configuración de Gemini
    if (process.env.GEMINI_API_KEY) {
      console.log('✅ Gemini API Key configurada correctamente');
    } else {
      console.log('⚠️ Gemini API Key no configurada - funcionando solo con Vision API');
    }

    // Verificar configuración de JWT
    if (process.env.JWT_SECRET) {
      console.log('✅ JWT Secret configurado correctamente');
    } else {
      console.log('⚠️ JWT Secret usando valor por defecto - configura JWT_SECRET en producción');
    }
    
    console.log('🎉 Todos los servicios inicializados correctamente');
    console.log('🔐 Sistema de autenticación con contraseñas habilitado');
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
    console.log(`🚀 DocuValle Backend v3.1 ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Funcionalidades: PDF Support + Manual Review + Gemini Integration + User Management + Admin Management + Password Auth`);
    console.log(`🧠 Gemini: ${process.env.GEMINI_API_KEY ? 'HABILITADO' : 'DESHABILITADO'}`);
    console.log(`🔐 Autenticación: HABILITADA`);
    console.log(`📋 Endpoints de autenticación:`);
    console.log(`   - POST /api/auth/login - Login de administradores`);
    console.log(`   - POST /api/auth/validate - Validar token JWT`);
    console.log(`   - POST /api/admins/migrate-passwords - Migrar contraseñas existentes`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Error arrancando el servidor:', error);
    process.exit(1);
  });
}

export default app;