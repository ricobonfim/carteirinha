FROM node:20-slim

RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 3100

CMD ["node", "server.js"]
