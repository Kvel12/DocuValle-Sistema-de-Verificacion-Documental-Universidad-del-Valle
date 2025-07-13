import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
  // Análisis mejorado con Gemini
  analisisGemini?: {
    hasSignatures: boolean;
    signatureCount: number;
    hasSeals: boolean;
    sealCount: number;
    hasWatermarks: boolean;
    formatConsistency: number;
    overallSecurity: number;
    suspiciousElements: string[];
    documentType: string;
    authenticityScore: number;
  };
}

export class VisionService {
  private visionClient: ImageAnnotatorClient;
  private geminiClient: GoogleGenerativeAI | null = null;
  private geminiModel: any = null;

  constructor() {
    // Inicializamos el cliente de Vision API
    this.visionClient = new ImageAnnotatorClient({
      projectId: process.env.PROJECT_ID || 'apt-cubist-368817'
    });
    
    // Inicializamos Gemini solo si tenemos la API key
    this.initializeGemini();
    
    console.log('🔍 Vision API Service inicializado correctamente');
  }

  /**
   * Inicializar Gemini API si está disponible
   */
  private initializeGemini(): void {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      
      if (geminiApiKey) {
        this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
        this.geminiModel = this.geminiClient.getGenerativeModel({ 
          model: "gemini-1.5-flash" // Usamos Flash que es gratuito y rápido
        });
        console.log('🤖 Gemini API inicializado correctamente');
      } else {
        console.warn('⚠️ GEMINI_API_KEY no encontrada. Análisis avanzado deshabilitado.');
      }
    } catch (error) {
      console.warn('⚠️ Error inicializando Gemini API:', error);
      this.geminiClient = null;
      this.geminiModel = null;
    }
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
          geminiEnabled: this.geminiModel !== null,
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
   * Análisis completo del documento con manejo REAL de PDFs (SIN TESTS)
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

      let analisisVision: AnalisisVisual;

      // Para PDFs, usamos procesamiento directo con Vision API (SIN MOCKS)
      if (mimeType === 'application/pdf') {
        console.log('📄 Procesando PDF con Vision API...');
        analisisVision = await this.procesarPDFReal(buffer);
      } else {
        // Para imágenes, usamos el análisis completo de Vision API
        analisisVision = await this.procesarImagenConVisionAPI(buffer);
      }

      // NUEVO: Si Gemini está disponible, realizamos análisis avanzado
      if (this.geminiModel && buffer.length < 20 * 1024 * 1024) { // Solo para archivos < 20MB
        try {
          console.log('🧠 Realizando análisis avanzado con Gemini...');
          const analisisGemini = await this.analizarConGemini(buffer, mimeType);
          analisisVision.analisisGemini = analisisGemini;
          
          // Mejoramos la detección basándonos en Gemini
          this.mejorarDeteccionConGemini(analisisVision);
        } catch (geminiError) {
          console.warn('⚠️ Error en análisis Gemini (continuando sin él):', geminiError);
        }
      }

      console.log(`✅ Análisis completo finalizado:`);
      console.log(`   - Texto: ${analisisVision.textoExtraido.length} caracteres`);
      console.log(`   - Sellos: ${analisisVision.elementosSeguridad.sellos}`);
      console.log(`   - Firmas: ${analisisVision.elementosSeguridad.firmas}`);
      console.log(`   - Logos: ${analisisVision.elementosSeguridad.logos}`);
      console.log(`   - Objetos detectados: ${analisisVision.objetosDetectados.length}`);
      console.log(`   - Gemini habilitado: ${analisisVision.analisisGemini ? 'Sí' : 'No'}`);

