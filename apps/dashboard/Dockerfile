FROM node:20-bookworm-slim AS build
WORKDIR /workspace/apps/dashboard
COPY apps/dashboard/package.json apps/dashboard/package-lock.json ./
RUN npm ci
COPY apps/dashboard ./
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /workspace/apps/dashboard
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /workspace/apps/dashboard/node_modules ./node_modules
COPY --from=build /workspace/apps/dashboard/.next ./.next
COPY --from=build /workspace/apps/dashboard/public ./public
COPY --from=build /workspace/apps/dashboard/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
