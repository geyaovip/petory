FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm ci

COPY server/ ./
COPY brand/generated /tmp/brand-generated
RUN cp /tmp/brand-generated/logo.png public/logo.png \
  && cp /tmp/brand-generated/favicon-16.png public/favicon-16.png \
  && cp /tmp/brand-generated/favicon-32.png public/favicon-32.png \
  && cp /tmp/brand-generated/favicon-48.png public/favicon-48.png \
  && cp /tmp/brand-generated/favicon.png public/favicon.png \
  && cp /tmp/brand-generated/apple-touch-icon.png public/apple-touch-icon.png
COPY src/shared /app/src/shared

EXPOSE 8787

CMD ["sh", "-c", "npx prisma db push && npm start"]