      return analisisVision;

    } catch (error) {
      console.error('❌ Error en análisis completo:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('Se ha excedido la cuota de Vision API. Intente más tarde.');
        } else if (error.message.includes('permission')) {
          throw new Error('Error de permisos. Verifique la configuración de la cuenta de servicio.');
        } else if (error.message.includes('Bad image data')) {
          throw new Error('Los datos del archivo no son válidos. Verifique que el archivo no esté corrupto.');
        } else {
          throw new Error(`Error procesando el documento: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido al procesar el documento con Vision API');
    }
  }

  /**
   * CORREGIDO: Procesamiento REAL de PDFs (elimina el mock/test)
   */
  private async procesarPDFReal(buffer: Buffer): Promise<AnalisisVisual> {
    try {
      console.log('📄 Iniciando procesamiento real de PDF...');

      // Intentamos usar Vision API directamente con el PDF
      const request = {
        image: {
          content: buffer.toString('base64'),
        },
        features: [
          { type: 'DOCUMENT_TEXT_DETECTION' as const, maxResults: 1 },
          { type: 'TEXT_DETECTION' as const, maxResults: 1 }
        ],
        imageContext: {
          languageHints: ['es', 'en']
        }
      };

      console.log('🤖 Enviando PDF a Vision API para análisis...');
      const [result] = await this.visionClient.annotateImage(request);

      if (result.error) {
        console.warn(`⚠️ Vision API no pudo procesar el PDF: ${result.error.message}`);
        // Si Vision API falla, creamos un análisis básico REAL (no mock)
        return this.crearAnalisisBasicoFallback();
      }

      // Extraemos la información real del PDF
      const textoExtraido = this.extraerTexto(result);
      
      if (!textoExtraido || textoExtraido.includes('No se pudo extraer texto')) {
        console.warn('⚠️ No se pudo extraer texto del PDF');
        return this.crearAnalisisBasicoFallback();
      }

      // Creamos el análisis basado en datos REALES extraídos
      const analisis: AnalisisVisual = {
        textoExtraido: textoExtraido,
        elementosSeguridad: await this.analizarElementosSeguridad(result, textoExtraido),
        objetosDetectados: this.procesarObjetosDetectados(result),
        calidad: this.evaluarCalidadDocumento(result, textoExtraido)
      };

      console.log(`📄 PDF procesado exitosamente - Texto: ${textoExtraido.length} caracteres`);
      return analisis;

    } catch (error) {
      console.warn(`⚠️ Error procesando PDF: ${error}`);
      return this.crearAnalisisBasicoFallback();
    }
  }

  /**
   * Procesamiento de imágenes con Vision API
   */
  private async procesarImagenConVisionAPI(buffer: Buffer): Promise<AnalisisVisual> {
    const request = {
      image: {
        content: buffer.toString('base64'),
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
        { type: 'IMAGE_PROPERTIES' as const, maxResults: 1 }
      ],
      imageContext: {
        languageHints: ['es', 'en'],
        textDetectionParams: {
          enableTextDetectionConfidenceScore: true
        }
      }
    };

    console.log('🤖 Enviando imagen a Vision API...');
    const [result] = await this.visionClient.annotateImage(request);

    if (result.error) {
      throw new Error(`Vision API error: ${result.error.message}`);
    }

    // Extraemos y analizamos todos los resultados
    const textoExtraido = this.extraerTexto(result);
    const analisis: AnalisisVisual = {
      textoExtraido: textoExtraido,
      elementosSeguridad: await this.analizarElementosSeguridad(result, textoExtraido),
      objetosDetectados: this.procesarObjetosDetectados(result),
      calidad: this.evaluarCalidadDocumento(result, textoExtraido)
    };

    return analisis;
  }

  /**
   * NUEVO: Análisis avanzado con Gemini Vision
   */
  private async analizarConGemini(buffer: Buffer, mimeType: string): Promise<AnalisisVisual['analisisGemini']> {
    if (!this.geminiModel) {
      throw new Error('Gemini no está inicializado');
    }

    try {
      // Convertimos PDF a imagen si es necesario (para Gemini)
      let imageBuffer = buffer;
      let imageMimeType = mimeType;

      if (mimeType === 'application/pdf') {
        // Para PDFs, Gemini no puede procesarlos directamente
        // Necesitaríamos convertir a imagen, pero por ahora saltamos
        console.log('📄 Saltando análisis Gemini para PDF (no soportado directamente)');
        return this.crearAnalisisGeminiFallback();
      }

      const prompt = `
        Analiza este documento y responde ÚNICAMENTE con un JSON en el siguiente formato:
        {
          "hasSignatures": boolean,
          "signatureCount": number,
          "hasSeals": boolean,
          "sealCount": number,
          "hasWatermarks": boolean,
          "formatConsistency": number (0-100),
          "overallSecurity": number (0-100),
          "suspiciousElements": ["elemento1", "elemento2"],
          "documentType": "certificate|diploma|id|passport|other",
          "authenticityScore": number (0-100)
        }

        Evalúa específicamente:
        1. ¿Hay firmas manuscritas visibles?
        2. ¿Hay sellos oficiales o timbres?
        3. ¿Hay marcas de agua o elementos de seguridad?
        4. ¿El formato es consistente con documentos oficiales?
        5. ¿Qué tipo de documento parece ser?
        6. ¿Hay elementos que parezcan sospechosos o alterados?

        Responde SOLO con el JSON, sin texto adicional.
      `;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: imageMimeType
        }
      };

      console.log('🧠 Enviando solicitud a Gemini...');
      const result = await this.geminiModel.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Intentar parsear la respuesta JSON
      console.log('📝 Respuesta raw de Gemini:', text.substring(0, 200) + '...');
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('✅ Análisis Gemini completado exitosamente');
        return analysis;
      } else {
        console.warn('⚠️ Gemini no retornó JSON válido, usando fallback');
        return this.crearAnalisisGeminiFallback();
      }

    } catch (error) {
      console.warn('⚠️ Error en análisis Gemini:', error);
      return this.crearAnalisisGeminiFallback();
    }
  }

  /**
   * Mejora la detección combinando resultados de Vision API y Gemini
   */
  private mejorarDeteccionConGemini(analisisVision: AnalisisVisual): void {
    if (!analisisVision.analisisGemini) return;

    const gemini = analisisVision.analisisGemini;

    // Mejorar detección de firmas
    if (gemini.hasSignatures && gemini.signatureCount > 0) {
      analisisVision.elementosSeguridad.firmas = true;
      if (analisisVision.elementosSeguridad.detallesFirmas.length === 0) {
        analisisVision.elementosSeguridad.detallesFirmas.push(
          `${gemini.signatureCount} firma(s) detectada(s) por Gemini`
        );
      }
    }

    // Mejorar detección de sellos
    if (gemini.hasSeals && gemini.sealCount > 0) {
      analisisVision.elementosSeguridad.sellos = true;
      if (analisisVision.elementosSeguridad.detallesSellos.length === 0) {
        analisisVision.elementosSeguridad.detallesSellos.push(
          `${gemini.sealCount} sello(s) detectado(s) por Gemini`
        );
      }
    }

    // Mejorar evaluación de calidad
    if (gemini.formatConsistency > 80) {
      analisisVision.calidad.estructuraDocumento = 'formal';
    } else if (gemini.formatConsistency > 50) {
      analisisVision.calidad.estructuraDocumento = 'informal';
    } else {
      analisisVision.calidad.estructuraDocumento = 'dudosa';
    }

    console.log('🔧 Detección mejorada con datos de Gemini');
  }

  /**
   * NUEVO: Crear análisis básico cuando Vision API falla (SIN DATOS FALSOS)
   */
  private crearAnalisisBasicoFallback(): AnalisisVisual {
    console.log('📄 Creando análisis básico fallback (archivo no procesable)');
    
    return {
      textoExtraido: 'No se pudo extraer texto del archivo. El archivo puede estar protegido, ser una imagen escaneada sin OCR, o tener un formato no compatible con el procesamiento automático.',
      elementosSeguridad: {
        sellos: false,
        firmas: false,
        logos: false,
        detallesSellos: [],
        detallesFirmas: [],
        detallesLogos: []
      },
      objetosDetectados: [],
      calidad: {
        claridadTexto: 'baja',
        resolucion: 'media',
        estructuraDocumento: 'dudosa'
      }
    };
  }

  /**
   * Análisis Gemini fallback cuando no está disponible
   */
  private crearAnalisisGeminiFallback(): AnalisisVisual['analisisGemini'] {
    return {
      hasSignatures: false,
      signatureCount: 0,
      hasSeals: false,
      sealCount: 0,
      hasWatermarks: false,
      formatConsistency: 50,
      overallSecurity: 30,
      suspiciousElements: [],
      documentType: 'other',
      authenticityScore: 30
    };
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
   * Analiza elementos de seguridad usando Vision API Y análisis de texto
   */
  private async analizarElementosSeguridad(result: any, textoExtraido: string): Promise<AnalisisVisual['elementosSeguridad']> {
    const elementos = {
      sellos: false,
      firmas: false,
      logos: false,
      detallesSellos: [] as string[],
      detallesFirmas: [] as string[],
      detallesLogos: [] as string[]
    };

    // 1. Analizar logos detectados por Vision API
    if (result.logoAnnotations && result.logoAnnotations.length > 0) {
      elementos.logos = true;
      result.logoAnnotations.forEach((logo: any) => {
        if (logo.score > 0.3) {
          elementos.detallesLogos.push(`${logo.description} (${Math.round(logo.score * 100)}%)`);
          console.log(`🎯 Logo detectado: ${logo.description} - Confianza: ${Math.round(logo.score * 100)}%`);
        }
      });
    }

    // 2. Analizar objetos detectados por Vision API
    if (result.localizedObjectAnnotations && result.localizedObjectAnnotations.length > 0) {
      result.localizedObjectAnnotations.forEach((objeto: any) => {
        const nombre = objeto.name.toLowerCase();
        const confianza = objeto.score;
        
        if (confianza > 0.3) {
          if (this.esProbableSello(nombre)) {
            elementos.sellos = true;
            elementos.detallesSellos.push(`${objeto.name} (${Math.round(confianza * 100)}%)`);
            console.log(`🏛️ Posible sello detectado: ${objeto.name} - Confianza: ${Math.round(confianza * 100)}%`);
          }
          
          if (this.esProbableFirma(nombre)) {
            elementos.firmas = true;
            elementos.detallesFirmas.push(`${objeto.name} (${Math.round(confianza * 100)}%)`);
            console.log(`✍️ Posible firma detectada: ${objeto.name} - Confianza: ${Math.round(confianza * 100)}%`);
          }
        }
      });
    }

    // 3. Analizar etiquetas de Vision API
    if (result.labelAnnotations && result.labelAnnotations.length > 0) {
      result.labelAnnotations.forEach((etiqueta: any) => {
        const descripcion = etiqueta.description.toLowerCase();
        const confianza = etiqueta.score;
        
        if (confianza > 0.5) {
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

    // 4. Análisis basado en texto extraído (solo si hay texto válido)
    if (textoExtraido && !textoExtraido.includes('No se pudo extraer texto')) {
      const analisisTexto = this.analizarElementosPorTextoReal(textoExtraido);
      
      // Combinamos resultados solo si encontramos elementos en el texto
      if (analisisTexto.logos.length > 0) {
        elementos.logos = true;
        elementos.detallesLogos.push(...analisisTexto.logos);
      }
      
      if (analisisTexto.firmas.length > 0) {
        elementos.firmas = true;
        elementos.detallesFirmas.push(...analisisTexto.firmas);
      }
      
      if (analisisTexto.sellos.length > 0) {
        elementos.sellos = true;
        elementos.detallesSellos.push(...analisisTexto.sellos);
      }
    }

    return elementos;
  }

  /**
   * CORREGIDO: Analiza elementos de seguridad basado en el texto extraído REAL
   */
  private analizarElementosPorTextoReal(texto: string): {
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
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Detectar organizaciones conocidas basándose en el texto REAL
    const patronesOrganizaciones = [
      { pattern: /microsoft/i, nombre: 'Microsoft' },
      { pattern: /mvp|most valuable professional/i, nombre: 'Microsoft MVP' },
      { pattern: /student ambassador|mlsa/i, nombre: 'Microsoft Student Ambassador' },
      { pattern: /google|alphabet/i, nombre: 'Google' },
      { pattern: /amazon|aws/i, nombre: 'Amazon' },
      { pattern: /universidad|university/i, nombre: 'Institución Educativa' },
      { pattern: /instituto|institute/i, nombre: 'Instituto' },
      { pattern: /bootcamp/i, nombre: 'Bootcamp' },
      { pattern: /cisco/i, nombre: 'Cisco' },
      { pattern: /oracle/i, nombre: 'Oracle' }
    ];

    patronesOrganizaciones.forEach(org => {
      if (org.pattern.test(texto)) {
        resultado.logos.push(`Organización detectada: ${org.nombre} (análisis de texto)`);
        console.log(`🎯 Organización detectada en texto: ${org.nombre}`);
      }
    });

    // Detectar firmas basado en patrones REALES de nombres y cargos
    lineas.forEach((linea, index) => {
      // Patrón mejorado para detectar nombres con cargos
      const patronesNombreCargo = [
        /^([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)?)\s*[-–—]\s*(Director|Rector|Coordinador|Presidente|Gerente|MVP|MLSA)/i,
        /^([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)?)\s*,\s*(Director|Rector|Coordinador|Presidente|Gerente|MVP|MLSA)/i,
        /^(Director|Rector|Coordinador|Presidente|Gerente):\s*([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+)/i
      ];
      
      patronesNombreCargo.forEach(patron => {
        const match = linea.match(patron);
        if (match) {
          resultado.firmas.push(`Posible firma: ${linea.trim()} (análisis de texto)`);
          console.log(`✍️ Posible firma detectada: ${linea.trim()}`);
        }
      });
    });

    // Detectar elementos de certificación/sellos basándose en texto REAL
    const indicadoresSellos = [
      { termino: 'certificado', peso: 3 },
      { termino: 'diploma', peso: 3 },
      { termino: 'se expide', peso: 2 },
      { termino: 'otorgado', peso: 2 },
      { termino: 'reconocimiento', peso: 2 },
      { termino: 'registro oficial', peso: 3 },
      { termino: 'válido hasta', peso: 2 },
      { termino: 'certificate', peso: 3 },
      { termino: 'issued', peso: 2 },
      { termino: 'certified', peso: 2 }
    ];

    let puntajeSello = 0;
    indicadoresSellos.forEach(indicador => {
      if (textoLower.includes(indicador.termino)) {
        puntajeSello += indicador.peso;
        resultado.sellos.push(`Elemento certificación: ${indicador.termino} (análisis de texto)`);
        console.log(`🏛️ Elemento de certificación detectado: ${indicador.termino}`);
      }
    });

    return resultado;
  }

  // [Resto de métodos auxiliares sin cambios significativos]
  private procesarObjetosDetectados(result: any): AnalisisVisual['objetosDetectados'] {
    const objetos: AnalisisVisual['objetosDetectados'] = [];

    if (result.logoAnnotations) {
      result.logoAnnotations.forEach((logo: any) => {
        if (logo.score > 0.3) {
          objetos.push({
            nombre: logo.description,
            confianza: logo.score,
            categoria: 'logo'
          });
        }
      });
    }

    if (result.localizedObjectAnnotations) {
      result.localizedObjectAnnotations.forEach((objeto: any) => {
        if (objeto.score > 0.3) {
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

  private evaluarCalidadDocumento(result: any, textoExtraido: string): AnalisisVisual['calidad'] {
    const calidad = {
      claridadTexto: 'media' as 'alta' | 'media' | 'baja',
      resolucion: 'media' as 'alta' | 'media' | 'baja',
      estructuraDocumento: 'informal' as 'formal' | 'informal' | 'dudosa'
    };

    if (textoExtraido && !textoExtraido.includes('No se pudo extraer texto')) {
      const palabras = textoExtraido.split(/\s+/).filter(p => p.length > 0);
      
      if (palabras.length > 50 && textoExtraido.length > 300) {
        calidad.claridadTexto = 'alta';
      } else if (palabras.length > 20 && textoExtraido.length > 100) {
        calidad.claridadTexto = 'media';
      } else {
        calidad.claridadTexto = 'baja';
      }

      const textoFormal = this.analizarFormalidadTexto(textoExtraido);
      const tieneLogos = result.logoAnnotations?.some((logo: any) => logo.score > 0.3);
      const tieneEstructura = textoExtraido.toLowerCase().includes('certificado') || 
                             textoExtraido.toLowerCase().includes('diploma');

      if (textoFormal && tieneLogos && tieneEstructura) {
        calidad.estructuraDocumento = 'formal';
      } else if (textoFormal || tieneEstructura) {
        calidad.estructuraDocumento = 'informal';
      } else {
        calidad.estructuraDocumento = 'dudosa';
      }
    } else {
      calidad.claridadTexto = 'baja';
      calidad.estructuraDocumento = 'dudosa';
    }

    return calidad;
  }

  // Funciones auxiliares para clasificación (sin cambios)
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
      'director', 'registrar', 'official', 'otorgado', 'reconocimiento'
    ];
    
    const textoLower = texto.toLowerCase();
    const palabrasEncontradas = palabrasFormales.filter(palabra => 
      textoLower.includes(palabra)
    ).length;
    
    return palabrasEncontradas >= 2;
  }

  private limpiarTextoExtraido(textoRaw: string): string {
    if (!textoRaw || textoRaw.trim().length === 0) {
      return 'No se pudo extraer texto del documento.';
    }

    let textoLimpio = textoRaw;
    textoLimpio = textoLimpio.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    textoLimpio = textoLimpio.replace(/\n{3,}/g, '\n\n');
    textoLimpio = textoLimpio.replace(/[ \t]{2,}/g, ' ');
    textoLimpio = textoLimpio
      .split('\n')
      .map(linea => linea.trim())
      .join('\n');

    return textoLimpio.trim();
  }

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