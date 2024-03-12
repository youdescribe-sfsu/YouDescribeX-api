# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

RUN ls -la
# Copy the rest of the application code

COPY package.json /app

# Install the application dependencies
RUN npm install

# Copy the rest of the application code
COPY . /app

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

