# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

ARG GOOGLE_CRED_FILE
ARG GOOGLE_APPLICATION_CREDENTIALS

ENV GOOGLE_CRED_FILE=${GOOGLE_CRED_FILE}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
RUN echo "GOOGLE_CRED_FILE=$GOOGLE_CRED_FILE"
RUN echo "GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS"


# Copy the rest of the application code
COPY . .

# Install the application dependencies
RUN npm install

RUN echo "$GOOGLE_CRED_FILE" | base64 -d -i - > tts_api_key.json


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
