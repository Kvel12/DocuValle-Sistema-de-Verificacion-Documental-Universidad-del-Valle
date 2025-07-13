// Servicio especializado en Vision API de Google Cloud
// Versión mejorada con detección de elementos de seguridad (firmas, logos, sellos)

import { ImageAnnotatorClient } from '@google-cloud/vision';

// Interfaz para los resultados de análisis visual
export interface AnalisisVisual {
  textoExtraido: string;
  elementosSeguridad: {
    sellos: boolean;
    firmas: boolean;
    logos: boolean;
    detallesSellos: string[];
    detallesFirmas: string[];
    detallesLogos: string[];
  };
  objetosDetectados: Array<{
    nombre: string;
    confianza: number;
    categoria: 'sello' | 'firma' | 'logo' | 'otro';
  }>;
  calidad: {
    claridadTexto: 'alta' | 'media' | 'baja';
    resolucion: 'alta' | 'media' | 'baja';
    estructuraDocumento: 'formal' | 'informal' | 'dudosa';
  };
}

export class VisionService {
  private visionClient: ImageAnnotatorClient;

  constructor() {
    // Inicializamos el cliente de Vision API
    this.visionClient = new ImageAnnotatorClient({
      projectId: process.env.PROJECT_ID || 'apt-cubist-368817'
    });
    
    console.log('🔍 Vision API Service inicializado correctamente');
  }

