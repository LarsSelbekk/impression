FROM node:17-alpine3.14

WORKDIR /app

COPY . .

RUN yarn install
RUN apk add python3 py3-pip
RUN pip install wheel && pip install --ignore-installed six -r requirements.txt

CMD ["yarn", "start"]
