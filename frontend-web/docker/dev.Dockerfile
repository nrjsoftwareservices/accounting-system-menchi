FROM node:20-alpine

WORKDIR /app

# Install dependencies based on lockfile
COPY package*.json ./
RUN npm ci

# Copy the rest of the app (useful for initial build; bind mounts will override at runtime)
COPY . .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "run", "dev"]

