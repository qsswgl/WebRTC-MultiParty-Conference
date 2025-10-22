// WebRTC + SignalR 客户端
class WebRTCClient {
    constructor() {
        this.connection = null;
        this.peerConnection = null;
        this.localStream = null;
        this.roomId = null;
        this.userId = this.generateUserId();
        this.remoteUserId = null;
        this.isMuted = false;
        this.isCreator = false;
        this.isVideoEnabled = false;
        
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
                echoCancellation: true,           // 回声消除
                noiseSuppression: true,            // 噪声抑制
                autoGainControl: true,             // 自动增益控制
                sampleRate: 48000,                 // 采样率 48kHz
                channelCount: 1,                   // 单声道
                latency: 0,                        // 低延迟模式
                googEchoCancellation: true,        // Google回声消除
                googAutoGainControl: true,         // Google自动增益
                googNoiseSuppression: true,        // Google噪声抑制
                googHighpassFilter: true,          // 高通滤波器
                googTypingNoiseDetection: true,    // 打字噪声检测
                googEchoCancellation2: true,       // 增强回声消除
                googAutoGainControl2: true,        // 增强自动增益
                googNoiseSuppression2: true        // 增强噪声抑制
            },
            video: false  // 默认仅音频
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
        await this.connectSignalR();
        this.setupEventListeners();
        this.checkUrlParams();
    }
    
    async connectSignalR() {
        // 创建SignalR连接
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/webrtc")
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();
        
        // 设置SignalR事件处理
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
            this.remoteUserId = data.userId;
            this.updateConnectionStatus('正在建立连接...', false);
            
            // 如果是创建者，发起呼叫
            if (this.isCreator) {
                await this.createOffer();
            }
        });
        
        // 收到Offer
        this.connection.on("ReceiveOffer", async (data) => {
            console.log('收到Offer');
            this.remoteUserId = data.sender;
            await this.handleOffer(data.offer);
        });
        
        // 收到Answer
        this.connection.on("ReceiveAnswer", async (data) => {
            console.log('收到Answer');
            await this.handleAnswer(data.answer);
        });
        
        // 收到ICE候选
        this.connection.on("ReceiveIceCandidate", async (data) => {
            await this.handleIceCandidate(data.candidate);
        });
        
        // 用户离开
        this.connection.on("UserLeft", (data) => {
            console.log('用户离开:', data.userId);
            this.showToast('对方已离开', 'error');
            this.updateConnectionStatus('对方已断开', false);
            this.closePeerConnection();
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
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.createRoom();
        });
        
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            const roomId = document.getElementById('roomIdInput').value.trim();
            if (roomId) {
                this.joinRoom(roomId);
            } else {
                this.showToast('请输入房间ID', 'error');
            }
        });
        
        document.getElementById('copyRoomIdBtn').addEventListener('click', () => {
            this.copyToClipboard(this.roomId, '房间ID已复制');
        });
        
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const link = document.getElementById('shareLink').value;
            this.copyToClipboard(link, '链接已复制');
        });
        
        document.getElementById('muteBtn').addEventListener('click', () => {
            this.toggleMute();
        });
        
        document.getElementById('videoBtn').addEventListener('click', () => {
            this.toggleVideo();
        });
        
        document.getElementById('leaveBtn').addEventListener('click', () => {
            this.leaveRoom();
        });
        
        document.getElementById('roomIdInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('joinRoomBtn').click();
            }
        });
    }
    
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (roomId) {
            document.getElementById('roomIdInput').value = roomId;
            setTimeout(() => {
                this.joinRoom(roomId);
            }, 500);
        }
    }
    
    async createRoom() {
        try {
            await this.getUserMedia();
            
            const result = await this.connection.invoke("CreateRoom", this.userId);
            
            if (result.type === 'room-created') {
                this.roomId = result.roomId;
                this.isCreator = true;
                this.showRoomInterface();
                this.showToast('聊天室创建成功！', 'success');
                this.updateConnectionStatus('等待对方加入...', false);
            }
        } catch (error) {
            console.error('创建房间失败:', error);
            this.showToast('无法访问麦克风，请检查权限', 'error');
        }
    }
    
    async joinRoom(roomId) {
        try {
            await this.getUserMedia();
            
            const result = await this.connection.invoke("JoinRoom", roomId, this.userId);
            
            if (result.type === 'error') {
                this.showToast(result.message, 'error');
                return;
            }
            
            if (result.type === 'room-joined') {
                this.roomId = result.roomId;
                this.showRoomInterface();
                this.showToast('已加入聊天室', 'success');
                this.updateConnectionStatus('正在连接...', false);
            }
        } catch (error) {
            console.error('加入房间失败:', error);
            this.showToast('加入房间失败', 'error');
        }
    }
    
    async getUserMedia() {
        if (this.localStream) {
            return;
        }
        
        try {
            // 默认只获取音频
            this.localStream = await navigator.mediaDevices.getUserMedia(this.audioConstraints);
            console.log('音频流已获取，优化设置已启用');
            this.updateAudioStatus('已激活（回声消除✓）');
            this.startAudioLevelMonitoring();
            document.getElementById('muteBtn').disabled = false;
            document.getElementById('videoBtn').disabled = false;
        } catch (error) {
            console.error('获取音频流失败:', error);
            throw error;
        }
    }
    
    async toggleVideo() {
        const videoBtn = document.getElementById('videoBtn');
        const icon = videoBtn.querySelector('.icon');
        const text = videoBtn.querySelector('.text');
        const videoContainer = document.getElementById('videoContainer');
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (!this.isVideoEnabled) {
            // 开启视频
            try {
                // 停止当前流
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                }
                
                // 获取音视频流
                this.localStream = await navigator.mediaDevices.getUserMedia(this.videoConstraints);
                this.isVideoEnabled = true;
                
                // 显示本地视频
                localVideo.srcObject = this.localStream;
                videoContainer.classList.remove('hidden');
                
                // 更新按钮
                icon.textContent = '📹';
                text.textContent = '关闭视频';
                videoBtn.classList.add('active');
                
                // 如果已经在通话中，需要重新协商
                if (this.peerConnection) {
                    // 替换音视频轨道
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    
                    const senders = this.peerConnection.getSenders();
                    const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                    
                    if (audioSender) {
                        audioSender.replaceTrack(audioTrack);
                    }
                    
                    if (videoTrack) {
                        if (videoSender) {
                            videoSender.replaceTrack(videoTrack);
                        } else {
                            this.peerConnection.addTrack(videoTrack, this.localStream);
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
            
            // 更新按钮
            icon.textContent = '📹';
            text.textContent = '开启视频';
            videoBtn.classList.remove('active');
            
            // 如果在通话中，移除视频轨道
            if (this.peerConnection) {
                const senders = this.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    this.peerConnection.removeTrack(videoSender);
                }
            }
            
            this.showToast('视频已关闭', 'success');
        }
    }
    
    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        // 添加本地音频流
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
            console.log('音频轨道已添加:', track.getSettings());
        });
        
        // 处理远程音频流
        this.peerConnection.ontrack = (event) => {
            console.log('收到远程流:', event.track.kind);
            
            if (event.track.kind === 'audio') {
                const remoteAudio = document.getElementById('remoteAudio');
                remoteAudio.srcObject = event.streams[0];
            } else if (event.track.kind === 'video') {
                const remoteVideo = document.getElementById('remoteVideo');
                const videoContainer = document.getElementById('videoContainer');
                remoteVideo.srcObject = event.streams[0];
                videoContainer.classList.remove('hidden');
            }
            
            this.updateConnectionStatus('通话中', true);
            this.showToast('通话已建立', 'success');
        };
        
        // 处理ICE候选
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate && this.remoteUserId) {
                try {
                    await this.connection.invoke("SendIceCandidate", this.remoteUserId, event.candidate);
                } catch (err) {
                    console.error('发送ICE候选失败:', err);
                }
            }
        };
        
        // 连接状态监听
        this.peerConnection.onconnectionstatechange = () => {
            console.log('连接状态:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                this.updateConnectionStatus('通话中', true);
            } else if (this.peerConnection.connectionState === 'disconnected' ||
                       this.peerConnection.connectionState === 'failed') {
                this.updateConnectionStatus('连接断开', false);
            }
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE连接状态:', this.peerConnection.iceConnectionState);
        };
    }
    
    async createOffer() {
        await this.createPeerConnection();
        
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,  // 接收视频
                voiceActivityDetection: true  // 启用语音活动检测
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            await this.connection.invoke("SendOffer", this.remoteUserId, offer);
            console.log('Offer已发送');
        } catch (error) {
            console.error('创建Offer失败:', error);
        }
    }
    
    async handleOffer(offer) {
        await this.createPeerConnection();
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            await this.connection.invoke("SendAnswer", this.remoteUserId, answer);
            console.log('Answer已发送');
        } catch (error) {
            console.error('处理Offer失败:', error);
        }
    }
    
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Answer已接收');
        } catch (error) {
            console.error('处理Answer失败:', error);
        }
    }
    
    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('添加ICE候选失败:', error);
        }
    }
    
    toggleMute() {
        if (!this.localStream) return;
        
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !this.isMuted;
        });
        
        const muteBtn = document.getElementById('muteBtn');
        const icon = muteBtn.querySelector('.icon');
        const text = muteBtn.querySelector('.text');
        
        if (this.isMuted) {
            icon.textContent = '🔇';
            text.textContent = '取消静音';
            muteBtn.classList.add('active');
            this.showToast('已静音', 'success');
        } else {
            icon.textContent = '🔊';
            text.textContent = '静音';
            muteBtn.classList.remove('active');
            this.showToast('已取消静音', 'success');
        }
    }
    
    async leaveRoom() {
        try {
            if (this.connection && this.roomId) {
                await this.connection.invoke("LeaveRoom");
            }
        } catch (error) {
            console.error('离开房间失败:', error);
        }
        
        this.cleanup();
        this.hideRoomInterface();
        this.showToast('已离开聊天室', 'success');
    }
    
    cleanup() {
        this.closePeerConnection();
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.roomId = null;
        this.remoteUserId = null;
        this.isCreator = false;
        this.isMuted = false;
        this.isVideoEnabled = false;
        
        document.getElementById('muteBtn').disabled = true;
        document.getElementById('videoBtn').disabled = true;
        this.updateAudioStatus('未激活');
        
        // 隐藏视频容器
        document.getElementById('videoContainer').classList.add('hidden');
        document.getElementById('localVideo').srcObject = null;
        document.getElementById('remoteVideo').srcObject = null;
    }
    
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        const remoteAudio = document.getElementById('remoteAudio');
        remoteAudio.srcObject = null;
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
    
    updateConnectionStatus(status, isConnected) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = status;
        
        if (isConnected) {
            statusEl.classList.add('connected');
            statusEl.classList.remove('disconnected');
        } else {
            statusEl.classList.remove('connected');
            statusEl.classList.add('disconnected');
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
            navigator.clipboard.writeText(text).then(() => {
                this.showToast(message || '已复制', 'success');
            }).catch(() => {
                this.fallbackCopy(text, message);
            });
        } else {
            this.fallbackCopy(text, message);
        }
    }
    
    fallbackCopy(text, message) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast(message || '已复制', 'success');
        } catch (err) {
            this.showToast('复制失败，请手动复制', 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const client = new WebRTCClient();
    
    window.addEventListener('beforeunload', () => {
        if (client.roomId) {
            client.leaveRoom();
        }
    });
});
