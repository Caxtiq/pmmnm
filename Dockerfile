FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build argument for VietMap API key
ARG NEXT_PUBLIC_VIETMAP_API_KEY
ENV NEXT_PUBLIC_VIETMAP_API_KEY=$NEXT_PUBLIC_VIETMAP_API_KEY

# Build Next.js application
RUN bun run build

# Expose ports
EXPOSE 3001 3002

# Start both Next.js and WebSocket server
CMD ["sh", "-c", "bun run start:next & bun run server.ts"]
