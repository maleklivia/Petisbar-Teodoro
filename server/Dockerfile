FROM node:22-alpine AS dependencies
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S petisbar && adduser -S petisbar -G petisbar
COPY --from=dependencies /app/node_modules ./node_modules
COPY server/package*.json ./
COPY server/src ./src
COPY server/scripts ./scripts
COPY database /database
USER petisbar
EXPOSE 3000
CMD ["node", "src/server.js"]
