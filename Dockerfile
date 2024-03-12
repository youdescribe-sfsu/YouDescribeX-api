# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

RUN ls -la
# Copy the rest of the application code

COPY . .

ARG GOOGLE_CRED_FILE
ARG GOOGLE_APPLICATION_CREDENTIALS

ENV GOOGLE_CRED_FILE=${GOOGLE_CRED_FILE}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}

# Install the application dependencies
RUN npm install
RUN touch "/app/${GOOGLE_APPLICATION_CREDENTIALS}"
RUN echo "$GOOGLE_CRED_FILE" | base64 -d -i - > "/app/$GOOGLE_APPLICATION_CREDENTIALS"
# ADD "./${GOOGLE_APPLICATION_CREDENTIALS}" ${GOOGLE_APPLICATION_CREDENTIALS}
# Build the application
RUN npm run build

# Remove the development dependencies
RUN npm prune --production

RUN ls -la

# Install curl
RUN apk --no-cache add curl

# Install sudo
RUN apk --no-cache add sudo

RUN apk add --no-cache bash curl && curl -1sLf \
'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.alpine.sh' | bash \
&& apk add infisical

ARG APP_PORT
ENV APP_PORT=${APP_PORT}
ARG GPU_PIPELINE_PORT
ENV GPU_PIPELINE_PORT=${GPU_PIPELINE_PORT}

# Expose the specified port
EXPOSE ${GPU_PIPELINE_PORT}
EXPOSE ${APP_PORT}
RUN chmod +x ./dist/server.js

# Start the application
CMD [ "infisical", "run", "--","node", "./dist/server.js" ]

