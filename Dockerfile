# 使用.NET 8 SDK构建
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 复制项目文件并还原依赖
COPY WebRTCApp.csproj .
RUN dotnet restore

# 复制所有源代码
COPY . .

# 发布应用（指定项目文件）
RUN dotnet publish WebRTCApp.csproj -c Release -o /app/publish

# 使用.NET 8运行时
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# 复制发布的文件
COPY --from=build /app/publish .

# 创建证书目录
RUN mkdir -p /app/certs

# 暴露端口
EXPOSE 8096

# 设置环境变量
ENV ASPNETCORE_URLS=https://+:8096
ENV ASPNETCORE_ENVIRONMENT=Production
ENV CertPath=/app/certs

# 启动应用
ENTRYPOINT ["dotnet", "WebRTCApp.dll"]
