FROM node:20-slim

# Run the panel as root inside the container so it can
# access the Docker socket at /var/run/docker.sock without
# extra group configuration. This is acceptable for the
# intended single-tenant VPS deployment.
USER root

WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies used by the panel:
# - ca-certificates: for HTTPS trust store
# - git: for cloning/pulling bot repositories from the UI
# - openssl: for HTTPS and crypto tooling
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm install --production=false

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && node node_modules/next/dist/bin/next start -p 3000"]

