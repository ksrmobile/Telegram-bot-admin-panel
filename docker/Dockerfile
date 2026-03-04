FROM node:20-slim

# Run the panel as root inside the container so it can
# access the Docker socket at /var/run/docker.sock without
# extra group configuration. This is acceptable for the
# intended single-tenant VPS deployment.
USER root

WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies used by the panel:
# - openssl: for HTTPS and crypto
# - git: for cloning/pulling bot repositories from the UI
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl git \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm install --production=false

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && node node_modules/next/dist/bin/next start -p 3000"]

