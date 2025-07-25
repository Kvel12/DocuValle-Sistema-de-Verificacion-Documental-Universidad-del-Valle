# Dockerfile corregido para DocuValle Backend con soporte bcrypt
FROM node:18-slim AS builder

# Instalar dependencias necesarias para compilación nativa
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias (esto compilará bcrypt nativamente)
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Verificar que la compilación funcionó
RUN ls -la dist/

# Limpiar dependencias de desarrollo pero mantener las necesarias para bcrypt
RUN npm prune --production

# ETAPA DE PRODUCCIÓN
FROM node:18-slim

# Crear usuario no-root
RUN groupadd -r nodejs && useradd -r -g nodejs docuvalle

# Instalar dependencias de runtime necesarias para bcrypt
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

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
LABEL version="2.0"
