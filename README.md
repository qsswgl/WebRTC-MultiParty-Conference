# WebRTC 实时音频通信应用

基于 **WebRTC + .NET 8 SignalR** 技术栈的实时音频通信应用。

## 功能特性

- ✅ 创建和加入聊天室
- ✅ 实时音频通话
- ✅ **增强回声消除优化**
- ✅ 噪声抑制
- ✅ 自动增益控制
- ✅ 低延迟优化
- ✅ 支持移动端微信访问
- ✅ 基于SignalR的稳定信令通道

## 技术栈

- **前端**: WebRTC API, HTML5, CSS3, JavaScript, SignalR Client
- **后端**: .NET 8 + ASP.NET Core + SignalR
- **部署**: Docker + HTTPS
- **证书**: 自动获取qsgl.net泛域名证书

## 快速开始

### 本地开发

```powershell
# 恢复依赖
dotnet restore

# 运行应用
dotnet run

# 访问 https://localhost:8096
```

### Docker部署

```powershell
# 构建镜像
docker-compose build

# 运行容器
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 部署到生产环境

使用提供的部署脚本自动部署到 tx.qsgl.net 服务器：

```powershell
# Windows PowerShell
.\scripts\Deploy.ps1
```

部署脚本会自动完成以下操作：
1. 从API获取SSL证书
2. 准备并打包项目文件
3. 通过SSH上传到服务器
4. 在服务器上构建和启动Docker容器

服务将在 **https://tx.qsgl.net:8096** 上提供访问。

## 单独获取证书

如果只需要获取证书：

```powershell
.\scripts\Get-Certificate.ps1
```

证书将保存到 `.\certs\` 目录。

## 使用说明

1. 访问首页创建聊天室
2. 复制并分享聊天室链接给客户（支持微信）
3. 客户通过微信点击链接即可加入语音通话
4. 支持静音/取消静音功能
5. 显示实时音频电平

## 音频优化配置

应用已启用以下WebRTC音频优化参数：

| 参数 | 说明 | 效果 |
|------|------|------|
| `echoCancellation` | 标准回声消除 | 消除扬声器反馈 |
| `googEchoCancellation2` | Google增强回声消除 | 更强的回声抑制 |
| `noiseSuppression` | 标准噪声抑制 | 减少背景噪音 |
| `googNoiseSuppression2` | Google增强噪声抑制 | 更强的噪音过滤 |
| `autoGainControl` | 自动增益控制 | 自动调整音量 |
| `googAutoGainControl2` | Google增强增益控制 | 更平滑的音量调节 |
| `googHighpassFilter` | 高通滤波器 | 过滤低频噪声 |
| `googTypingNoiseDetection` | 打字噪声检测 | 抑制键盘声音 |
| `latency: 0` | 低延迟模式 | 减少传输延迟 |
| `sampleRate: 48000` | 48kHz采样率 | 高质量音频 |

## 项目结构

```
WebRTC/
├── Program.cs                  # ASP.NET Core入口
├── WebRTCApp.csproj           # 项目文件
├── appsettings.json           # 配置文件
├── Hubs/
│   └── WebRTCHub.cs           # SignalR Hub
├── Services/
│   └── RoomManager.cs         # 房间管理服务
├── wwwroot/                   # 静态文件
│   ├── index.html             # 主页面
│   ├── app.js                 # SignalR客户端
│   └── styles.css             # 样式
├── scripts/
│   ├── Get-Certificate.ps1    # 证书获取脚本
│   └── Deploy.ps1             # 部署脚本
├── Dockerfile                 # Docker镜像定义
├── docker-compose.yml         # Docker编排
└── README.md                  # 本文档
```

## SignalR Hub 方法

### 客户端调用的方法

- `CreateRoom(userId)` - 创建聊天室
- `JoinRoom(roomId, userId)` - 加入聊天室
- `SendOffer(targetUserId, offer)` - 发送WebRTC Offer
- `SendAnswer(targetUserId, answer)` - 发送WebRTC Answer
- `SendIceCandidate(targetUserId, candidate)` - 发送ICE候选
- `LeaveRoom()` - 离开聊天室

### 服务端推送的事件

- `UserJoined` - 用户加入通知
- `ReceiveOffer` - 接收Offer
- `ReceiveAnswer` - 接收Answer
- `ReceiveIceCandidate` - 接收ICE候选
- `UserLeft` - 用户离开通知

## 管理命令

```powershell
# 查看容器日志
ssh -i C:\Key\tx.qsgl.net_id_ed25519 root@tx.qsgl.net 'docker-compose -f /opt/webrtc-app/docker-compose.yml logs -f'

# 重启服务
ssh -i C:\Key\tx.qsgl.net_id_ed25519 root@tx.qsgl.net 'docker-compose -f /opt/webrtc-app/docker-compose.yml restart'

# 停止服务
ssh -i C:\Key\tx.qsgl.net_id_ed25519 root@tx.qsgl.net 'docker-compose -f /opt/webrtc-app/docker-compose.yml down'

# 查看容器状态
ssh -i C:\Key\tx.qsgl.net_id_ed25519 root@tx.qsgl.net 'docker ps'
```

## 故障排除

### 麦克风权限问题
- 确保浏览器允许麦克风访问
- HTTPS是必须的（HTTP无法访问麦克风）
- 微信内需要用户手动授权

### 连接失败
- 检查防火墙是否开放8096端口
- 确认HTTPS证书是否有效
- 查看浏览器控制台错误信息

### 音频质量问题
- 检查网络延迟和带宽
- 确认麦克风和扬声器设备正常
- 尝试调整音频约束参数

## 技术支持

- WebRTC官方文档: https://webrtc.org/
- SignalR文档: https://learn.microsoft.com/aspnet/core/signalr/
- .NET 8文档: https://learn.microsoft.com/dotnet/

## 许可

MIT License
