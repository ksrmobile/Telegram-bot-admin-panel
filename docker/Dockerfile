FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm install --production=false

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && node node_modules/next/dist/bin/next start -p 3000"]

