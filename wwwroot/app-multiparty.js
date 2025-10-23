// WebRTC 多人会议客户端
class MultiPartyWebRTCClient {
    constructor() {
        this.connection = null;
        this.peerConnections = new Map(); // userId -> RTCPeerConnection
        this.localStream = null;
        this.roomId = null;
        this.userId = this.generateUserId();
        this.isMuted = false;
        this.isCreator = false;
        this.isVideoEnabled = false;
        this.remoteUsers = new Set(); // 远程用户ID集合
        
        // WebRTC配置
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        // 音频约束 - 优化回声消除和低延迟
        this.audioConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 1,
                latency: 0,
                googEchoCancellation: true,
                googAutoGainControl: true,
                googNoiseSuppression: true,
                googHighpassFilter: true,
                googTypingNoiseDetection: true,
                googEchoCancellation2: true,
                googAutoGainControl2: true,
                googNoiseSuppression2: true
            },
            video: false
        };
        
        // 视频约束
        this.videoConstraints = {
            audio: this.audioConstraints.audio,
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        };
        
        this.init();
    }
    
    generateUserId() {
        return 'user_' + Math.random().toString(36).substring(2, 11);
    }
    
    async init() {
        console.log('初始化 WebRTC 客户端...');
        
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        console.log('DOM 已加载，设置事件监听器...');
        this.setupEventListeners();
        
        console.log('连接 SignalR...');
        await this.connectSignalR();
        
        console.log('检查 URL 参数...');
        this.checkUrlParams();
        
        console.log('初始化完成');
    }
    
    async connectSignalR() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/webrtc")
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (context) => {
                    return Math.min(1000 * Math.pow(2, context.previousRetryCount), 30000);
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();
        
        this.setupSignalRHandlers();
        
        try {
            await this.connection.start();
            console.log("SignalR已连接");
            this.showToast('已连接到服务器', 'success');
        } catch (err) {
            console.error("SignalR连接失败:", err);
            this.showToast('连接失败，请刷新页面', 'error');
        }
    }
    
    setupSignalRHandlers() {
        // 用户加入房间
        this.connection.on("UserJoined", async (data) => {
            console.log('用户加入:', data.userId);
            this.remoteUsers.add(data.userId);
            this.updateUserList();
            this.showToast(`用户 ${data.userId.substring(0, 8)} 加入房间`, 'info');
            
            // 主动向新用户发起连接
            if (!this.peerConnections.has(data.userId)) {
                await this.createPeerConnection(data.userId, true);
            }
        });
        
        // 收到Offer
        this.connection.on("ReceiveOffer", async (data) => {
            console.log('收到Offer from:', data.sender);
            if (!this.peerConnections.has(data.sender)) {
                await this.createPeerConnection(data.sender, false);
            }
            await this.handleOffer(data.sender, data.offer);
        });
        
        // 收到Answer
        this.connection.on("ReceiveAnswer", async (data) => {
            console.log('收到Answer from:', data.sender);
            await this.handleAnswer(data.sender, data.answer);
        });
        
        // 收到ICE候选
        this.connection.on("ReceiveIceCandidate", async (data) => {
            await this.handleIceCandidate(data.sender, data.candidate);
        });
        
        // 用户离开
        this.connection.on("UserLeft", (data) => {
            console.log('用户离开:', data.userId);
            this.showToast(`用户 ${data.userId.substring(0, 8)} 离开房间`, 'info');
            this.removePeerConnection(data.userId);
            this.remoteUsers.delete(data.userId);
            this.updateUserList();
        });
        
        // 重连处理
        this.connection.onreconnecting(() => {
            this.showToast('正在重新连接...', 'error');
        });
        
        this.connection.onreconnected(() => {
            this.showToast('已重新连接', 'success');
        });
        
        this.connection.onclose(() => {
            this.showToast('连接已断开', 'error');
        });
    }
    
    setupEventListeners() {
        console.log('=== 设置事件监听器 ===');
        
        const createBtn = document.getElementById('createRoomBtn');
        console.log('创建按钮元素:', createBtn);
        
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                console.log('创建聊天室按钮被点击');
                this.createRoom();
            });
            console.log('✅ 创建按钮事件已绑定');
        } else {
            console.error('❌ 找不到创建按钮元素!');
        }
        
        const joinBtn = document.getElementById('joinRoomBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                const roomId = document.getElementById('roomIdInput').value.trim();
                if (roomId) {
                    this.joinRoom(roomId);
                } else {
                    this.showToast('请输入房间号', 'error');
                }
            });
            console.log('✅ 加入按钮事件已绑定');
        } else {
            console.error('❌ 找不到加入按钮元素!');
        }
        
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });
        
        document.getElementById('muteBtn').addEventListener('click', () => {
            this.toggleMute();
        });
        
        document.getElementById('videoBtn').addEventListener('click', () => {
            this.toggleVideo();
        });
        
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const shareLink = document.getElementById('shareLink').value;
            this.copyToClipboard(shareLink, '链接已复制到剪贴板');
        });
    }
    
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('room');
        if (roomId) {
            document.getElementById('roomIdInput').value = roomId;
            setTimeout(() => this.joinRoom(roomId), 1000);
        }
    }
    
    async createRoom() {
        console.log('=== 开始创建房间 ===');
        console.log('SignalR 连接状态:', this.connection?.state);
        
        try {
            // 先创建房间，再获取媒体流
            console.log('1. 正在调用 SignalR CreateRoom...');
            const result = await this.connection.invoke("CreateRoom", this.userId);
            console.log('2. SignalR 返回结果:', result);
            
            if (result.type === 'room-created') {
                this.roomId = result.roomId;
                this.isCreator = true;
                
                console.log('3. 房间创建成功，现在获取媒体流...');
                try {
                    await this.getUserMedia();
                    console.log('4. 媒体流获取成功');
                } catch (mediaError) {
                    console.warn('媒体流获取失败，但房间已创建:', mediaError);
                    this.showToast('麦克风访问失败，但房间已创建', 'warning');
                }
                
                this.showRoomInterface();
                this.showToast('房间创建成功', 'success');
                console.log('房间创建成功:', this.roomId);
            }
        } catch (error) {
            console.error('创建房间失败:', error);
            console.error('错误堆栈:', error.stack);
            this.showToast('创建房间失败: ' + error.message, 'error');
        }
    }
    
    async joinRoom(roomId) {
        try {
            // 先加入房间，再获取媒体流
            const result = await this.connection.invoke("JoinRoom", roomId, this.userId);
            
            if (result.type === 'error') {
                this.showToast(result.message, 'error');
                return;
            }
            
            if (result.type === 'room-joined') {
                this.roomId = roomId;
                
                // 尝试获取媒体流
                try {
                    await this.getUserMedia();
                } catch (mediaError) {
                    console.warn('媒体流获取失败，但已加入房间:', mediaError);
                    this.showToast('麦克风访问失败，但已加入房间', 'warning');
                }
                
                this.showRoomInterface();
                this.showToast('已加入房间', 'success');
                console.log('加入房间成功:', roomId);
                
                // 与房间内已有成员建立连接
                if (result.members && result.members.length > 0) {
                    for (const member of result.members) {
                        this.remoteUsers.add(member.userId);
                    }
                    this.updateUserList();
                }
            }
        } catch (error) {
            console.error('加入房间失败:', error);
            this.showToast('加入房间失败', 'error');
        }
    }
    
    async getUserMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(this.audioConstraints);
            document.getElementById('localAudio').srcObject = this.localStream;
            
            document.getElementById('muteBtn').disabled = false;
            document.getElementById('videoBtn').disabled = false;
            this.updateAudioStatus('已激活');
            
            // 开始音频电平监控
            this.startAudioLevelMonitoring();
            
            console.log('本地媒体流获取成功');
        } catch (error) {
            console.error('获取媒体流失败:', error);
            this.showToast('无法访问麦克风', 'error');
            throw error;
        }
    }
    
    async toggleMute() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            
            const muteBtn = document.getElementById('muteBtn');
            const icon = muteBtn.querySelector('.icon');
            const text = muteBtn.querySelector('.text');
            
            if (this.isMuted) {
                icon.textContent = '🔇';
                text.textContent = '取消静音';
                muteBtn.classList.add('muted');
                this.showToast('已静音', 'info');
            } else {
                icon.textContent = '🎤';
                text.textContent = '静音';
                muteBtn.classList.remove('muted');
                this.showToast('取消静音', 'info');
            }
        }
    }
    
    async toggleVideo() {
        const videoBtn = document.getElementById('videoBtn');
        const icon = videoBtn.querySelector('.icon');
        const text = videoBtn.querySelector('.text');
        const videoContainer = document.getElementById('videoContainer');
        const localVideo = document.getElementById('localVideo');
        
        if (!this.isVideoEnabled) {
            // 开启视频
            try {
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                }
                
                this.localStream = await navigator.mediaDevices.getUserMedia(this.videoConstraints);
                this.isVideoEnabled = true;
                
                localVideo.srcObject = this.localStream;
                videoContainer.classList.remove('hidden');
                
                icon.textContent = '📹';
                text.textContent = '关闭视频';
                videoBtn.classList.add('active');
                
                // 替换所有 PeerConnection 的轨道
                const videoTrack = this.localStream.getVideoTracks()[0];
                const audioTrack = this.localStream.getAudioTracks()[0];
                
                for (const [userId, pc] of this.peerConnections) {
                    const senders = pc.getSenders();
                    const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                    
                    if (audioSender) {
                        audioSender.replaceTrack(audioTrack);
                    }
                    
                    if (videoTrack) {
                        if (videoSender) {
                            videoSender.replaceTrack(videoTrack);
                        } else {
                            pc.addTrack(videoTrack, this.localStream);
                        }
                    }
                }
                
                this.showToast('视频已开启', 'success');
            } catch (error) {
                console.error('开启视频失败:', error);
                this.showToast('无法访问摄像头', 'error');
            }
        } else {
            // 关闭视频
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.stop();
                this.localStream.removeTrack(track);
            });
            
            this.isVideoEnabled = false;
            videoContainer.classList.add('hidden');
            localVideo.srcObject = null;
            
            icon.textContent = '📹';
            text.textContent = '开启视频';
            videoBtn.classList.remove('active');
            
            // 移除所有 PeerConnection 的视频轨道
            for (const [userId, pc] of this.peerConnections) {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    pc.removeTrack(videoSender);
                }
            }
            
            this.showToast('视频已关闭', 'success');
        }
    }
    
    async createPeerConnection(userId, isInitiator) {
        console.log(`创建 PeerConnection: ${userId}, initiator: ${isInitiator}`);
        
        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(userId, pc);
        
        // 添加本地流
        this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream);
        });
        
        // 处理远程流
        pc.ontrack = (event) => {
            console.log(`收到远程流 from ${userId}:`, event.track.kind);
            this.handleRemoteTrack(userId, event);
        };
        
        // 处理ICE候选
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await this.connection.invoke("SendIceCandidate", userId, event.candidate);
                } catch (err) {
                    console.error('发送ICE候选失败:', err);
                }
            }
        };
        
        // 连接状态监听
        pc.onconnectionstatechange = () => {
            console.log(`PeerConnection ${userId} state:`, pc.connectionState);
            this.updateConnectionStatus();
        };
        
        // 如果是发起者,创建offer
        if (isInitiator) {
            try {
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await pc.setLocalDescription(offer);
                await this.connection.invoke("SendOffer", userId, offer);
            } catch (error) {
                console.error('创建Offer失败:', error);
            }
        }
    }
    
    async handleOffer(userId, offer) {
        try {
            const pc = this.peerConnections.get(userId);
            if (!pc) return;
            
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.connection.invoke("SendAnswer", userId, answer);
        } catch (error) {
            console.error('处理Offer失败:', error);
        }
    }
    
    async handleAnswer(userId, answer) {
        try {
            const pc = this.peerConnections.get(userId);
            if (!pc) return;
            
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('处理Answer失败:', error);
        }
    }
    
    async handleIceCandidate(userId, candidate) {
        try {
            const pc = this.peerConnections.get(userId);
            if (!pc) return;
            
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('添加ICE候选失败:', error);
        }
    }
    
    handleRemoteTrack(userId, event) {
        const stream = event.streams[0];
        const track = event.track;
        
        // 查找或创建该用户的媒体元素
        let mediaContainer = document.getElementById(`remote-${userId}`);
        
        if (!mediaContainer) {
            mediaContainer = document.createElement('div');
            mediaContainer.id = `remote-${userId}`;
            mediaContainer.className = 'remote-user';
            
            const label = document.createElement('div');
            label.className = 'user-label';
            label.textContent = userId.substring(0, 8);
            
            const audioEl = document.createElement('audio');
            audioEl.id = `audio-${userId}`;
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            
            const videoEl = document.createElement('video');
            videoEl.id = `video-${userId}`;
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = false;
            videoEl.classList.add('hidden');
            
            mediaContainer.appendChild(label);
            mediaContainer.appendChild(videoEl);
            mediaContainer.appendChild(audioEl);
            
            document.getElementById('remoteUsers').appendChild(mediaContainer);
        }
        
        const audioEl = document.getElementById(`audio-${userId}`);
        const videoEl = document.getElementById(`video-${userId}`);
        
        if (track.kind === 'audio') {
            audioEl.srcObject = stream;
        } else if (track.kind === 'video') {
            videoEl.srcObject = stream;
            videoEl.classList.remove('hidden');
        }
    }
    
    removePeerConnection(userId) {
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
        }
        
        // 移除UI元素
        const mediaContainer = document.getElementById(`remote-${userId}`);
        if (mediaContainer) {
            mediaContainer.remove();
        }
    }
    
    async leaveRoom() {
        try {
            await this.connection.invoke("LeaveRoom");
            this.cleanup();
            this.hideRoomInterface();
            this.showToast('已离开房间', 'info');
        } catch (error) {
            console.error('离开房间失败:', error);
        }
    }
    
    cleanup() {
        // 关闭所有 PeerConnection
        for (const [userId, pc] of this.peerConnections) {
            pc.close();
        }
        this.peerConnections.clear();
        
        // 停止本地流
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.roomId = null;
        this.isCreator = false;
        this.isMuted = false;
        this.isVideoEnabled = false;
        this.remoteUsers.clear();
        
        document.getElementById('muteBtn').disabled = true;
        document.getElementById('videoBtn').disabled = true;
        this.updateAudioStatus('未激活');
        
        document.getElementById('videoContainer').classList.add('hidden');
        document.getElementById('localVideo').srcObject = null;
        document.getElementById('remoteUsers').innerHTML = '';
    }
    
    showRoomInterface() {
        document.getElementById('welcomeCard').classList.add('hidden');
        document.getElementById('roomCard').classList.remove('hidden');
        
        document.getElementById('currentRoomId').textContent = this.roomId;
        
        const shareLink = `${window.location.origin}/?room=${this.roomId}`;
        document.getElementById('shareLink').value = shareLink;
    }
    
    hideRoomInterface() {
        document.getElementById('welcomeCard').classList.remove('hidden');
        document.getElementById('roomCard').classList.add('hidden');
        document.getElementById('roomIdInput').value = '';
    }
    
    updateConnectionStatus() {
        const connectedCount = Array.from(this.peerConnections.values())
            .filter(pc => pc.connectionState === 'connected').length;
        
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = `已连接: ${connectedCount} 人`;
        
        if (connectedCount > 0) {
            statusEl.classList.add('connected');
            statusEl.classList.remove('disconnected');
        } else {
            statusEl.classList.remove('connected');
            statusEl.classList.add('disconnected');
        }
    }
    
    updateUserList() {
        const userListEl = document.getElementById('userList');
        userListEl.innerHTML = '';
        
        // 添加自己
        const selfItem = document.createElement('div');
        selfItem.className = 'user-item self';
        selfItem.textContent = `${this.userId.substring(0, 8)} (你)`;
        userListEl.appendChild(selfItem);
        
        // 添加其他用户
        for (const userId of this.remoteUsers) {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.textContent = userId.substring(0, 8);
            userListEl.appendChild(userItem);
        }
    }
    
    updateAudioStatus(status) {
        document.getElementById('audioStatus').textContent = status;
    }
    
    startAudioLevelMonitoring() {
        if (!this.localStream) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(this.localStream);
        
        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;
        
        microphone.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const levelIndicator = document.getElementById('audioLevel');
        
        const updateLevel = () => {
            if (!this.localStream) return;
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const level = Math.min(100, (average / 128) * 100);
            
            levelIndicator.style.width = level + '%';
            
            requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
    }
    
    copyToClipboard(text, message) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showToast(message, 'success'))
                .catch(() => this.fallbackCopyToClipboard(text, message));
        } else {
            this.fallbackCopyToClipboard(text, message);
        }
    }
    
    fallbackCopyToClipboard(text, message) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast(message, 'success');
        } catch (err) {
            this.showToast('复制失败', 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.className = 'toast show ' + type;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 初始化 - 等待 DOM 加载完成
let webrtcClient = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM 已加载，创建 WebRTC 客户端');
        webrtcClient = new MultiPartyWebRTCClient();
    });
} else {
    console.log('DOM 已就绪，立即创建 WebRTC 客户端');
    webrtcClient = new MultiPartyWebRTCClient();
}
