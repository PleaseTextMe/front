from node:20-alpine

workdir /app

copy package.json package-lock.json ./
run npm install

copy . .

expose 5173

cmd ["npm", "run", "dev", "--", "--host"]
