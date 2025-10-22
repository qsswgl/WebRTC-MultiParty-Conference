# 🔐 安全政策

## 支持的版本

当前支持以下版本的安全更新:

| 版本 | 支持状态 |
| ------- | ------------------ |
| main (最新) | ✅ 支持 |
| < 1.0   | ❌ 不支持 |

## 报告漏洞

我们非常重视安全问题。如果你发现了安全漏洞,请**不要**公开创建 Issue。

### 如何报告

请通过以下方式私下报告:

1. **GitHub Security Advisory** (推荐)
   - 访问: https://github.com/qsswgl/WebRTC-MultiParty-Conference/security/advisories
   - 点击 "Report a vulnerability"
   - 填写详细信息

2. **邮件联系**
   - 发送邮件到项目维护者
   - 主题: [SECURITY] 安全漏洞报告
   - 包含详细的漏洞描述

### 报告内容

请在报告中包含:

- 漏洞类型 (如 XSS, CSRF, 注入等)
- 受影响的版本
- 复现步骤
- 概念验证 (PoC) 代码
- 潜在的影响
- 建议的修复方案 (如果有)

### 响应时间

- **24小时内**: 确认收到报告
- **7天内**: 评估漏洞严重程度
- **30天内**: 发布修复补丁 (视严重程度而定)

## 安全最佳实践

### 部署安全

1. **使用 HTTPS**
   ```yaml
   # docker-compose.yml
   environment:
     - ASPNETCORE_URLS=https://+:8096
   ```

2. **证书管理**
   - 使用有效的 SSL/TLS 证书
   - 定期更新证书
   - 保护私钥安全

3. **防火墙配置**
   ```bash
   # 只开放必要端口
   ufw allow 8096/tcp
   ufw enable
   ```

4. **环境变量**
   ```bash
   # 不要在代码中硬编码敏感信息
   # 使用环境变量
   export CERT_PASSWORD="your_secure_password"
   ```

### 应用安全

1. **输入验证**
   - 验证所有用户输入
   - 防止 XSS 攻击
   - 防止注入攻击

2. **房间 ID 安全**
   - 使用足够长的随机字符串
   - 不可预测性
   - 定期清理过期房间

3. **WebRTC 安全**
   - 使用加密传输 (DTLS-SRTP)
   - 验证 ICE 候选
   - 使用 TURN 服务器时启用认证

4. **SignalR 安全**
   - 使用 WSS (WebSocket Secure)
   - 实现连接限制
   - 防止 DOS 攻击

### 数据安全

1. **隐私保护**
   - 不记录音视频内容
   - 不存储用户个人信息
   - 符合 GDPR 要求

2. **日志安全**
   ```csharp
   // 不要记录敏感信息
   logger.LogInformation($"User joined room: {roomId}");
   // 避免: logger.LogInformation($"User data: {userData}");
   ```

3. **会话管理**
   - 实现超时机制
   - 清理断开连接
   - 限制并发连接数

## 已知安全限制

### P2P 架构限制

1. **IP 地址暴露**
   - Mesh 架构会暴露参会者的 IP 地址
   - 建议: 使用 TURN 服务器中继流量

2. **带宽攻击**
   - 恶意用户可能发送大量数据
   - 建议: 实现流量监控和限制

### 浏览器安全

1. **权限请求**
   - 需要用户授权访问摄像头/麦克风
   - 无法绕过浏览器安全限制

2. **同源策略**
   - 受浏览器同源策略限制
   - CORS 配置必须正确

## 安全更新日志

### 2024年

- **初始版本** - 实现基础安全措施
  - HTTPS 加密传输
  - WebRTC 端到端加密
  - 随机房间 ID 生成

## 依赖项安全

定期检查依赖项安全漏洞:

```bash
# 检查 .NET 包
dotnet list package --vulnerable

# 更新包
dotnet add package Microsoft.AspNetCore.SignalR --version [latest]
```

## 安全检查清单

部署前请确认:

- [ ] 使用 HTTPS
- [ ] SSL 证书有效
- [ ] 防火墙配置正确
- [ ] 环境变量安全设置
- [ ] 依赖项无已知漏洞
- [ ] 日志不包含敏感信息
- [ ] 实现了速率限制
- [ ] 配置了适当的 CORS
- [ ] 使用强随机数生成器
- [ ] 实现了会话超时

## 合规性

本项目致力于遵守:

- **GDPR** - 欧盟数据保护条例
- **CCPA** - 加州消费者隐私法
- **WebRTC 安全最佳实践**

## 联系方式

安全相关问题请联系:
- GitHub: [@qsswgl](https://github.com/qsswgl)
- Security Advisory: https://github.com/qsswgl/WebRTC-MultiParty-Conference/security

---

**感谢你帮助保护 WebRTC 多人会议系统的安全!** 🔒
