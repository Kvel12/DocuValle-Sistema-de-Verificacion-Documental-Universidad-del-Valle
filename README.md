# DocuValle-Sistema-de-Verificacion-Documental-Universidad-del-Valle

Sistema de Verificación de Documentos con Inteligencia Artificial

---

## 📑 Índice de Contenidos

1. [Introducción](#introducción)
2. [Características Principales](#características-principales)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Instalación y Configuración Local](#instalación-y-configuración-local)
5. [Manual de Usuario (Frontend)](#manual-de-usuario-frontend)
    - [5.1 Inicio de Sesión](#51-inicio-de-sesión)
    - [5.2 Carga y Análisis de Documentos](#52-carga-y-análisis-de-documentos)
    - [5.3 Visualización de Resultados](#53-visualización-de-resultados)
    - [5.4 Gestión de Usuarios Administradores](#54-gestión-de-usuarios-administradores)
    - [5.5 Cierre de Sesión](#55-cierre-de-sesión)
6. [Manual de Usuario (Backend/API)](#manual-de-usuario-backendapi)
    - [6.1 Estructura de la API](#61-estructura-de-la-api)
    - [6.2 Endpoints y Uso](#62-endpoints-y-uso)
7. [Recomendaciones Finales](#recomendaciones-finales)

---

---

## Introducción

DocuValle es una plataforma web desarrollada para facilitar la verificación de autenticidad de documentos utilizando tecnologías de inteligencia artificial, específicamente Google Cloud Vision API. Su principal objetivo es ofrecer una herramienta accesible, eficiente y confiable para el análisis de certificados, diplomas y documentos académicos.

El sistema permite a usuarios administradores cargar documentos, procesarlos mediante algoritmos OCR y validación de elementos de seguridad (sellos, firmas, logos) y obtener un informe automatizado de confiabilidad.

---

## Características Principales

- ✅ Carga de múltiples documentos con previsualización.
- ✅ Análisis automático con Google Cloud Vision API.
- ✅ Generación de score de autenticidad.
- ✅ Visualización detallada de resultados.
- ✅ Gestión básica de usuarios administradores.
- ✅ Interfaz intuitiva y sencilla.
- ✅ Sistema seguro con autenticación y sesiones protegidas.

---

## Tecnologías Utilizadas

### Frontend

- React 18 + TypeScript
- TailwindCSS
- React Router DOM
- React Dropzone
- Axios

### Backend

- Node.js + Express + TypeScript
- Firebase Admin SDK
- JWT para autenticación
- Google Cloud Storage & Vision API

### Base de Datos

- Firestore (NoSQL)

### Hosting y DevOps

- Firebase Hosting (Frontend)
- Cloud Run (Backend)
- Cloud Build (CI/CD)

---

## Instalación y Configuración Local

### Requisitos Previos

- Node.js v18+
- Cuenta de Firebase con proyecto configurado
- Clave de servicio (service-account-key.json)

### Pasos

1. Clonar el repositorio:

```bash
git clone https://github.com/tuusuario/docuvalle.git
cd docuvalle
```

2. Configurar variables de entorno en backend/.env:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json
PROJECT_ID=apt-cubist-368817
NODE_ENV=development
JWT_SECRET=clave_secreta_segura
```

3. instalar dependencias

```bash
cd backend
npm install
cd ../frontend
npm install
```

4. instalar dependencias

Backend

```bash
cd backend
npm run dev
```

Frontend

```bash
cd frontend
npm run dev
```

La app estará disponible por defecto en http://localhost:3000

## Manual de Usuario (Frontend)

### Inicio de Sesión
- Al ingresar a la aplicación, se presenta el formulario de login.
- Ingresar correo y contraseña válidos para autenticarse.
- En caso de error, se mostrará un mensaje indicando credenciales incorrectas.

### Carga y Análisis de Documentos
- Desde el dashboard, se accede al formulario para subir documentos.
- Se permite arrastrar y soltar o seleccionar manualmente archivos.
- El sistema acepta JPG, PNG y PDF menores de 10MB.
- Al presionar “Analizar Documento”, se procesa el archivo en la nube.
- Se muestra un indicador de carga durante el análisis.

### Visualización de Resultados
- Finalizado el análisis, se muestra:
  - Imagen original del documento.
  - Texto extraído (OCR).
  - Elementos detectados: sellos, logos, firmas.
  - Score final de autenticidad.
- El resultado puede ser guardado en Firestore asociado a un usuario.

### Gestión de Usuarios Administradores
- Desde el botón “Crear Admin” se accede a un formulario de registro.
- El formulario solicita:
  - Nombre completo
  - Correo electrónico  
  - Contraseña
- Al crear el usuario, se guarda en la colección adminUsers de Firestore.

### Cierre de Sesión
- El botón “Logout” en la parte superior permite cerrar sesión.
- Se eliminan los tokens y se redirige a la pantalla de login.

## Manual de Usuario (Backend/API)

### Estructura de la API
Base URL local: http://localhost:4000/api

Todas las peticiones deben incluir el token JWT en el header Authorization:

```bash
Authorization: Bearer <tu-token>
```
### Endpoints y Uso

#### Autenticación
- POST /auth/login

Body:
```bash
{
  "email": "admin@correo.com",
  "password": "secreta123"
}
```

- POST /auth/logout
Cierra sesión y elimina token en frontend.

#### Documentos
- POST /documents/upload
Carga y analiza un documento.

- GET /documents
Lista todos los documentos analizados.

- GET /documents/:id
Retorna detalles de un documento específico.

- PUT /documents/:id/approve
Marca un documento como aprobado.

- PUT /documents/:id/reject
Marca un documento como rechazado.

- DELETE /documents/:id
Elimina un documento del sistema.

#### Reportes
- GET /reports/dashboard
Retorna métricas: total, score promedio, documentos del día, etc.
