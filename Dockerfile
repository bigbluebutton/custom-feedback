FROM node:22-alpine AS build-frontend

WORKDIR /usr/src/app/frontend

COPY frontend/package*.json ./

RUN npm install

COPY frontend/ .

RUN npm run build

FROM node:22-alpine AS build-backend

WORKDIR /usr/src/app/backend

COPY backend/package*.json ./

RUN npm install

COPY backend/ .

COPY --from=build-frontend /usr/src/app/frontend/build /app/built-assets

EXPOSE 3009

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
