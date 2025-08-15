FROM node:24-alpine 

LABEL Authors="kuya-carlo, MiyanoShiho21, donutellah, adr1el-m" \
  Maintainer="kuya-carlo, MiyanoShiho21, donutellah, adr1el-m" \
  Name=docq

ENV VITE_FIREBASE_API_KEY=qwertyuiopasdfghjklzxcvbnm \
  VITE_FIREBASE_AUTH_DOMAIN=testapp.firebaseapp.com \
  VITE_FIREBASE_PROJECT_ID=testapp \
  VITE_FIREBASE_STORAGE_BUCKET=testapp.firebasestorage.app \
  VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890 \
  VITE_FIREBASE_APP_ID=1:234567890:web:1234567890 \
  VITE_FIREBASE_MEASUREMENT_ID=G-P134567890

WORKDIR /

COPY . .

RUN npm install

RUN npm build

EXPOSE 5173

ENTRYPOINT [ "npm", "run", "start" ]