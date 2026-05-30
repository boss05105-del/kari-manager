FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN npm install --prefix backend

COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend

COPY . .
RUN npm run build --prefix frontend

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "backend/server.js"]
