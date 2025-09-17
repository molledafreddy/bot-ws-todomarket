# # Image size ~ 400MB
# FROM node:21-alpine3.18 as builder

# WORKDIR /app

# RUN corepack enable && corepack prepare pnpm@latest --activate
# ENV PNPM_HOME=/usr/local/bin

# COPY . .

# COPY package*.json *-lock.yaml ./

# RUN apk add --no-cache --virtual .gyp \
#         python3 \
#         make \
#         g++ \
#     && apk add --no-cache git \
#     && pnpm install && pnpm run build \
#     && apk del .gyp

# FROM node:21-alpine3.18 as deploy

# WORKDIR /app

# ARG PORT
# ENV PORT $PORT
# EXPOSE $PORT

# COPY --from=builder /app/assets ./assets
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/*.json /app/*-lock.yaml ./

# RUN corepack enable && corepack prepare pnpm@latest --activate 
# ENV PNPM_HOME=/usr/local/bin

# RUN npm cache clean --force && pnpm install --production --ignore-scripts \
#     && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
#     && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

# CMD ["pnpm", "start"]





FROM node:21-alpine3.18 as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Copia solo package.json y pnpm-lock.yaml primero
# COPY package.json pnpm-lock.yaml ./
COPY package*.json *-lock.yaml ./
# Instala git antes de instalar dependencias
RUN apk add --no-cache git

# Instala TODAS las dependencias (incluyendo devDependencies)
# RUN pnpm install
RUN npm install -g typescript && npm install

# Ahora copia el resto del código
COPY . .
RUN tsc 

# Ejecuta el build (rimraf estará disponible)
RUN pnpm run build

FROM node:21-alpine3.18 as deploy

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Solo instala dependencias de producción en la etapa final
RUN pnpm install --production --ignore-scripts

CMD ["pnpm", "start"]