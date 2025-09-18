FROM node:20-alpine3.18 AS builder

WORKDIR /app

# RUN corepack enable && corepack prepare pnpm@latest --activate
RUN corepack enable && corepack prepare pnpm@8.9.0 --activate
ENV PNPM_HOME=/usr/local/bin

COPY rollup.config.js tsconfig.json package.json pnpm-lock.yaml ./
COPY src ./src
COPY assets ./assets

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
    && apk add --no-cache git

RUN pnpm install
RUN echo "La variable de entorno es: "
RUN ls -l /app/src || echo "No existe /app/src"
RUN find /app/src -name "*.ts"

RUN pnpm run build \
    && apk del .gyp


FROM node:20-alpine3.18 AS deploy

WORKDIR /app

ARG PORT
ENV PORT=$PORT
EXPOSE $PORT

COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/rollup.config.js /app/package.json /app/pnpm-lock.yaml /app/tsconfig.json ./

RUN corepack enable && corepack prepare pnpm@8.9.0 --activate 
ENV PNPM_HOME=/usr/local/bin

RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

CMD ["node", "dist/app.js"]