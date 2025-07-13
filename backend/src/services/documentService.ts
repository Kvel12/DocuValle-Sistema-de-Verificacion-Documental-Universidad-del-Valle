// Servicio especializado en manejo de documentos y almacenamiento
// Versión corregida completa con soporte para marcado manual y corrección de errores

import { db, storage } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore'; // CORRECCIÓN: Import correcto
import { v4 as uuidv4 } from 'uuid';

// Interfaz expandida para documentos procesados
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
  
  // Campos para el análisis de autenticidad
  scoreAutenticidad?: number;
  recomendacion?: 'accept' | 'review' | 'reject';
  elementosSeguridad?: {
    sellos: boolean;
    firmas: boolean;
    logos: boolean;
  };
  
  // NUEVO: Campos para revisión manual
  recomendacionManual?: 'accept' | 'review' | 'reject';
  comentarioRevisor?: string;
  revisorId?: string;
  fechaRevisionManual?: Date;
  estadoRevision?: 'pendiente' | 'revisado_manualmente' | 'sin_revision';
  
  // Metadatos expandidos
  metadatos?: {
    numeroCaracteres: number;
    numeroPalabras: number;
    numeroLineas: number;
    calidad: 'alta' | 'media' | 'baja';
    objetosDetectados?: number;
    logosProcesados?: string[];
    sellosProcesados?: string[];
    firmasProcesadas?: string[];
    resolucionImagen?: 'alta' | 'media' | 'baja';
    estructuraDocumento?: 'formal' | 'informal' | 'dudosa';
    confianzaPromedio?: number;
  };
}

export class DocumentService {
  private bucket: any;
  private bucketName: string = 'apt-cubist-368817.firebasestorage.app';

