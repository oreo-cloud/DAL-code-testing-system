FROM ubuntu:18.04

# 安裝OpenJDK來執行Java應用
RUN apt-get update && \
    apt-get install -y bash

RUN mkdir -p /ExeFile
    
# 創建應用目錄
WORKDIR /ExeFile

CMD ["bash"]
