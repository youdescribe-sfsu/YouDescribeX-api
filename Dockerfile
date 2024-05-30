# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Display the directory contents for debugging
RUN ls -la

# Copy the rest of the application code
COPY . .

# Define build arguments
ARG GOOGLE_CRED_FILE
ARG GOOGLE_APPLICATION_CREDENTIALS
ARG CRYPTO_SEED

# Set environment variables
ENV GOOGLE_CRED_FILE=${GOOGLE_CRED_FILE}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
ENV CRYPTO_SEED=${CRYPTO_SEED}

# Debug environment variables
RUN echo "GOOGLE_CRED_FILE=$GOOGLE_CRED_FILE"
RUN echo "GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS"

# Install the application dependencies
RUN npm install

# Decode the Google credentials and write to the specified file
RUN touch "/app/${GOOGLE_APPLICATION_CREDENTIALS}"
RUN echo "$GOOGLE_CRED_FILE" | base64 -d -i - > "/app/$GOOGLE_APPLICATION_CREDENTIALS"

# Build the application
RUN npm run build

# Remove the development dependencies
RUN npm prune --production

# Display the directory contents for debugging
RUN ls -la

# Define additional ports
ARG APP_PORT
ENV APP_PORT=${APP_PORT}
ARG GPU_PIPELINE_PORT
ENV GPU_PIPELINE_PORT=${GPU_PIPELINE_PORT}

# Expose the specified ports
EXPOSE ${GPU_PIPELINE_PORT}
EXPOSE ${APP_PORT}

# Make the server script executable
RUN chmod +x ./dist/server.js

# Start the application
CMD [ "node", "./dist/server.js" ]