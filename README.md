#  WebRTC 多人会议系统

基于 .NET 8 SignalR + WebRTC 的实时音视频多人会议系统

[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![SignalR](https://img.shields.io/badge/SignalR-8.0-512BD4)](https://docs.microsoft.com/aspnet/signalr/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-00C853)](https://webrtc.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

** 在线体验**: https://tx.qsgl.net:8096

##  功能特性

### 核心功能
-  **高质量音频通话** - 48kHz 采样率,14 参数音频优化
-  **可选视频通话** - 720p@30fps,默认纯语音模式
-  **多人会议支持** - 最多 10 人同时在线
-  **P2P 直连** - Mesh 架构,低延迟高质量
-  **微信支持** - HTTPS 安全协议,微信内可直接使用
-  **自动重连** - SignalR 断线自动重连机制

### 音频优化
-  双重回声消除 (echoCancellation + googEchoCancellation2)
-  双重噪声抑制 (noiseSuppression + googNoiseSuppression2)
-  双重自动增益 (autoGainControl + googAutoGainControl2)
-  高通滤波器 (googHighpassFilter)
-  打字噪声检测 (googTypingNoiseDetection)
-  低延迟模式 (latency: 0)

### 用户体验
-  实时用户列表显示
-  响应式视频网格布局
-  一键静音/取消静音
-  动态视频开关
-  一键复制分享链接
-  音频电平可视化

##  快速开始

### 克隆仓库

`powershell
git clone git@github.com:qsswgl/WebRTC-MultiParty-Conference.git
cd WebRTC-MultiParty-Conference
`

### 本地运行

`powershell
# 还原依赖
dotnet restore

# 运行项目
dotnet run
`

访问 http://localhost:8096

### Docker 部署

`powershell
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
`

##  使用指南

### 创建会议
1. 访问应用首页
2. 点击 **"创建聊天室"**
3. 允许浏览器麦克风权限
4. 复制生成的分享链接

### 加入会议
1. 点击分享链接
2. 允许麦克风权限
3. 自动加入会议室

### 会议功能
- **静音**: 点击麦克风按钮
- **开启视频**: 点击摄像头按钮
- **查看成员**: 在线用户列表
- **离开会议**: 点击离开房间

##  性能指标

| 参会人数 | 建议带宽 | 连接数 | CPU | 内存 |
|---------|---------|--------|-----|------|
| 2-3人 | 2 Mbps | 1-3 | 低 | 512MB |
| 4-6人 | 4 Mbps | 6-15 | 中 | 1GB |
| 7-10人 | 8 Mbps | 21-45 | 高 | 2GB |

##  架构设计

### Mesh P2P 架构
`
用户A  用户B
    ＼    
         
      ＼  
用户C

 每个用户与其他所有用户建立直接连接
 SignalR 仅用于信令交换
 音视频流完全 P2P 传输
 连接数 = N * (N-1) / 2
`

### 技术栈
- **后端**: .NET 8 + SignalR 8.0
- **前端**: WebRTC API + JavaScript
- **部署**: Docker + HTTPS

##  项目结构

`
WebRTC-MultiParty-Conference/
 Program.cs                 # 应用入口
 Hubs/
    WebRTCHub.cs          # SignalR Hub
 Services/
    RoomManager.cs        # 房间管理
 wwwroot/
    index.html            # 前端页面
    app-multiparty.js     # 多人会议逻辑
    styles.css            # 样式文件
 Dockerfile
 docker-compose.yml
 README.md
`

##  故障排查

### 无法访问麦克风/摄像头
- 使用 HTTPS (HTTP 不支持媒体设备访问)
- Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure

### 连接失败
- 检查防火墙设置
- 确认 STUN 服务器可达
- 考虑配置 TURN 服务器

### 视频不显示
- 确认双方都点击了"开启视频"
- 检查摄像头权限

##  安全说明

-  HTTPS 传输加密
-  WebRTC 端到端加密
-  不存储媒体流
-  随机房间 ID

##  扩展升级

### SFU 架构 (支持 50+ 人)
- Janus Gateway
- Mediasoup
- Kurento Media Server

##  路线图

- [x] 1对1 音频通话
- [x] 可选视频功能
- [x] 多人会议 (Mesh)
- [x] HTTPS 部署
- [x] Docker 容器化
- [ ] 屏幕共享
- [ ] 聊天消息
- [ ] 会议录制
- [ ] SFU 架构

##  联系方式

- GitHub: [@qsswgl](https://github.com/qsswgl)
- 仓库: [WebRTC-MultiParty-Conference](https://github.com/qsswgl/WebRTC-MultiParty-Conference)

---

** 如果这个项目对你有帮助,请给个 Star!**