  /**
   * Método específico para probar la conectividad de Vision API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🔍 Probando conectividad con Vision API...');
      
      if (!this.visionClient) {
        throw new Error('Cliente de Vision API no inicializado');
      }

      const projectId = await this.visionClient.getProjectId();
      
      return {
        success: true,
        message: 'Vision API conectado correctamente',
        details: {
          projectId,
          status: 'operational',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Error probando Vision API:', error);
      
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        if (error.message.includes('authentication')) {
          errorMessage = 'Error de autenticación. Verifique las credenciales de la cuenta de servicio.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Error de permisos. La cuenta de servicio no tiene acceso a Vision API.';
        } else if (error.message.includes('quota')) {
          errorMessage = 'Se ha excedido la cuota de Vision API.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Análisis completo del documento con detección de elementos de seguridad
   * NUEVA FUNCIÓN PRINCIPAL que reemplaza detectTextFromBuffer
   */
  async analizarDocumentoCompleto(buffer: Buffer, mimeType: string): Promise<AnalisisVisual> {
    try {
      const supportedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp',
        'image/webp', 'image/tiff', 'application/pdf'
      ];
      
      if (!supportedTypes.includes(mimeType)) {
        throw new Error(`Tipo de archivo no soportado: ${mimeType}. Tipos válidos: ${supportedTypes.join(', ')}`);
      }

      if (!buffer || buffer.length === 0) {
        throw new Error('El archivo está vacío o no contiene datos válidos');
      }

      console.log(`🔍 Análisis completo - Archivo: ${mimeType}, tamaño: ${buffer.length} bytes`);

      // Para PDFs, convertimos la primera página a imagen
      let imageBuffer = buffer;
      if (mimeType === 'application/pdf') {
        imageBuffer = await this.convertirPdfAImagen(buffer);
      }

      // Configuramos múltiples features de Vision API
      const request = {
        image: {
          content: imageBuffer.toString('base64'),
        },
        features: [
          // Detección de texto
          { type: 'TEXT_DETECTION' as const, maxResults: 1 },
          { type: 'DOCUMENT_TEXT_DETECTION' as const, maxResults: 1 },
          
          // Detección de elementos visuales
          { type: 'LOGO_DETECTION' as const, maxResults: 10 },
          { type: 'OBJECT_LOCALIZATION' as const, maxResults: 20 },
          { type: 'LABEL_DETECTION' as const, maxResults: 15 },
          
          // Para mejor análisis de calidad
          { type: 'IMAGE_PROPERTIES' as const, maxResults: 1 },
          { type: 'SAFE_SEARCH_DETECTION' as const, maxResults: 1 }
        ],
        imageContext: {
          languageHints: ['es', 'en'],
          // Configuramos para detectar mejor texto en documentos
          textDetectionParams: {
            enableTextDetectionConfidenceScore: true
          }
        }
      };

      console.log('🤖 Enviando petición completa a Vision API...');
      const [result] = await this.visionClient.annotateImage(request);

      if (result.error) {
        throw new Error(`Vision API error: ${result.error.message}`);
      }

      // Extraemos y analizamos todos los resultados
      const analisis: AnalisisVisual = {
        textoExtraido: this.extraerTexto(result),
        elementosSeguridad: await this.analizarElementosSeguridad(result),
        objetosDetectados: this.procesarObjetosDetectados(result),
        calidad: this.evaluarCalidadDocumento(result)
      };

      console.log(`✅ Análisis completo finalizado:`);
      console.log(`   - Texto: ${analisis.textoExtraido.length} caracteres`);
      console.log(`   - Sellos: ${analisis.elementosSeguridad.sellos}`);
      console.log(`   - Firmas: ${analisis.elementosSeguridad.firmas}`);
      console.log(`   - Logos: ${analisis.elementosSeguridad.logos}`);
      console.log(`   - Objetos detectados: ${analisis.objetosDetectados.length}`);

      return analisis;

    } catch (error) {
      console.error('❌ Error en análisis completo:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('Se ha excedido la cuota de Vision API. Intente más tarde.');
        } else if (error.message.includes('permission')) {
          throw new Error('Error de permisos. Verifique la configuración de la cuenta de servicio.');
        } else if (error.message.includes('Bad image data')) {
          throw new Error('Los datos de la imagen no son válidos. Verifique que el archivo no esté corrupto.');
        } else {
          throw new Error(`Error procesando el documento: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido al procesar el documento con Vision API');
    }
  }

  /**
   * Mantener compatibilidad con el método anterior
   */
  async detectTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      const analisis = await this.analizarDocumentoCompleto(buffer, mimeType);
      return analisis.textoExtraido;
    } catch (error) {
      console.error('❌ Error extrayendo texto:', error);
      throw error;
    }
  }

  /**
   * Extrae texto de los resultados de Vision API
   */
  private extraerTexto(result: any): string {
    let textoExtraido = '';
    
    if (result.fullTextAnnotation && result.fullTextAnnotation.text) {
      textoExtraido = result.fullTextAnnotation.text;
      console.log(`✅ Texto extraído usando DOCUMENT_TEXT_DETECTION (${textoExtraido.length} caracteres)`);
    } else if (result.textAnnotations && result.textAnnotations.length > 0) {
      textoExtraido = result.textAnnotations[0].description || '';
      console.log(`✅ Texto extraído usando TEXT_DETECTION (${textoExtraido.length} caracteres)`);
    } else {
      console.log('⚠️ No se detectó texto en el documento');
      return 'No se pudo extraer texto del documento. Verifique que el documento contenga texto legible.';
    }

    return this.limpiarTextoExtraido(textoExtraido);
  }

  /**
   * NUEVA FUNCIÓN: Analiza elementos de seguridad específicos
   */
  private async analizarElementosSeguridad(result: any): Promise<AnalisisVisual['elementosSeguridad']> {
    const elementos = {
      sellos: false,
      firmas: false,
      logos: false,
      detallesSellos: [] as string[],
      detallesFirmas: [] as string[],
      detallesLogos: [] as string[]
    };

    // 1. Analizar logos detectados
    if (result.logoAnnotations && result.logoAnnotations.length > 0) {
      elementos.logos = true;
      result.logoAnnotations.forEach((logo: any) => {
        if (logo.score > 0.5) { // Solo logos con alta confianza
          elementos.detallesLogos.push(`${logo.description} (${Math.round(logo.score * 100)}%)`);
          console.log(`🎯 Logo detectado: ${logo.description} - Confianza: ${Math.round(logo.score * 100)}%`);
        }
      });
    }

    // 2. Analizar objetos que pueden ser sellos o firmas
    if (result.localizedObjectAnnotations && result.localizedObjectAnnotations.length > 0) {
      result.localizedObjectAnnotations.forEach((objeto: any) => {
        const nombre = objeto.name.toLowerCase();
        const confianza = objeto.score;
        
        if (confianza > 0.5) {
          // Detectar sellos
          if (this.esProbableSello(nombre)) {
            elementos.sellos = true;
            elementos.detallesSellos.push(`${objeto.name} (${Math.round(confianza * 100)}%)`);
            console.log(`🏛️ Posible sello detectado: ${objeto.name} - Confianza: ${Math.round(confianza * 100)}%`);
          }
          
          // Detectar firmas
          if (this.esProbableFirma(nombre)) {
            elementos.firmas = true;
            elementos.detallesFirmas.push(`${objeto.name} (${Math.round(confianza * 100)}%)`);
            console.log(`✍️ Posible firma detectada: ${objeto.name} - Confianza: ${Math.round(confianza * 100)}%`);
          }
        }
      });
    }

    // 3. Análisis adicional basado en etiquetas
    if (result.labelAnnotations && result.labelAnnotations.length > 0) {
      result.labelAnnotations.forEach((etiqueta: any) => {
        const descripcion = etiqueta.description.toLowerCase();
        const confianza = etiqueta.score;
        
        if (confianza > 0.7) {
          // Buscar etiquetas relacionadas con elementos de seguridad
          if (this.esEtiquetaSello(descripcion)) {
            elementos.sellos = true;
            elementos.detallesSellos.push(`Etiqueta: ${etiqueta.description} (${Math.round(confianza * 100)}%)`);
          }
          
          if (this.esEtiquetaFirma(descripcion)) {
            elementos.firmas = true;
            elementos.detallesFirmas.push(`Etiqueta: ${etiqueta.description} (${Math.round(confianza * 100)}%)`);
          }
          
          if (this.esEtiquetaLogo(descripcion)) {
            elementos.logos = true;
            elementos.detallesLogos.push(`Etiqueta: ${etiqueta.description} (${Math.round(confianza * 100)}%)`);
          }
        }
      });
    }

    return elementos;
  }

  /**
   * Procesa objetos detectados y los categoriza
   */
  private procesarObjetosDetectados(result: any): AnalisisVisual['objetosDetectados'] {
    const objetos: AnalisisVisual['objetosDetectados'] = [];

    // Agregar logos
    if (result.logoAnnotations) {
      result.logoAnnotations.forEach((logo: any) => {
        if (logo.score > 0.5) {
          objetos.push({
            nombre: logo.description,
            confianza: logo.score,
            categoria: 'logo'
          });
        }
      });
    }

    // Agregar objetos localizados
    if (result.localizedObjectAnnotations) {
      result.localizedObjectAnnotations.forEach((objeto: any) => {
        if (objeto.score > 0.5) {
          objetos.push({
            nombre: objeto.name,
            confianza: objeto.score,
            categoria: this.categorizarObjeto(objeto.name)
          });
        }
      });
    }

    return objetos;
  }

  /**
   * Evalúa la calidad general del documento
   */
  private evaluarCalidadDocumento(result: any): AnalisisVisual['calidad'] {
    const calidad = {
      claridadTexto: 'media' as 'alta' | 'media' | 'baja',
      resolucion: 'media' as 'alta' | 'media' | 'baja',
      estructuraDocumento: 'informal' as 'formal' | 'informal' | 'dudosa'
    };

    // Evaluar claridad del texto basado en confianza
    if (result.fullTextAnnotation && result.fullTextAnnotation.pages) {
      const paginasConfianza = result.fullTextAnnotation.pages.map((page: any) => {
        if (page.confidence) return page.confidence;
        return 0.5; // Valor por defecto si no hay confianza
      });
      
      const confianzaPromedio = paginasConfianza.reduce((a: number, b: number) => a + b, 0) / paginasConfianza.length;
      
      if (confianzaPromedio > 0.8) {
        calidad.claridadTexto = 'alta';
      } else if (confianzaPromedio > 0.6) {
        calidad.claridadTexto = 'media';
      } else {
        calidad.claridadTexto = 'baja';
      }
    }

    // Evaluar resolución basado en propiedades de imagen
    if (result.imagePropertiesAnnotation) {
      // Esto es una estimación basada en las propiedades disponibles
      calidad.resolucion = 'media'; // Por ahora, podríamos mejorarlo con más análisis
    }

    // Evaluar estructura del documento basado en elementos detectados
    const tieneSellos = result.localizedObjectAnnotations?.some((obj: any) => 
      this.esProbableSello(obj.name.toLowerCase()) && obj.score > 0.5
    );
    const tieneLogos = result.logoAnnotations?.some((logo: any) => logo.score > 0.5);
    const textoFormal = this.analizarFormalidadTexto(result.fullTextAnnotation?.text || '');

    if (tieneSellos && tieneLogos && textoFormal) {
      calidad.estructuraDocumento = 'formal';
    } else if (textoFormal || tieneLogos) {
      calidad.estructuraDocumento = 'informal';
    } else {
      calidad.estructuraDocumento = 'dudosa';
    }

    return calidad;
  }

  /**
   * Funciones auxiliares para clasificación de elementos
   */
  private esProbableSello(nombre: string): boolean {
    const palabrasSellos = [
      'seal', 'stamp', 'emblem', 'badge', 'crest', 'insignia',
      'official', 'government', 'institutional', 'circular',
      'sello', 'timbre', 'emblema', 'escudo'
    ];
    return palabrasSellos.some(palabra => nombre.includes(palabra));
  }

  private esProbableFirma(nombre: string): boolean {
    const palabrasFirmas = [
      'signature', 'handwriting', 'autograph', 'signing',
      'firma', 'signatura', 'autógrafo', 'manuscrito'
    ];
    return palabrasFirmas.some(palabra => nombre.includes(palabra));
  }

  private esEtiquetaSello(descripcion: string): boolean {
    const etiquetasSellos = [
      'seal', 'stamp', 'emblem', 'badge', 'official', 'government',
      'circular', 'round', 'institutional'
    ];
    return etiquetasSellos.some(etiqueta => descripcion.includes(etiqueta));
  }

  private esEtiquetaFirma(descripcion: string): boolean {
    const etiquetasFirmas = [
      'signature', 'handwriting', 'writing', 'pen', 'ink',
      'autograph', 'script', 'cursive'
    ];
    return etiquetasFirmas.some(etiqueta => descripcion.includes(etiqueta));
  }

  private esEtiquetaLogo(descripcion: string): boolean {
    const etiquetasLogos = [
      'logo', 'brand', 'company', 'institution', 'university',
      'school', 'organization', 'symbol'
    ];
    return etiquetasLogos.some(etiqueta => descripcion.includes(etiqueta));
  }

  private categorizarObjeto(nombre: string): 'sello' | 'firma' | 'logo' | 'otro' {
    const nombreLower = nombre.toLowerCase();
    
    if (this.esProbableSello(nombreLower)) return 'sello';
    if (this.esProbableFirma(nombreLower)) return 'firma';
    if (this.esEtiquetaLogo(nombreLower)) return 'logo';
    
    return 'otro';
  }

  private analizarFormalidadTexto(texto: string): boolean {
    const palabrasFormales = [
      'certificado', 'diploma', 'título', 'universidad', 'colegio',
      'instituto', 'director', 'rector', 'registro', 'oficial',
      'certificate', 'diploma', 'degree', 'university', 'college',
      'director', 'registrar', 'official'
    ];
    
    const textoLower = texto.toLowerCase();
    const palabrasEncontradas = palabrasFormales.filter(palabra => 
      textoLower.includes(palabra)
    ).length;
    
    return palabrasEncontradas >= 2; // Al menos 2 palabras formales
  }

  /**
   * Convierte PDF a imagen para procesamiento con Vision API
   */
  private async convertirPdfAImagen(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      // Por ahora, intentamos procesar el PDF directamente
      // En el futuro, podrías usar pdf2pic o similar para convertir a imagen
      console.log('📄 Procesando PDF directamente con Vision API...');
      return pdfBuffer;
    } catch (error) {
      console.error('❌ Error convirtiendo PDF:', error);
      throw new Error('Error procesando archivo PDF. Intente con una imagen del documento.');
    }
  }

  /**
   * Método de prueba con imagen sintética
   */
  async testWithSyntheticImage(): Promise<{ success: boolean; message: string; resultado?: string }> {
    try {
      const miniImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77ygAAAABJRU5ErkJggg==';
      const imageBuffer = Buffer.from(miniImageBase64, 'base64');
      
      console.log('🧪 Ejecutando test con imagen sintética...');
      
      const analisis = await this.analizarDocumentoCompleto(imageBuffer, 'image/png');
      
      return {
        success: true,
        message: 'Test sintético completado exitosamente',
        resultado: `Texto: ${analisis.textoExtraido.substring(0, 100)}... Elementos: ${JSON.stringify(analisis.elementosSeguridad)}`
      };
      
    } catch (error) {
      console.error('❌ Error en test sintético:', error);
      return {
        success: false,
        message: 'Error en test sintético: ' + (error instanceof Error ? error.message : 'Error desconocido')
      };
    }
  }

  /**
   * Limpia y mejora el texto extraído por Vision API
   */
  private limpiarTextoExtraido(textoRaw: string): string {
    if (!textoRaw || textoRaw.trim().length === 0) {
      return 'No se pudo extraer texto del documento.';
    }

    let textoLimpio = textoRaw;

    // Normalizamos los saltos de línea
    textoLimpio = textoLimpio.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Eliminamos líneas vacías excesivas (más de 2 seguidas)
    textoLimpio = textoLimpio.replace(/\n{3,}/g, '\n\n');

    // Eliminamos espacios excesivos
    textoLimpio = textoLimpio.replace(/[ \t]{2,}/g, ' ');

    // Eliminamos espacios al inicio y final de cada línea
    textoLimpio = textoLimpio
      .split('\n')
      .map(linea => linea.trim())
      .join('\n');

    // Eliminamos espacios al inicio y final del texto completo
    textoLimpio = textoLimpio.trim();

    return textoLimpio;
  }

  /**
   * Analiza la calidad del texto extraído
   */
  analizarCalidadTexto(texto: string) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const caracteresTotales = texto.length;
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    const promedioCaracteresPorPalabra = palabras.length > 0 ? caracteresTotales / palabras.length : 0;
    const promedioPalabrasPorLinea = lineas.length > 0 ? palabras.length / lineas.length : 0;

    return {
      palabrasTotal: palabras.length,
      caracteresTotales,
      lineasTotal: lineas.length,
      promedioCaracteresPorPalabra: Math.round(promedioCaracteresPorPalabra * 100) / 100,
      promedioPalabrasPorLinea: Math.round(promedioPalabrasPorLinea * 100) / 100,
      calidad: this.determinarCalidad(palabras.length, caracteresTotales)
    };
  }

  /**
   * Determina la calidad del texto extraído
   */
  private determinarCalidad(palabras: number, caracteres: number): 'alta' | 'media' | 'baja' {
    if (palabras > 50 && caracteres > 200) {
      return 'alta';
    } else if (palabras > 10 && caracteres > 50) {
      return 'media';
    } else {
      return 'baja';
    }
  }
}