FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p /app/uploads && chmod 755 /app/uploads

ENV PORT=3300
ENV DB_HOST=db

EXPOSE 3300

CMD ["node", "index.js"]
