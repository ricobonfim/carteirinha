FROM node:20-slim

# Install LibreOffice (provides the soffice binary) and fonts for proper rendering
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3100

CMD ["node", "server.js"]
