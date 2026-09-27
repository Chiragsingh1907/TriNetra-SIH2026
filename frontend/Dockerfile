# Build Stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package configurations and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code and build the React app via Vite
COPY . .
RUN npm run build

# Production Serving Stage
FROM nginx:alpine

# Copy the built assets from the build stage to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Provide a custom Nginx configuration to handle React Router and map port 80
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose Nginx port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
