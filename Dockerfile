# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the rest of the application code
COPY . .

# Install the application dependencies
RUN npm install

# Build the application
RUN npm run build

# Remove the development dependencies
RUN npm prune --production

RUN ls -la

ARG APP_PORT
ENV APP_PORT=${APP_PORT}

# Expose the specified port
EXPOSE ${APP_PORT}
RUN chmod +x ./dist/server.js

# Start the application
CMD [ "node", "./dist/server.js" ]
