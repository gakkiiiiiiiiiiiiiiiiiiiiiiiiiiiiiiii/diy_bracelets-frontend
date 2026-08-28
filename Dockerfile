FROM node:24.4.1-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE
ARG VITE_STATIC_BASE=
ARG VITE_DESIGN_PROCESS_VIDEO_ENABLED=false

RUN node -e "const value=process.env.VITE_API_BASE||'';let url;try{url=new URL(value)}catch{};if(!url||url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('VITE_API_BASE must be a clean HTTPS URL')"
RUN npm install --global pnpm@10.17.0 --ignore-scripts
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV VITE_USE_MOCK_API=false
RUN pnpm build:h5

FROM nginx:1.28.0-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /app/dist/build/h5 /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
