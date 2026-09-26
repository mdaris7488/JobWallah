FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
# Tip: run `npm install` once locally to generate package-lock.json, then switch this to `npm ci --omit=dev`
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
RUN chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "src/server.js"]
