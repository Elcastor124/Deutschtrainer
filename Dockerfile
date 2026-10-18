# Imagen para Fly.io, Railway o cualquier servidor con Docker.
FROM node:22.19-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev
ENV PORT=4747 DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 4747
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
