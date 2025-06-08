# Usamos Node.js 18 como base - es estable y compatible con todas nuestras dependencias
FROM node:18-alpine

# Establecemos el directorio de trabajo dentro del contenedor
# Es como crear una carpeta dedicada para nuestro proyecto
WORKDIR /usr/src/app

# Copiamos los archivos de configuración de dependencias primero
# Esto permite que Docker cache esta capa si las dependencias no cambian
COPY package*.json ./
COPY tsconfig.json ./

# Instalamos las dependencias de producción únicamente
# --only=production reduce el tamaño del contenedor final
RUN npm ci --only=production

# Copiamos todo el código fuente de nuestro backend
COPY src/ ./src/

# Compilamos el código TypeScript a JavaScript
# Esto crea los archivos finales en la carpeta dist/
RUN npm run build

# Exponemos el puerto 8080 - es el estándar para Cloud Run
# Cloud Run siempre usa este puerto internamente
EXPOSE 8080

# Creamos un usuario no-root por seguridad
# Es una buena práctica no ejecutar aplicaciones como administrador
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Comando para iniciar nuestra aplicación
# Ejecuta el JavaScript compilado en lugar del TypeScript original
CMD ["npm", "start"]