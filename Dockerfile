FROM node:22-slim

WORKDIR /app

# 시스템 의존성 (Playwright 등)
RUN apt-get update && apt-get install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
  libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
  libcups2 libpango-1.0-0 libcairo2 libatspi2.0-0 libglib2.0-0 \
  libdbus-1-3 libexpat1 libnspr4 libatomic1 \
  && rm -rf /var/lib/apt/lists/*

# package.json 복사 + 의존성 설치
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm install --omit=dev || npm install

# 소스 복사 + 빌드
COPY . .

RUN npm run build || true
RUN mkdir -p server/public/docs && cp docs/*.html server/public/docs/ || true

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
