FROM node:20-bookworm-slim AS build
WORKDIR /workspace/services/control-plane
COPY services/control-plane/package.json services/control-plane/package-lock.json ./
RUN npm ci
COPY packages /workspace/packages
COPY services/control-plane /workspace/services/control-plane
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/services/control-plane
ENV NODE_ENV=production PORT=4100 HOST=0.0.0.0
COPY --from=build /workspace/services/control-plane/node_modules ./node_modules
COPY --from=build /workspace/services/control-plane/dist ./dist
EXPOSE 4100
CMD ["node", "dist/services/control-plane/src/server.js"]
