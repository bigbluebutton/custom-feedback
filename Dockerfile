# Etapa 1: Build do Frontend
FROM node:22-alpine AS build-frontend

# Defina o diretório de trabalho
WORKDIR /usr/src/app/frontend

# Copie os arquivos package.json e package-lock.json para a instalação das dependências
COPY frontend/package*.json ./

# Instale as dependências do frontend
RUN npm install

# Copie todos os arquivos do projeto para o diretório de trabalho
COPY frontend/ .

# Construa a aplicação para produção
RUN npm run build

# Etapa 2: Configuração do Backend
FROM node:22-alpine AS build-backend

# Defina o diretório de trabalho
WORKDIR /usr/src/app/backend

# Copie os arquivos package.json e package-lock.json para a instalação das dependências
COPY backend/package*.json ./

# Instale as dependências do backend
RUN npm install

# Copie todos os arquivos do projeto para o diretório de trabalho
COPY backend/ .

# Copie os arquivos buildados do frontend para um diretório temporário
COPY --from=build-frontend /usr/src/app/frontend/build /app/built-assets

# Exponha a porta em que a aplicação será executada
EXPOSE 3009

# Copie o entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Use o entrypoint script para copiar os assets e iniciar o servidor
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
