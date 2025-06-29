# Dockerfile simplificado para DocuValle Backend
FROM node:18-alpine AS builder

# Instalar dependencias necesarias
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Verificar que la compilación funcionó
RUN ls -la dist/

# Limpiar dependencias de desarrollo
RUN npm prune --production

# ETAPA DE PRODUCCIÓN
FROM node:18-alpine

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && adduser -S docuvalle -u 1001

# Instalar curl para health checks
RUN apk add --no-cache curl

WORKDIR /app

# Cambiar propietario
RUN chown -R docuvalle:nodejs /app
USER docuvalle

# Copiar archivos desde builder
COPY --from=builder --chown=docuvalle:nodejs /app/dist ./dist
COPY --from=builder --chown=docuvalle:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=docuvalle:nodejs /app/package.json ./package.json

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check simple
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Comando de inicio
CMD ["node", "dist/src/server.js"]

LABEL maintainer="DocuValle Team"
LABEL version="1.0"