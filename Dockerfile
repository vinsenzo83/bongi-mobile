FROM node:22-slim

WORKDIR /app

# 시스템 의존성 (Playwright 등)
RUN apt-get update && apt-get install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
  libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
  libcups2 libpango-1.0-0 libcairo2 libatspi2.0-0 libglib2.0-0 \
  libdbus-1-3 libexpat1 libnspr4 libatomic1 \
  && rm -rf /var/lib/apt/lists/*

# package.json 복사 + 의존성 설치 (root + client + server, Vite 등 빌드용 devDeps 필수)
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# 소스 복사 + 빌드
COPY . .

# 빌드 실패 시 deploy 중단 (|| true 제거 — 옛날 버전이 silent 실패로 client/dist 누락됐었음)
RUN npm run build
RUN mkdir -p server/public/docs && cp docs/*.html server/public/docs/ 2>/dev/null || true
RUN ls -la client/dist/ | head -10 && echo "✅ client/dist 빌드 확인"

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
