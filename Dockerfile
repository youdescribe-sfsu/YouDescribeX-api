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
# RUN echo "GOOGLE_CRED_FILE=$GOOGLE_CRED_FILE"
RUN echo "GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS"

# RUN chmod +x run_build_docker.sh
# RUN ./run_build_docker.sh ${GOOGLE_CRED_FILE} ${GOOGLE_APPLICATION_CREDENTIALS}

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

ARG APP_PORT
ENV APP_PORT=${APP_PORT}
ARG GPU_HOST
ENV GPU_HOST=${GPU_HOST}

# Expose the specified port
EXPOSE ${GPU_HOST}
EXPOSE ${APP_PORT}
RUN chmod +x ./dist/server.js

# Start the application
CMD [ "node", "./dist/server.js" ]
