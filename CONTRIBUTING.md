# 🤝 贡献指南

感谢你考虑为 WebRTC 多人会议系统做出贡献! 这份文档将指导你如何参与项目开发。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [测试要求](#测试要求)

## 🌟 行为准则

### 我们的承诺

为了营造开放和友好的环境,我们承诺:

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同情

### 不可接受的行为

- 使用性化的语言或图像
- 挑衅、侮辱或贬损性评论
- 公开或私下骚扰
- 未经明确许可发布他人的私人信息
- 其他在专业环境中可能被认为不适当的行为

## 🚀 如何贡献

### 报告 Bug

如果你发现了 bug,请:

1. **检查现有 Issues** - 确保该 bug 尚未被报告
2. **创建新 Issue** - 使用 Bug 报告模板
3. **提供详细信息**:
   - 清晰的标题和描述
   - 复现步骤
   - 期望行为 vs 实际行为
   - 环境信息 (浏览器、OS、.NET 版本)
   - 截图或错误日志

### 提出功能请求

如果你有新功能的想法:

1. **检查路线图** - 查看功能是否已在计划中
2. **创建 Feature Request** - 使用功能请求模板
3. **描述清楚**:
   - 功能的目的和用例
   - 建议的实现方式
   - 可能的替代方案
   - UI/UX 设计建议 (如果适用)

### 提交 Pull Request

我们欢迎代码贡献! 请遵循以下步骤:

1. **Fork 仓库**
2. **创建分支** - 从 `main` 创建功能分支
3. **编写代码** - 遵循代码规范
4. **编写测试** - 确保测试覆盖
5. **提交代码** - 遵循提交规范
6. **创建 PR** - 使用 PR 模板

## 💻 开发流程

### 1. Fork 和 Clone

```bash
# Fork 项目到你的账户
# 然后 clone 到本地

git clone git@github.com:YOUR_USERNAME/WebRTC-MultiParty-Conference.git
cd WebRTC-MultiParty-Conference

# 添加上游仓库
git remote add upstream git@github.com:qsswgl/WebRTC-MultiParty-Conference.git
```

### 2. 创建分支

```bash
# 创建功能分支
git checkout -b feature/your-feature-name

# 或者修复 bug
git checkout -b fix/bug-description
```

### 3. 设置开发环境

```bash
# 安装 .NET 8 SDK
# https://dotnet.microsoft.com/download/dotnet/8.0

# 还原依赖
dotnet restore

# 运行项目
dotnet run

# 访问 http://localhost:8096
```

### 4. 进行更改

- 编写清晰、可维护的代码
- 添加必要的注释
- 更新相关文档
- 编写或更新测试

### 5. 测试更改

```bash
# 运行项目测试
dotnet test

# 手动测试
# - 测试多人会议功能
# - 测试视频/音频切换
# - 测试不同浏览器
# - 测试移动端
```

### 6. 提交更改

```bash
# 添加更改
git add .

# 提交 (遵循提交规范)
git commit -m "feat: add screen sharing feature"

# 推送到你的 fork
git push origin feature/your-feature-name
```

### 7. 创建 Pull Request

1. 访问你的 fork 页面
2. 点击 "Pull Request" 按钮
3. 填写 PR 模板
4. 提交等待审核

## 📝 代码规范

### C# 后端代码

```csharp
// 使用 PascalCase 命名类和方法
public class WebRTCHub : Hub
{
    // 使用 camelCase 命名私有字段
    private readonly RoomManager _roomManager;
    
    // 使用 async/await 处理异步操作
    public async Task<string> CreateRoom(string userId)
    {
        // 添加适当的错误处理
        try
        {
            // 方法实现
        }
        catch (Exception ex)
        {
            // 记录错误
            throw;
        }
    }
    
    // 添加 XML 文档注释
    /// <summary>
    /// 创建新的聊天室
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>房间ID</returns>
}
```

### JavaScript 前端代码

```javascript
// 使用 camelCase 命名变量和函数
class WebRTCClient {
    constructor(serverUrl) {
        // 使用 const/let 而不是 var
        this.connection = null;
        this.peerConnections = new Map();
    }
    
    // 使用箭头函数保持 this 上下文
    createPeerConnection(userId, isInitiator) {
        const pc = new RTCPeerConnection(this.rtcConfig);
        
        // 添加事件处理
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendIceCandidate(userId, event.candidate);
            }
        };
        
        return pc;
    }
    
    // 使用 async/await 处理 Promise
    async startCall() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            // 处理 stream
        } catch (error) {
            console.error('获取媒体失败:', error);
            throw error;
        }
    }
}
```

### HTML/CSS 规范

```html
<!-- 使用语义化 HTML -->
<section class="meeting-container">
    <header class="meeting-header">
        <h1>多人会议</h1>
    </header>
    
    <div class="video-grid">
        <!-- 视频元素 -->
    </div>
    
    <footer class="controls">
        <!-- 控制按钮 -->
    </footer>
</section>
```

```css
/* 使用 BEM 命名规范 */
.meeting-container {
    display: flex;
    flex-direction: column;
}

.meeting-header {
    padding: 1rem;
}

.meeting-header__title {
    font-size: 1.5rem;
    font-weight: bold;
}

/* 使用 CSS 变量 */
:root {
    --primary-color: #007bff;
    --secondary-color: #6c757d;
}
```

## 📜 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

### 提交类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式化 (不影响代码运行)
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建或辅助工具更改
- `ci`: CI/CD 相关

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 示例

```bash
# 新功能
git commit -m "feat(video): add screen sharing support"

# Bug 修复
git commit -m "fix(audio): resolve echo cancellation issue"

# 文档更新
git commit -m "docs(readme): update installation instructions"

# 破坏性更改
git commit -m "feat(api)!: change SignalR hub method signatures

BREAKING CHANGE: Updated CreateRoom method to accept additional parameters"
```

## ✅ 测试要求

### 单元测试

```csharp
// 为新功能编写单元测试
[Test]
public void RoomManager_CreateRoom_ReturnsValidRoomId()
{
    // Arrange
    var roomManager = new RoomManager();
    
    // Act
    var roomId = roomManager.CreateRoom("user123", "conn123");
    
    // Assert
    Assert.IsNotNull(roomId);
    Assert.AreEqual(8, roomId.Length);
}
```

### 集成测试

- 测试 SignalR Hub 方法
- 测试 WebRTC 连接建立
- 测试多用户场景

### 手动测试清单

- [ ] 创建会议功能正常
- [ ] 多人加入功能正常
- [ ] 音频通话质量良好
- [ ] 视频切换功能正常
- [ ] 用户列表更新正确
- [ ] 离开会议功能正常
- [ ] 在不同浏览器测试 (Chrome, Firefox, Safari, Edge)
- [ ] 在移动设备测试
- [ ] 在微信内测试

## 🔍 代码审查流程

### 审查重点

1. **功能完整性** - 是否实现了预期功能
2. **代码质量** - 是否遵循代码规范
3. **测试覆盖** - 是否有足够的测试
4. **性能影响** - 是否影响性能
5. **文档更新** - 是否更新了文档
6. **向后兼容** - 是否破坏现有功能

### 审查者职责

- 在 2-3 个工作日内审查 PR
- 提供建设性的反馈
- 测试 PR 中的更改
- 批准或请求更改

### 贡献者职责

- 响应审查意见
- 进行必要的修改
- 保持 PR 更新
- 确保 CI/CD 通过

## 📚 其他资源

### 文档

- [README](README.md) - 项目概览
- [使用指南](使用指南.md) - 详细使用说明
- [多人会议功能说明](多人会议功能说明.md) - 架构说明

### 技术文档

- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [SignalR 文档](https://docs.microsoft.com/aspnet/core/signalr/)
- [.NET 8 文档](https://docs.microsoft.com/dotnet/)

### 社区

- GitHub Issues - 问题讨论
- Pull Requests - 代码审查

## 💡 贡献想法

不知道从哪里开始? 这里有一些建议:

### 初学者友好

- [ ] 改进文档
- [ ] 修复拼写错误
- [ ] 添加代码注释
- [ ] 改进错误消息
- [ ] 添加单元测试

### 中等难度

- [ ] 优化 UI/UX
- [ ] 添加新的音频效果
- [ ] 改进错误处理
- [ ] 性能优化
- [ ] 添加国际化支持

### 高级功能

- [ ] 实现屏幕共享
- [ ] 添加聊天功能
- [ ] 实现会议录制
- [ ] 升级到 SFU 架构
- [ ] 开发移动端 App

## 🎉 感谢你的贡献!

每一个贡献,无论大小,都对项目有价值。我们感谢你花时间让这个项目变得更好!

---

**问题?** 随时创建 Issue 或在讨论区提问。

**需要帮助?** 查看现有的 Issues 或联系维护者。
