FROM node:18.20.4

# 安裝OpenJDK來執行Java應用
RUN apt-get update && \
    apt-get clean;
    
# 創建應用目錄
WORKDIR /usr/src/app

# 將所有檔案複製到容器中
COPY . .

RUN npm install
RUN apt-get install firejail -y

EXPOSE 3000

CMD ["npm", "start"]
