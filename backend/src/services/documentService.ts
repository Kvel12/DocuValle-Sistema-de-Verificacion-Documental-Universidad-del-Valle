import { db, storage } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

// Interfaz expandida para documentos procesados con soporte Gemini
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
  
  // Campos para el análisis de autenticidad mejorado
  scoreAutenticidad?: number;
  recomendacion?: 'accept' | 'review' | 'reject';
  elementosSeguridad?: {
    sellos: boolean;
    firmas: boolean;
    logos: boolean;
  };
  
  // Campos para revisión manual
  recomendacionManual?: 'accept' | 'review' | 'reject';
  comentarioRevisor?: string;
  revisorId?: string;
  fechaRevisionManual?: Date;
  estadoRevision?: 'pendiente' | 'revisado_manualmente' | 'sin_revision';
  
  // NUEVO: Análisis Gemini
  analisisGemini?: {
    habilitado: boolean;
    tipoDocumento: string;
    scoreAutenticidad: number;
    elementosDetectados: string[];
    consistenciaFormato: number;
    elementosSospechosos: string[];
  };
  
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
    
    // NUEVO: Metadatos específicos de Gemini
    geminiAnalisisCompletado?: boolean;
    tiempoAnalisisGemini?: number;
    versionGemini?: string;
    fallbackUsado?: boolean;
    razonFallback?: string;
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
            version: '3.0',  // Incrementamos versión para Gemini
            geminiCompatible: this.esCompatibleConGemini(file.mimetype).toString()
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
   * MEJORADO: Guarda los resultados del procesamiento con soporte completo para Gemini
   */
  async saveProcessingResult(documento: DocumentoProcessado, analisisGemini?: any): Promise<string> {
    try {
      console.log(`💾 [DocumentService] Guardando resultado: ${documento.id}`);

      if (!documento.id || !documento.userId) {
        throw new Error('ID de documento y userId son obligatorios');
      }

      // Calcular metadatos avanzados incluyendo información de Gemini
      const metadatos = this.calcularMetadatosAvanzados(
        documento.textoExtraido, 
        documento.metadatos, 
        analisisGemini
      );

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
        
        // Campos de revisión manual (iniciales)
        recomendacionManual: null,
        comentarioRevisor: '',
        revisorId: null,
        fechaRevisionManual: null,
        estadoRevision: 'pendiente',
        
        // NUEVO: Análisis Gemini estructurado
        analisisGemini: documento.analisisGemini || {
          habilitado: false,
          tipoDocumento: 'no_determinado',
          scoreAutenticidad: 0,
          elementosDetectados: [],
          consistenciaFormato: 0,
          elementosSospechosos: []
        },
        
        metadatos: metadatos,
        
        // Preview del texto y flags
        textoPreview: documento.textoExtraido.substring(0, 500),
        textoCompleto: documento.textoExtraido.length > 500,
        
        // Análisis de contenido mejorado
        tipoDocumentoDetectado: this.detectarTipoDocumentoPorTexto(documento.textoExtraido),
        palabrasClave: this.extraerPalabrasClave(documento.textoExtraido),
        
        // Scoring combinado (Vision + Gemini)
        scoreVisionAPI: documento.metadatos?.confianzaPromedio || 0,
        scoreGemini: documento.analisisGemini?.scoreAutenticidad || 0,
        
        // Metadatos de versión y compatibilidad
        versionAnalisis: '3.0',
        compatibleGemini: this.esCompatibleConGemini(documento.tipoArchivo),
        fechaUltimaActualizacion: new Date()
      };

      await db.collection('documentos').doc(documento.id).set(documentoFirestore);

      // Guardar texto completo si es necesario
      if (documento.textoExtraido.length > 500) {
        await db.collection('textos-completos').doc(documento.id).set({
          documentoId: documento.id,
          textoCompleto: documento.textoExtraido,
          fechaGuardado: new Date(),
          checksum: this.calcularChecksum(documento.textoExtraido),
          procesadoConGemini: documento.analisisGemini?.habilitado || false
        });
      }

      // Actualizar estadísticas con información de Gemini
      try {
        await this.actualizarEstadisticas(documento);
      } catch (statsError) {
        console.warn('⚠️ No se pudieron actualizar estadísticas globales:', statsError);
      }

      console.log(`✅ Documento guardado exitosamente en Firestore: ${documento.id}`);
      console.log(`   - Gemini habilitado: ${documento.analisisGemini?.habilitado || false}`);
      console.log(`   - Score final: ${documento.scoreAutenticidad}`);
      
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
   * Actualizar estado manual de un documento
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
        estadoRevision: 'revisado_manualmente',
        fechaUltimaActualizacion: new Date()
      });
      
      console.log(`✅ Revisión manual actualizada para documento: ${documentoId}`);
    } catch (error) {
      console.error('❌ Error actualizando revisión manual:', error);
      throw new Error(`Error actualizando revisión manual: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * MEJORADO: Obtiene documentos con información de Gemini
   */
  async getUserDocuments(userId: string, filtros?: {
    limite?: number;
    tipoDocumento?: string;
    recomendacion?: string;
    estadoRevision?: string;
    fechaDesde?: Date;
    fechaHasta?: Date;
    soloGemini?: boolean;  // NUEVO: Filtrar solo documentos procesados con Gemini
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

      if (filtros?.soloGemini) {
        consulta = consulta.where('analisisGemini.habilitado', '==', true);
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
          
          // Campos de revisión manual
          recomendacionManual: data.recomendacionManual,
          comentarioRevisor: data.comentarioRevisor,
          revisorId: data.revisorId,
          fechaRevisionManual: data.fechaRevisionManual ? data.fechaRevisionManual.toDate() : undefined,
          estadoRevision: data.estadoRevision,
          
          // NUEVO: Análisis Gemini
          analisisGemini: data.analisisGemini,
          
          metadatos: data.metadatos
        });
      });

      console.log(`✅ Encontrados ${documentos.length} documentos para el usuario ${userId}`);
      console.log(`   - Con análisis Gemini: ${documentos.filter(d => d.analisisGemini?.habilitado).length}`);
      
      return documentos;

    } catch (error) {
      console.error('❌ Error obteniendo documentos del usuario:', error);
      throw new Error(`Error obteniendo documentos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * MEJORADO: Estadísticas con información de Gemini
   */
  async obtenerEstadisticasDashboard(userId?: string): Promise<{
    totalDocumentos: number;
    documentosHoy: number;
    scorePromedio: number;
    distribucionRecomendaciones: { [key: string]: number };
    distribucionRevisionManual: { [key: string]: number };
    tiposDocumentosMasComunes: { [key: string]: number };
    tendenciaUltimos30Dias: Array<{ fecha: string; cantidad: number }>;
    // NUEVO: Estadísticas de Gemini
    estadisticasGemini: {
      documentosConGemini: number;
      scorePromedioGemini: number;
      tiposDocumentosGemini: { [key: string]: number };
      mejoraPorcentajeDeteccion: number;
    };
  }> {
    try {
      console.log('📊 Calculando estadísticas del dashboard con información Gemini...');

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
      let sumaScoresGemini = 0;
      let contadorGemini = 0;
      
      const distribucionRecomendaciones: { [key: string]: number } = {};
      const distribucionRevisionManual: { [key: string]: number } = {};
      const tiposDocumentosMasComunes: { [key: string]: number } = {};
      const tiposDocumentosGemini: { [key: string]: number } = {};

      snapshotTotal.forEach((doc: any) => {
        const data = doc.data();
        
        if (data.scoreAutenticidad !== undefined) {
          sumaScores += data.scoreAutenticidad;
          contadorScores++;
        }

        // Estadísticas Gemini
        if (data.analisisGemini?.habilitado) {
          contadorGemini++;
          if (data.analisisGemini.scoreAutenticidad) {
            sumaScoresGemini += data.analisisGemini.scoreAutenticidad;
          }
          
          const tipoGemini = data.analisisGemini.tipoDocumento || 'no_determinado';
          tiposDocumentosGemini[tipoGemini] = (tiposDocumentosGemini[tipoGemini] || 0) + 1;
        }

        const recomendacion = data.recomendacion || 'sin_determinar';
        distribucionRecomendaciones[recomendacion] = (distribucionRecomendaciones[recomendacion] || 0) + 1;

        const estadoRevision = data.estadoRevision || 'pendiente';
        distribucionRevisionManual[estadoRevision] = (distribucionRevisionManual[estadoRevision] || 0) + 1;

        const tipoDetectado = data.tipoDocumentoDetectado || 'no_determinado';
        tiposDocumentosMasComunes[tipoDetectado] = (tiposDocumentosMasComunes[tipoDetectado] || 0) + 1;
      });

      const scorePromedio = contadorScores > 0 ? Math.round((sumaScores / contadorScores) * 100) / 100 : 0;
      const scorePromedioGemini = contadorGemini > 0 ? Math.round((sumaScoresGemini / contadorGemini) * 100) / 100 : 0;

      // Calcular mejora porcentual por Gemini
      const scoreVisionSolo = contadorScores > 0 ? sumaScores / contadorScores : 0;
      const mejoraPorcentajeDeteccion = scoreVisionSolo > 0 ? 
        ((scorePromedioGemini - scoreVisionSolo) / scoreVisionSolo) * 100 : 0;

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
        distribucionRevisionManual,
        tiposDocumentosMasComunes,
        tendenciaUltimos30Dias,
        // NUEVO: Estadísticas específicas de Gemini
        estadisticasGemini: {
          documentosConGemini: contadorGemini,
          scorePromedioGemini: scorePromedioGemini,
          tiposDocumentosGemini: tiposDocumentosGemini,
          mejoraPorcentajeDeteccion: Math.round(mejoraPorcentajeDeteccion * 100) / 100
        }
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
          created: metadata.timeCreated,
          geminiCompatibilityEnabled: true
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
          const nombreArchivo = archivoUrl.split(`${this.bucketName}/`)[1];
          if (nombreArchivo) {
            const archivo = this.bucket.file(nombreArchivo);
            await archivo.delete();
            console.log(`🗑️ Archivo eliminado de Storage: ${nombreArchivo}`);
          }
        } catch (storageError) {
          console.warn(`⚠️ No se pudo eliminar archivo de Storage: ${storageError}`);
        }
      }

      // Eliminamos los registros de Firestore
      await db.collection('documentos').doc(documentoId).delete();
      
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
   * FUNCIONES AUXILIARES PRIVADAS MEJORADAS
   */

  /**
   * NUEVO: Verifica si un tipo de archivo es compatible con Gemini
   */
  private esCompatibleConGemini(mimeType: string): boolean {
    const tiposCompatibles = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/bmp', 'image/webp', 'image/tiff'
      // Nota: PDFs no son compatibles directamente con Gemini Vision
    ];
    return tiposCompatibles.includes(mimeType);
  }

  /**
   * MEJORADO: Calcula metadatos incluyendo información de Gemini
   */
  private calcularMetadatosAvanzados(texto: string, metadatosExistentes?: any, analisisGemini?: any) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    const metadatosBase = {
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
      confianzaPromedio: metadatosExistentes?.confianzaPromedio || 0,
      
      // NUEVO: Metadatos específicos de Gemini
      geminiAnalisisCompletado: analisisGemini ? true : false,
      tiempoAnalisisGemini: analisisGemini?.tiempoAnalisis || 0,
      versionGemini: analisisGemini ? 'gemini-1.5-flash' : null,
      fallbackUsado: analisisGemini?.fallbackUsado || false,
      razonFallback: analisisGemini?.razonFallback || null
    };

    return metadatosBase;
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
      'director', 'rector', 'registrar', 'oficial', 'sello', 'firma', 'microsoft', 'mvp',
      'bootcamp', 'student ambassador', 'mlsa', 'cisco', 'oracle', 'aws', 'google'
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
   * Actualizar estadísticas con información de Gemini
   */
  private async actualizarEstadisticas(documento: DocumentoProcessado): Promise<void> {
    try {
      const estadisticasRef = db.collection('estadisticas').doc('globales');
      const fecha = new Date().toISOString().split('T')[0];
      
      const actualizacion: any = {
        ultimoDocumentoProcesado: documento.id,
        ultimaFechaProcesamiento: new Date(),
        [`documentosPorDia.${fecha}`]: FieldValue.increment(1),
        totalDocumentosProcesados: FieldValue.increment(1)
      };

      // NUEVO: Estadísticas específicas de Gemini
      if (documento.analisisGemini?.habilitado) {
        actualizacion[`documentosGeminiPorDia.${fecha}`] = FieldValue.increment(1);
        actualizacion.totalDocumentosGemini = FieldValue.increment(1);
        actualizacion.ultimoDocumentoGemini = documento.id;
      }
      
      await estadisticasRef.set(actualizacion, { merge: true });
      
    } catch (error) {
      console.warn('⚠️ No se pudieron actualizar estadísticas globales:', error);
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