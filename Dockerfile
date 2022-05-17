FROM node:14

WORKDIR /home
COPY ./ ./

RUN apt-get update && \
    apt-get install -y vim && \
    apt-get clean;

RUN npm install

EXPOSE 4000
CMD [ "node", "server.js" ]
