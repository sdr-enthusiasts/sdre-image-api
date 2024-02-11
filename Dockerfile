FROM node:21-bookworm-slim

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

# hadolint ignore=DL3008,DL3003,SC1091
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/app

COPY package*.json ./
COPY --chown=node:node . .
USER node
RUN npm install && \
    npx prisma generate && \
    npm run build && \
    npm prune --production && \
    rm -rf src

ENV NODE_ENV=production \
    PORT=3000
CMD [ "npm", "run", "start"]
