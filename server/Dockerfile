FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm ci

COPY server/ ./
COPY src/shared /app/src/shared

EXPOSE 8787

CMD ["sh", "-c", "npx prisma db push && npm start"]
