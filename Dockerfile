FROM node:14

WORKDIR /home/ydx
COPY ./ ./
COPY /creds/* ./

RUN npm install

EXPOSE 4000
CMD [ "node", "server.js" ]
