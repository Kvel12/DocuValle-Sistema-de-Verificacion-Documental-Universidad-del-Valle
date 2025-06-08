// Servicio especializado en manejo de documentos y almacenamiento
// Este servicio coordina entre Cloud Storage (archivos) y Firestore (metadatos)

import { db, storage } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

// Definimos la estructura de datos que DocuValle maneja
export interface DocumentoProcessado {
  id: string;
  userId: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoArchivo: number;
  archivoUrl: string;
  textoExtraido: string;
  fechaProcesamiento: Date;
  estado: 'procesando' | 'completado' | 'error';
  metadatos?: {
    numeroCaracteres: number;
    numeroPalabras: number;
    numeroLineas: number;
    calidad: 'alta' | 'media' | 'baja';
  };
}

export class DocumentService {
  private bucket: any;

  constructor() {
    // Obtenemos referencia al bucket de Cloud Storage
    // Es como tener acceso a un almacén donde guardaremos todos los archivos
    this.bucket = storage.bucket();
    console.log('📁 Document Service inicializado correctamente');
  }

  /**
   * Sube un archivo a Cloud Storage
   * Es como guardar un documento en un archivero digital súper seguro y accesible
   * 
   * @param file - Archivo recibido del frontend (viene de multer)
   * @param procesamientoId - ID único para organizar los archivos
   * @returns Promise<string> - URL pública del archivo subido
   */
  async uploadFile(file: Express.Multer.File, procesamientoId: string): Promise<string> {
    try {
      // Creamos un nombre único y organizado para el archivo
      // Es como crear un sistema de carpetas bien organizadas
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const extension = this.obtenerExtension(file.originalname);
      const nombreArchivoStorage = `documentos/${timestamp}/${procesamientoId}_${file.originalname}`;

      console.log(`📤 Subiendo archivo: ${nombreArchivoStorage}`);

      // Creamos referencia al archivo en Cloud Storage
      const archivoStorage = this.bucket.file(nombreArchivoStorage);

      // Configuramos las opciones de subida
      const stream = archivoStorage.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            // Metadatos personalizados para DocuValle
            originalName: file.originalname,
            uploadDate: new Date().toISOString(),
            procesamientoId: procesamientoId,
            uploadedBy: 'docuvalle-backend'
          }
        },
        // Hacemos el archivo públicamente legible (necesario para que Vision API pueda accederlo)
        public: true,
        // Validamos la integridad del archivo
        validation: 'md5'
      });

      // Subimos el archivo como una promesa
      // Es como enviar un paquete por correo y esperar confirmación de entrega
      return new Promise((resolve, reject) => {
        stream.on('error', (error: Error) => {
          console.error(`❌ Error subiendo archivo: ${error.message}`);
          reject(new Error(`Error subiendo archivo: ${error.message}`));
        });

        stream.on('finish', async () => {
          try {
            // Una vez subido, obtenemos la URL pública
            const urlPublica = `https://storage.googleapis.com/${this.bucket.name}/${nombreArchivoStorage}`;
            
            console.log(`✅ Archivo subido exitosamente: ${urlPublica}`);
            resolve(urlPublica);
          } catch (error) {
            reject(error);
          }
        });

        // Escribimos los datos del archivo al stream
        stream.end(file.buffer);
      });

    } catch (error) {
      console.error('❌ Error en uploadFile:', error);
      throw new Error(`Error subiendo archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Guarda los resultados del procesamiento en Firestore
   * Es como crear un expediente completo del documento en nuestra base de datos
   * 
   * @param documento - Datos completos del procesamiento
   * @returns Promise<string> - ID del documento guardado en Firestore
   */
  async saveProcessingResult(documento: DocumentoProcessado): Promise<string> {
    try {
      console.log(`💾 Guardando resultado del procesamiento: ${documento.id}`);

      // Calculamos metadatos adicionales del texto extraído
      const metadatos = this.calcularMetadatos(documento.textoExtraido);

      // Preparamos el documento para Firestore
      // Separamos los datos grandes (texto) de los metadatos para optimizar las consultas
      const documentoFirestore = {
        id: documento.id,
        userId: documento.userId,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoArchivo: documento.tamanoArchivo,
        archivoUrl: documento.archivoUrl,
        fechaProcesamiento: documento.fechaProcesamiento,
        estado: documento.estado,
        metadatos: {
          ...metadatos,
          ...documento.metadatos
        },
        // Solo guardamos una vista previa del texto en el documento principal
        textoPreview: documento.textoExtraido.substring(0, 500),
        textoCompleto: documento.textoExtraido.length > 500 // Indicador si hay más texto
      };

      // Guardamos en la colección principal de documentos
      await db.collection('documentos').doc(documento.id).set(documentoFirestore);

      // Si el texto es largo, lo guardamos por separado para optimizar las consultas
      if (documento.textoExtraido.length > 500) {
        await db.collection('textos-completos').doc(documento.id).set({
          documentoId: documento.id,
          textoCompleto: documento.textoExtraido,
          fechaGuardado: new Date()
        });
      }

      console.log(`✅ Documento guardado exitosamente en Firestore: ${documento.id}`);
      return documento.id;

    } catch (error) {
      console.error('❌ Error guardando en Firestore:', error);
      throw new Error(`Error guardando resultado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene todos los documentos de un usuario específico
   * Es como buscar en el archivero todos los documentos de una persona
   * 
   * @param userId - ID del usuario
   * @returns Promise<DocumentoProcessado[]> - Lista de documentos del usuario
   */
  async getUserDocuments(userId: string): Promise<DocumentoProcessado[]> {
    try {
      console.log(`🔍 Buscando documentos del usuario: ${userId}`);

      // Consultamos Firestore ordenando por fecha más reciente primero
      const snapshot = await db
        .collection('documentos')
        .where('userId', '==', userId)
        .orderBy('fechaProcesamiento', 'desc')
        .limit(50) // Limitamos a 50 documentos más recientes
        .get();

      const documentos: DocumentoProcessado[] = [];

      // Convertimos cada documento de Firestore a nuestro formato
      snapshot.forEach(doc => {
        const data = doc.data();
        documentos.push({
          id: data.id,
          userId: data.userId,
          nombreArchivo: data.nombreArchivo,
          tipoArchivo: data.tipoArchivo,
          tamanoArchivo: data.tamanoArchivo,
          archivoUrl: data.archivoUrl,
          textoExtraido: data.textoPreview || '', // Solo la vista previa por defecto
          fechaProcesamiento: data.fechaProcesamiento.toDate(),
          estado: data.estado,
          metadatos: data.metadatos
        });
      });

      console.log(`✅ Encontrados ${documentos.length} documentos para el usuario ${userId}`);
      return documentos;

    } catch (error) {
      console.error('❌ Error obteniendo documentos del usuario:', error);
      throw new Error(`Error obteniendo documentos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene el texto completo de un documento específico
   * Útil cuando el usuario quiere ver todo el texto extraído
   * 
   * @param documentoId - ID del documento
   * @returns Promise<string> - Texto completo extraído
   */
  async getTextoCompleto(documentoId: string): Promise<string> {
    try {
      // Primero intentamos obtener el texto de la colección principal
      const docPrincipal = await db.collection('documentos').doc(documentoId).get();
      
      if (!docPrincipal.exists) {
        throw new Error('Documento no encontrado');
      }

      const data = docPrincipal.data();
      
      // Si el texto completo está en el documento principal, lo devolvemos
      if (!data?.textoCompleto) {
        return data?.textoPreview || '';
      }

      // Si es un documento largo, obtenemos el texto de la colección separada
      const docTextoCompleto = await db.collection('textos-completos').doc(documentoId).get();
      
      if (docTextoCompleto.exists) {
        return docTextoCompleto.data()?.textoCompleto || data?.textoPreview || '';
      }

      return data?.textoPreview || '';

    } catch (error) {
      console.error('❌ Error obteniendo texto completo:', error);
      throw new Error(`Error obteniendo texto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Calcula metadatos útiles del texto extraído
   * Es como hacer un análisis estadístico del documento procesado
   * 
   * @param texto - Texto del cual calcular metadatos
   * @returns objeto con métricas del texto
   */
  private calcularMetadatos(texto: string) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    // Calculamos métricas útiles para el usuario
    const metadatos = {
      numeroCaracteres: texto.length,
      numeroPalabras: palabras.length,
      numeroLineas: lineas.length,
      promedioCaracteresPorPalabra: palabras.length > 0 ? Math.round((texto.length / palabras.length) * 100) / 100 : 0,
      promedioPalabrasPorLinea: lineas.length > 0 ? Math.round((palabras.length / lineas.length) * 100) / 100 : 0,
      calidad: this.determinarCalidadTexto(palabras.length, texto.length) as 'alta' | 'media' | 'baja'
    };

    return metadatos;
  }

  /**
   * Determina la calidad del texto extraído basado en métricas
   */
  private determinarCalidadTexto(palabras: number, caracteres: number): string {
    if (palabras > 100 && caracteres > 500) {
      return 'alta';
    } else if (palabras > 20 && caracteres > 100) {
      return 'media';
    } else {
      return 'baja';
    }
  }

  /**
   * Obtiene la extensión de un archivo de forma segura
   */
  private obtenerExtension(nombreArchivo: string): string {
    const ultimoPunto = nombreArchivo.lastIndexOf('.');
    return ultimoPunto > 0 ? nombreArchivo.substring(ultimoPunto + 1).toLowerCase() : '';
  }

  /**
   * Elimina un documento y su archivo asociado
   * Útil para limpiar documentos que ya no se necesitan
   * 
   * @param documentoId - ID del documento a eliminar
   * @param userId - ID del usuario (para verificar permisos)
   */
  async eliminarDocumento(documentoId: string, userId: string): Promise<void> {
    try {
      // Verificamos que el documento pertenezca al usuario
      const doc = await db.collection('documentos').doc(documentoId).get();
      
      if (!doc.exists) {
        throw new Error('Documento no encontrado');
      }

      const data = doc.data();
      if (data?.userId !== userId) {
        throw new Error('No tienes permisos para eliminar este documento');
      }

      // Eliminamos el archivo de Cloud Storage
      const archivoUrl = data?.archivoUrl;
      if (archivoUrl) {
        // Extraemos el nombre del archivo de la URL
        const nombreArchivo = archivoUrl.split('/').pop();
        if (nombreArchivo) {
          const archivo = this.bucket.file(`documentos/${nombreArchivo}`);
          await archivo.delete();
        }
      }

      // Eliminamos los registros de Firestore
      await db.collection('documentos').doc(documentoId).delete();
      await db.collection('textos-completos').doc(documentoId).delete();

      console.log(`🗑️ Documento eliminado exitosamente: ${documentoId}`);

    } catch (error) {
      console.error('❌ Error eliminando documento:', error);
      throw new Error(`Error eliminando documento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
}