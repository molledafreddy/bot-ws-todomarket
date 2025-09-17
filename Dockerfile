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


# THIS IS THE BASE IMAGE FOR THE BOT
FROM node:21-alpine3.18 as builder

# Enable Corepack and prepare for PNPM installation to increase performance
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Set the working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml files to the working directory
# COPY package*.json pnpm-lock.yaml ./
COPY package*.json *-lock.yaml ./

# Install dependencies using PNPM
COPY . .
RUN pnpm i

# Create a new stage for deployment
FROM builder as deploy

# Copy only necessary files and directories for deployment
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

RUN pnpm install
CMD ["pnpm", "start"]
