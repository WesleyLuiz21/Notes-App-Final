FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /data
VOLUME ["/data"]

ENV NODE_ENV=production
ENV DB_PATH=/data/app.db
ENV PORT=3001

EXPOSE 3001
CMD ["node", "src/index.js"]