  constructor() {
    try {
      this.bucket = storage.bucket(this.bucketName);
      console.log(`📁 Document Service inicializado con bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('❌ Error inicializando DocumentService:', error);
      throw new Error('Error inicializando el servicio de documentos');
    }
  }

  /**
   * Sube un archivo a Cloud Storage con soporte mejorado para PDFs
   */
  async uploadFile(file: Express.Multer.File, procesamientoId: string): Promise<string> {
    try {
      console.log(`📤 [DocumentService] Iniciando upload de: ${file.originalname}`);
      
      if (!file || !file.buffer) {
        throw new Error('Archivo no válido o vacío');
      }

      if (!procesamientoId) {
        throw new Error('ID de procesamiento requerido');
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const extension = this.obtenerExtension(file.originalname);
      const nombreSanitizado = this.sanitizarNombreArchivo(file.originalname);
      
      const carpetaTipo = this.determinarCarpetaPorTipo(file.mimetype);
      const nombreArchivoStorage = `documentos/${carpetaTipo}/${timestamp}/${procesamientoId}_${nombreSanitizado}`;

      console.log(`📂 Nombre en storage: ${nombreArchivoStorage}`);

      const [bucketExists] = await this.bucket.exists();
      if (!bucketExists) {
        throw new Error(`Bucket ${this.bucketName} no existe. Verifica la configuración de Firebase.`);
      }

      // Validación especial para PDFs
      if (file.mimetype === 'application/pdf') {
        await this.validarPDF(file.buffer);
      }

      const archivoStorage = this.bucket.file(nombreArchivoStorage);

      const stream = archivoStorage.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          cacheControl: 'public, max-age=31536000',
          metadata: {
            originalName: file.originalname,
            uploadDate: new Date().toISOString(),
            procesamientoId: procesamientoId,
            uploadedBy: 'docuvalle-backend',
            fileSize: file.size.toString(),
            fileExtension: extension,
            documentType: this.determinarTipoDocumento(file.originalname),
            version: '2.1'
          }
        },
        public: true,
        validation: 'md5',
        resumable: file.size > 5 * 1024 * 1024
      });

      return new Promise((resolve, reject) => {
        const timeoutMs = Math.max(60000, file.size / 1024);
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout subiendo archivo (${timeoutMs/1000}s)`));
        }, timeoutMs);

        stream.on('error', (error: Error) => {
          clearTimeout(timeout);
          console.error(`❌ Error en stream de upload: ${error.message}`);
          reject(new Error(`Error subiendo archivo: ${error.message}`));
        });

        stream.on('finish', async () => {
          clearTimeout(timeout);
          try {
            const [exists] = await archivoStorage.exists();
            if (!exists) {
              throw new Error('El archivo no se guardó correctamente en Cloud Storage');
            }

            const urlPublica = `https://storage.googleapis.com/${this.bucketName}/${nombreArchivoStorage}`;
            console.log(`✅ Archivo subido exitosamente: ${urlPublica}`);
            resolve(urlPublica);
          } catch (error) {
            console.error(`❌ Error verificando archivo subido: ${error}`);
            reject(error);
          }
        });

        stream.end(file.buffer);
      });

    } catch (error) {
      console.error('❌ Error en uploadFile:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('bucket')) {
          throw new Error('Error de configuración de Cloud Storage. Verifica que el bucket existe y tienes permisos.');
        } else if (error.message.includes('permission')) {
          throw new Error('Error de permisos en Cloud Storage. Verifica la configuración de IAM.');
        } else if (error.message.includes('PDF corrupto')) {
          throw new Error('El archivo PDF está corrupto o no es válido.');
        } else {
          throw new Error(`Error subiendo archivo: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido subiendo archivo');
    }
  }

  /**
   * Guarda los resultados del procesamiento con soporte para revisión manual
   */
  async saveProcessingResult(documento: DocumentoProcessado): Promise<string> {
    try {
      console.log(`💾 [DocumentService] Guardando resultado: ${documento.id}`);

      if (!documento.id || !documento.userId) {
        throw new Error('ID de documento y userId son obligatorios');
      }

      const metadatos = this.calcularMetadatosAvanzados(documento.textoExtraido, documento.metadatos);

      const documentoFirestore = {
        id: documento.id,
        userId: documento.userId,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoArchivo: documento.tamanoArchivo,
        archivoUrl: documento.archivoUrl,
        fechaProcesamiento: documento.fechaProcesamiento,
        estado: documento.estado,
        
        // Campos de análisis de autenticidad
        scoreAutenticidad: documento.scoreAutenticidad || 0,
        recomendacion: documento.recomendacion || 'review',
        elementosSeguridad: documento.elementosSeguridad || {
          sellos: false,
          firmas: false,
          logos: false
        },
        
        // NUEVO: Campos de revisión manual (iniciales)
        recomendacionManual: null,
        comentarioRevisor: '',
        revisorId: null,
        fechaRevisionManual: null,
        estadoRevision: 'pendiente',
        
        metadatos: metadatos,
        
        textoPreview: documento.textoExtraido.substring(0, 500),
        textoCompleto: documento.textoExtraido.length > 500,
        
        tipoDocumentoDetectado: this.detectarTipoDocumentoPorTexto(documento.textoExtraido),
        palabrasClave: this.extraerPalabrasClave(documento.textoExtraido),
        
        versionAnalisis: '2.1',
        fechaUltimaActualizacion: new Date()
      };

      await db.collection('documentos').doc(documento.id).set(documentoFirestore);

      if (documento.textoExtraido.length > 500) {
        await db.collection('textos-completos').doc(documento.id).set({
          documentoId: documento.id,
          textoCompleto: documento.textoExtraido,
          fechaGuardado: new Date(),
          checksum: this.calcularChecksum(documento.textoExtraido)
        });
      }

      // CORRECCIÓN: Actualizar estadísticas con manejo de errores
      try {
        await this.actualizarEstadisticas(documento);
      } catch (statsError) {
        console.warn('⚠️ No se pudieron actualizar estadísticas globales:', statsError);
        // No es crítico, continuamos
      }

      console.log(`✅ Documento guardado exitosamente en Firestore: ${documento.id}`);
      return documento.id;

    } catch (error) {
      console.error('❌ Error guardando en Firestore:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('Error de permisos en Firestore. Verifica la configuración de IAM.');
        } else if (error.message.includes('quota')) {
          throw new Error('Se ha excedido la cuota de Firestore.');
        } else {
          throw new Error(`Error guardando resultado: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido guardando en Firestore');
    }
  }

  /**
   * NUEVA FUNCIÓN: Actualizar estado manual de un documento
   */
  async actualizarRevisionManual(documentoId: string, datos: {
    recomendacionManual: 'accept' | 'review' | 'reject';
    comentarioRevisor?: string;
    revisorId?: string;
  }): Promise<void> {
    try {
      const docRef = db.collection('documentos').doc(documentoId);
      
      await docRef.update({
        recomendacionManual: datos.recomendacionManual,
        comentarioRevisor: datos.comentarioRevisor || '',
        revisorId: datos.revisorId || 'revisor-manual',
        fechaRevisionManual: new Date(),
        estadoRevision: 'revisado_manualmente'
      });
      
      console.log(`✅ Revisión manual actualizada para documento: ${documentoId}`);
    } catch (error) {
      console.error('❌ Error actualizando revisión manual:', error);
      throw new Error(`Error actualizando revisión manual: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene documentos de usuario con soporte para filtros de revisión
   */
  async getUserDocuments(userId: string, filtros?: {
    limite?: number;
    tipoDocumento?: string;
    recomendacion?: string;
    estadoRevision?: string;
    fechaDesde?: Date;
    fechaHasta?: Date;
  }): Promise<DocumentoProcessado[]> {
    try {
      console.log(`🔍 [DocumentService] Buscando documentos del usuario: ${userId}`);

      if (!userId) {
        throw new Error('userId es obligatorio');
      }

      let consulta = db
        .collection('documentos')
        .where('userId', '==', userId);

      if (filtros?.tipoDocumento) {
        consulta = consulta.where('tipoDocumentoDetectado', '==', filtros.tipoDocumento);
      }

      if (filtros?.recomendacion) {
        consulta = consulta.where('recomendacion', '==', filtros.recomendacion);
      }

      if (filtros?.estadoRevision) {
        consulta = consulta.where('estadoRevision', '==', filtros.estadoRevision);
      }

      if (filtros?.fechaDesde) {
        consulta = consulta.where('fechaProcesamiento', '>=', filtros.fechaDesde);
      }

      if (filtros?.fechaHasta) {
        consulta = consulta.where('fechaProcesamiento', '<=', filtros.fechaHasta);
      }

      consulta = consulta
        .orderBy('fechaProcesamiento', 'desc')
        .limit(filtros?.limite || 50);

      const snapshot = await consulta.get();
      const documentos: DocumentoProcessado[] = [];

      snapshot.forEach((doc: any) => {
        const data = doc.data();
        documentos.push({
          id: data.id,
          userId: data.userId,
          nombreArchivo: data.nombreArchivo,
          tipoArchivo: data.tipoArchivo,
          tamanoArchivo: data.tamanoArchivo,
          archivoUrl: data.archivoUrl,
          textoExtraido: data.textoPreview || '',
          fechaProcesamiento: data.fechaProcesamiento.toDate(),
          estado: data.estado,
          scoreAutenticidad: data.scoreAutenticidad,
          recomendacion: data.recomendacion,
          elementosSeguridad: data.elementosSeguridad,
          // NUEVO: Campos de revisión manual
          recomendacionManual: data.recomendacionManual,
          comentarioRevisor: data.comentarioRevisor,
          revisorId: data.revisorId,
          fechaRevisionManual: data.fechaRevisionManual ? data.fechaRevisionManual.toDate() : undefined,
          estadoRevision: data.estadoRevision,
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
   * Obtiene estadísticas con información de revisión manual
   */
  async obtenerEstadisticasDashboard(userId?: string): Promise<{
    totalDocumentos: number;
    documentosHoy: number;
    scorePromedio: number;
    distribucionRecomendaciones: { [key: string]: number };
    distribucionRevisionManual: { [key: string]: number };
    tiposDocumentosMasComunes: { [key: string]: number };
    tendenciaUltimos30Dias: Array<{ fecha: string; cantidad: number }>;
  }> {
    try {
      console.log('📊 Calculando estadísticas del dashboard...');

      let consultaBase = db.collection('documentos');
      
      if (userId) {
        consultaBase = consultaBase.where('userId', '==', userId);
      }

      const snapshotTotal = await consultaBase.get();
      const totalDocumentos = snapshotTotal.size;

      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      const snapshotHoy = await consultaBase
        .where('fechaProcesamiento', '>=', inicioHoy)
        .get();
      const documentosHoy = snapshotHoy.size;

      let sumaScores = 0;
      let contadorScores = 0;
      const distribucionRecomendaciones: { [key: string]: number } = {};
      const distribucionRevisionManual: { [key: string]: number } = {}; // NUEVO
      const tiposDocumentosMasComunes: { [key: string]: number } = {};

      snapshotTotal.forEach((doc: any) => {
        const data = doc.data();
        
        if (data.scoreAutenticidad !== undefined) {
          sumaScores += data.scoreAutenticidad;
          contadorScores++;
        }

        const recomendacion = data.recomendacion || 'sin_determinar';
        distribucionRecomendaciones[recomendacion] = (distribucionRecomendaciones[recomendacion] || 0) + 1;

        // NUEVO: Distribución de revisión manual
        const estadoRevision = data.estadoRevision || 'pendiente';
        distribucionRevisionManual[estadoRevision] = (distribucionRevisionManual[estadoRevision] || 0) + 1;

        const tipoDetectado = data.tipoDocumentoDetectado || 'no_determinado';
        tiposDocumentosMasComunes[tipoDetectado] = (tiposDocumentosMasComunes[tipoDetectado] || 0) + 1;
      });

      const scorePromedio = contadorScores > 0 ? Math.round((sumaScores / contadorScores) * 100) / 100 : 0;

      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      
      const snapshotTendencia = await consultaBase
        .where('fechaProcesamiento', '>=', hace30Dias)
        .orderBy('fechaProcesamiento', 'asc')
        .get();

      const tendenciaUltimos30Dias = this.procesarTendencia(snapshotTendencia);

      return {
        totalDocumentos,
        documentosHoy,
        scorePromedio,
        distribucionRecomendaciones,
        distribucionRevisionManual, // NUEVO
        tiposDocumentosMasComunes,
        tendenciaUltimos30Dias
      };

    } catch (error) {
      console.error('❌ Error calculando estadísticas:', error);
      throw new Error(`Error obteniendo estadísticas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Test de conectividad con Cloud Storage
   */
  async testStorageConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 [DocumentService] Probando conexión con Cloud Storage...');

      const [bucketExists] = await this.bucket.exists();
      
      if (!bucketExists) {
        return {
          success: false,
          message: `Bucket ${this.bucketName} no existe`
        };
      }

      const [metadata] = await this.bucket.getMetadata();
      
      return {
        success: true,
        message: 'Cloud Storage conectado correctamente',
        details: {
          bucketName: this.bucketName,
          location: metadata.location,
          storageClass: metadata.storageClass,
          created: metadata.timeCreated
        }
      };
      
    } catch (error) {
      console.error('❌ Error probando Cloud Storage:', error);
      return {
        success: false,
        message: `Error conectando con Cloud Storage: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  /**
   * Obtiene el texto completo de un documento específico
   */
  async getTextoCompleto(documentoId: string): Promise<string> {
    try {
      const docPrincipal = await db.collection('documentos').doc(documentoId).get();
      
      if (!docPrincipal.exists) {
        throw new Error('Documento no encontrado');
      }

      const data = docPrincipal.data();
      
      if (!data?.textoCompleto) {
        return data?.textoPreview || '';
      }

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
   * Elimina un documento y su archivo asociado
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
        try {
          // Extraemos el nombre del archivo de la URL
          const nombreArchivo = archivoUrl.split(`${this.bucketName}/`)[1];
          if (nombreArchivo) {
            const archivo = this.bucket.file(nombreArchivo);
            await archivo.delete();
            console.log(`🗑️ Archivo eliminado de Storage: ${nombreArchivo}`);
          }
        } catch (storageError) {
          console.warn(`⚠️ No se pudo eliminar archivo de Storage: ${storageError}`);
          // Continuamos con la eliminación en Firestore aunque falle el Storage
        }
      }

      // Eliminamos los registros de Firestore
      await db.collection('documentos').doc(documentoId).delete();
      
      // Intentamos eliminar texto completo si existe
      try {
        await db.collection('textos-completos').doc(documentoId).delete();
      } catch (textError) {
        console.warn(`⚠️ No se encontró texto completo para eliminar: ${textError}`);
      }

      console.log(`🗑️ Documento eliminado exitosamente: ${documentoId}`);

    } catch (error) {
      console.error('❌ Error eliminando documento:', error);
      throw new Error(`Error eliminando documento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * FUNCIONES AUXILIARES PRIVADAS
   */

  private calcularMetadatosAvanzados(texto: string, metadatosExistentes?: any) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    return {
      numeroCaracteres: texto.length,
      numeroPalabras: palabras.length,
      numeroLineas: lineas.length,
      promedioCaracteresPorPalabra: palabras.length > 0 ? Math.round((texto.length / palabras.length) * 100) / 100 : 0,
      promedioPalabrasPorLinea: lineas.length > 0 ? Math.round((palabras.length / lineas.length) * 100) / 100 : 0,
      calidad: this.determinarCalidadTexto(palabras.length, texto.length) as 'alta' | 'media' | 'baja',
      
      objetosDetectados: metadatosExistentes?.objetosDetectados || 0,
      logosProcesados: metadatosExistentes?.logosProcesados || [],
      sellosProcesados: metadatosExistentes?.sellosProcesados || [],
      firmasProcesadas: metadatosExistentes?.firmasProcesadas || [],
      resolucionImagen: metadatosExistentes?.resolucionImagen || 'media',
      estructuraDocumento: metadatosExistentes?.estructuraDocumento || 'informal',
      confianzaPromedio: metadatosExistentes?.confianzaPromedio || 0
    };
  }

  private determinarCarpetaPorTipo(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdfs';
    if (mimeType.startsWith('image/')) return 'imagenes';
    return 'otros';
  }

  private determinarTipoDocumento(nombreArchivo: string): string {
    const nombreLower = nombreArchivo.toLowerCase();
    
    if (nombreLower.includes('diploma') || nombreLower.includes('titulo')) return 'diploma';
    if (nombreLower.includes('certificado') || nombreLower.includes('certificate')) return 'certificado';
    if (nombreLower.includes('nota') || nombreLower.includes('grade')) return 'notas';
    if (nombreLower.includes('cedula') || nombreLower.includes('id')) return 'identificacion';
    
    return 'documento_general';
  }

  private detectarTipoDocumentoPorTexto(texto: string): string {
    const textoLower = texto.toLowerCase();
    
    if (textoLower.includes('diploma') || textoLower.includes('degree')) return 'diploma';
    if (textoLower.includes('certificado') || textoLower.includes('certificate')) return 'certificado';
    if (textoLower.includes('nota') || textoLower.includes('calificacion') || textoLower.includes('grade')) return 'notas';
    if (textoLower.includes('cedula') || textoLower.includes('identificacion')) return 'identificacion';
    if (textoLower.includes('pasaporte') || textoLower.includes('passport')) return 'pasaporte';
    
    return 'documento_general';
  }

  private extraerPalabrasClave(texto: string): string[] {
    const palabrasRelevantes = [
      'universidad', 'colegio', 'instituto', 'certificate', 'diploma', 'degree',
      'director', 'rector', 'registrar', 'oficial', 'sello', 'firma', 'microsoft', 'mvp'
    ];
    
    const textoLower = texto.toLowerCase();
    return palabrasRelevantes.filter(palabra => textoLower.includes(palabra));
  }

  private calcularChecksum(texto: string): string {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      const char = texto.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private procesarTendencia(snapshot: any): Array<{ fecha: string; cantidad: number }> {
    const contadorPorDia: { [fecha: string]: number } = {};
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const fecha = data.fechaProcesamiento.toDate().toISOString().split('T')[0];
      contadorPorDia[fecha] = (contadorPorDia[fecha] || 0) + 1;
    });

    return Object.entries(contadorPorDia)
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * CORRECCIÓN: Actualizar estadísticas con manejo correcto de FieldValue
   */
  private async actualizarEstadisticas(documento: DocumentoProcessado): Promise<void> {
    try {
      const estadisticasRef = db.collection('estadisticas').doc('globales');
      const fecha = new Date().toISOString().split('T')[0];
      
      await estadisticasRef.set({
        ultimoDocumentoProcesado: documento.id,
        ultimaFechaProcesamiento: new Date(),
        [`documentosPorDia.${fecha}`]: FieldValue.increment(1), // CORRECCIÓN: Uso correcto de FieldValue
        totalDocumentosProcesados: FieldValue.increment(1)
      }, { merge: true });
      
    } catch (error) {
      console.warn('⚠️ No se pudieron actualizar estadísticas globales:', error);
      // No es crítico, solo loggeamos el warning
    }
  }

  private async validarPDF(buffer: Buffer): Promise<void> {
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith('%PDF-')) {
      throw new Error('PDF corrupto: Header inválido');
    }
    
    if (buffer.length < 100) {
      throw new Error('PDF corrupto: Archivo demasiado pequeño');
    }
  }

  private determinarCalidadTexto(palabras: number, caracteres: number): string {
    if (palabras > 100 && caracteres > 500) {
      return 'alta';
    } else if (palabras > 20 && caracteres > 100) {
      return 'media';
    } else {
      return 'baja';
    }
  }

  private obtenerExtension(nombreArchivo: string): string {
    const ultimoPunto = nombreArchivo.lastIndexOf('.');
    return ultimoPunto > 0 ? nombreArchivo.substring(ultimoPunto + 1).toLowerCase() : '';
  }

  private sanitizarNombreArchivo(nombreArchivo: string): string {
    return nombreArchivo
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_');
  }
}