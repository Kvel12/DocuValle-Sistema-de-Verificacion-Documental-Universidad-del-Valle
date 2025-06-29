# Este archivo define cómo se construye y ejecuta la aplicación backend en producción

# ETAPA 1: Construcción (Build Stage)
# Usamos una imagen más completa para compilar el código TypeScript
FROM node:18-alpine AS builder

# Instalar dependencias de sistema necesarias para algunas librerías de Node.js
RUN apk add --no-cache python3 make g++

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de Node.js
# Copiamos estos archivos primero para aprovechar el cache de Docker
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias (incluyendo devDependencies para compilar TypeScript)
RUN npm ci --only=production=false

# Copiar código fuente COMPLETO (incluyendo config/ y services/)
COPY src/ ./src/
COPY config/ ./config/
COPY services/ ./services/

# Compilar TypeScript a JavaScript
RUN npm run build

# Limpiar devDependencies que no necesitamos en producción
RUN npm prune --production

# ETAPA 2: Producción (Production Stage)
# Usamos una imagen más ligera para ejecutar la aplicación
FROM node:18-alpine AS production

# Crear usuario no-root por seguridad
# Nunca ejecutar aplicaciones como root en contenedores
RUN addgroup -g 1001 -S nodejs && \
    adduser -S docuvalle -u 1001

# Instalar solo las dependencias de sistema mínimas necesarias
RUN apk add --no-cache curl

# Establecer directorio de trabajo
WORKDIR /app

# Cambiar propietario del directorio
RUN chown -R docuvalle:nodejs /app
USER docuvalle

# Copiar archivos compilados y dependencias desde la etapa de build
COPY --from=builder --chown=docuvalle:nodejs /app/dist ./dist
COPY --from=builder --chown=docuvalle:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=docuvalle:nodejs /app/package.json ./package.json

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=8080

# Exponer puerto
EXPOSE 8080

# Health check - CORREGIDO para usar tu endpoint /api/health
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Comando para ejecutar la aplicación - CORREGIDO para usar server.js
CMD ["node", "dist/server.js"]

# Metadata del contenedor
LABEL maintainer="DocuValle Team"
LABEL version="1.0"
LABEL description="Backend API para verificación de documentos con Google Cloud Vision"