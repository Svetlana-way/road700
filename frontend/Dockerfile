FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json tsconfig.node.json vite.config.ts index.html /app/
COPY src /app/src

RUN npm install

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

