FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
RUN npx prisma generate
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
