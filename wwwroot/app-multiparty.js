// WebRTC 多人会议客户端
class MultiPartyWebRTCClient {
    constructor() {
        this.connection = null;
        this.peerConnections = new Map(); // userId -> RTCPeerConnection
        this.pendingIceCandidates = new Map(); // userId -> [candidates] - 缓存提前到达的ICE候选
        this.localStream = null;
        this.roomId = null;
        this.userId = this.generateUserId();
        this.isMuted = false;
        this.isCreator = false;
        this.isVideoEnabled = false;
        this.remoteUsers = new Set(); // 远程用户ID集合
        
        // WebRTC配置 - 使用可靠的 TURN 服务器
        this.rtcConfig = {
            iceServers: [
                // Google STUN
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                // Metered.ca TURN (免费额度)
                {
                    urls: [
                        'turn:a.relay.metered.ca:80',
                        'turn:a.relay.metered.ca:80?transport=tcp',
                        'turn:a.relay.metered.ca:443',
                        'turn:a.relay.metered.ca:443?transport=tcp'
                    ],
                    username: 'e1c0ce9dfdab18f097861f1f',
                    credential: 'sPIE/RbUXEZ7EJ1Q'
                },
                // 备用 OpenRelay TURN
                {
                    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
        
        console.log('[Config] ICE Servers配置完成, 包含', this.rtcConfig.iceServers.length, '组服务器');
        console.log('[Config] ICE Transport Policy:', this.rtcConfig.iceTransportPolicy);
        
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

        // 全局点击日志，辅助排查是否被遮挡或点击被吞
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.id) {
                console.log('[全局点击] ->', `#${target.id}`, 'tag:', target.tagName);
            }
        }, { capture: true });

        const createBtn = document.getElementById('createRoomBtn');
        console.log('创建按钮元素:', createBtn);

        if (createBtn) {
            const onCreate = (evtName) => {
                return (e) => {
                    console.log(`创建聊天室按钮事件触发: ${evtName}`);
                    // 防止重复触发
                    e.preventDefault?.();
                    e.stopPropagation?.();
                    this.showToast('正在创建聊天室...', 'info');
                    this.createRoom();
                };
            };

            // 绑定多种事件，兼容不同输入环境
            createBtn.addEventListener('click', onCreate('click'));
            createBtn.addEventListener('pointerdown', onCreate('pointerdown'));
            createBtn.addEventListener('touchend', onCreate('touchend'));
            console.log('✅ 创建按钮事件已绑定 (click/pointerdown/touchend)');
        } else {
            console.error('❌ 找不到创建按钮元素!');
        }

        const joinBtn = document.getElementById('joinRoomBtn');
        if (joinBtn) {
            const onJoin = (evtName) => {
                return (e) => {
                    console.log(`加入按钮事件触发: ${evtName}`);
                    e.preventDefault?.();
                    e.stopPropagation?.();
                    const roomId = document.getElementById('roomIdInput').value.trim();
                    if (roomId) {
                        this.joinRoom(roomId);
                    } else {
                        this.showToast('请输入房间号', 'error');
                    }
                };
            };

            joinBtn.addEventListener('click', onJoin('click'));
            joinBtn.addEventListener('pointerdown', onJoin('pointerdown'));
            joinBtn.addEventListener('touchend', onJoin('touchend'));
            console.log('✅ 加入按钮事件已绑定 (click/pointerdown/touchend)');
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
            console.log(`[joinRoom] 开始加入房间: ${roomId}`);
            
            // 先加入房间
            const result = await this.connection.invoke("JoinRoom", roomId, this.userId);
            
            if (result.type === 'error') {
                this.showToast(result.message, 'error');
                return;
            }
            
            if (result.type === 'room-joined') {
                this.roomId = roomId;
                
                // 先获取媒体流,再建立连接
                try {
                    await this.getUserMedia();
                } catch (mediaError) {
                    console.warn('媒体流获取失败，但已加入房间:', mediaError);
                    this.showToast('麦克风访问失败，但已加入房间', 'warning');
                }
                
                this.showRoomInterface();
                this.showToast('已加入房间', 'success');
                console.log('加入房间成功:', roomId, '已有成员:', result.members);
                
                // 与房间内已有成员建立连接 (必须在获取媒体流之后)
                if (result.members && result.members.length > 0 && this.localStream) {
                    console.log(`[joinRoom] 向 ${result.members.length} 个已有成员发起连接...`);
                    for (const member of result.members) {
                        this.remoteUsers.add(member.userId);
                        // 主动向已有成员发起 PeerConnection (作为发起者)
                        console.log(`[joinRoom] 向成员 ${member.userId} 发起连接`);
                        await this.createPeerConnection(member.userId, true);
                    }
                    this.updateUserList();
                } else if (result.members && result.members.length > 0 && !this.localStream) {
                    console.warn('[joinRoom] 没有本地流,无法建立 P2P 连接');
                    // 仍然添加到用户列表
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
        console.log(`[createPeerConnection] 创建连接: userId=${userId}, initiator=${isInitiator}`);
        
        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(userId, pc);
        
        // 添加本地流
        console.log(`[createPeerConnection] 添加本地轨道...`);
        this.localStream.getTracks().forEach(track => {
            console.log(`[createPeerConnection] 添加轨道: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
            pc.addTrack(track, this.localStream);
        });
        
        // 处理远程流
        pc.ontrack = (event) => {
            console.log(`[ontrack] 收到远程流 from ${userId}:`, event.track.kind);
            this.handleRemoteTrack(userId, event);
        };
        
        // 处理ICE候选
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                const candidateType = event.candidate.type || 'unknown';
                const protocol = event.candidate.protocol || '';
                const address = event.candidate.address || '';
                const port = event.candidate.port || '';
                console.log(`[ICE] 发送候选到 ${userId}: ${candidateType} (${protocol}) ${address}:${port}`);
                console.log(`[ICE] 候选详情:`, event.candidate);
                try {
                    await this.connection.invoke("SendIceCandidate", userId, event.candidate);
                } catch (err) {
                    console.error('[ICE] 发送ICE候选失败:', err);
                }
            } else {
                console.log(`[ICE] ✅ ICE收集完成: ${userId}`);
            }
        };
        
        // ICE连接状态
        pc.oniceconnectionstatechange = () => {
            console.log(`[ICE] ${userId} 连接状态: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                console.warn(`[ICE] ⚠️ ${userId} ICE连接失败,尝试重启ICE...`);
                // 尝试重启 ICE
                if (pc.restartIce) {
                    pc.restartIce();
                }
            }
        };
        
        // ICE 收集状态
        pc.onicegatheringstatechange = () => {
            console.log(`[ICE] ${userId} 收集状态: ${pc.iceGatheringState}`);
        };
        
        // 连接状态监听
        pc.onconnectionstatechange = () => {
            console.log(`[PeerConnection] ${userId} 状态: ${pc.connectionState}`);
            this.updateConnectionStatus();
        };
        
        // 如果是发起者,创建offer
        if (isInitiator) {
            try {
                console.log(`[Offer] 作为发起者创建 Offer 给 ${userId}`);
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                console.log(`[Offer] SDP类型: ${offer.type}, 包含音频: ${offer.sdp.includes('m=audio')}, 包含视频: ${offer.sdp.includes('m=video')}`);
                await pc.setLocalDescription(offer);
                console.log(`[Offer] 本地描述已设置`);
                console.log(`[Offer] 发送 Offer 到 ${userId}`);
                await this.connection.invoke("SendOffer", userId, offer);
                console.log(`[Offer] ✅ Offer已发送`);
            } catch (error) {
                console.error('[Offer] 创建Offer失败:', error);
            }
        }
    }
    
    async handleOffer(userId, offer) {
        try {
            console.log(`[handleOffer] 收到来自 ${userId} 的 Offer`);
            console.log(`[handleOffer] Offer SDP类型: ${offer.type}, 包含音频: ${offer.sdp?.includes('m=audio')}, 包含视频: ${offer.sdp?.includes('m=video')}`);
            const pc = this.peerConnections.get(userId);
            if (!pc) {
                console.error(`[handleOffer] 找不到 PeerConnection: ${userId}`);
                return;
            }
            
            console.log(`[handleOffer] 设置远程描述...`);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            console.log(`[handleOffer] ✅ 远程描述已设置`);
            
            // 处理缓存的 ICE 候选
            await this.processPendingIceCandidates(userId);
            
            console.log(`[handleOffer] 创建 Answer...`);
            const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            console.log(`[handleOffer] Answer SDP类型: ${answer.type}, 包含音频: ${answer.sdp.includes('m=audio')}, 包含视频: ${answer.sdp.includes('m=video')}`);
            await pc.setLocalDescription(answer);
            console.log(`[handleOffer] 本地描述(Answer)已设置`);
            console.log(`[handleOffer] 发送 Answer 到 ${userId}`);
            await this.connection.invoke("SendAnswer", userId, answer);
            console.log(`[handleOffer] ✅ Answer已发送`);
        } catch (error) {
            console.error('[handleOffer] 处理Offer失败:', error);
        }
    }
    
    async handleAnswer(userId, answer) {
        try {
            console.log(`[handleAnswer] 收到来自 ${userId} 的 Answer`);
            console.log(`[handleAnswer] Answer SDP类型: ${answer.type}, 包含音频: ${answer.sdp?.includes('m=audio')}, 包含视频: ${answer.sdp?.includes('m=video')}`);
            const pc = this.peerConnections.get(userId);
            if (!pc) {
                console.error(`[handleAnswer] 找不到 PeerConnection: ${userId}`);
                return;
            }
            
            console.log(`[handleAnswer] 设置远程描述...`);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[handleAnswer] ✅ Answer 处理完成: ${userId}`);
            
            // 处理缓存的 ICE 候选
            await this.processPendingIceCandidates(userId);
        } catch (error) {
            console.error('[handleAnswer] 处理Answer失败:', error);
        }
    }
    
    async handleIceCandidate(userId, candidate) {
        try {
            const candidateType = candidate?.type || 'unknown';
            console.log(`[handleIceCandidate] 收到来自 ${userId} 的 ICE 候选: ${candidateType}`);
            const pc = this.peerConnections.get(userId);
            if (!pc) {
                console.error(`[handleIceCandidate] 找不到 PeerConnection: ${userId}`);
                return;
            }
            
            // 检查远程描述是否已设置
            if (pc.remoteDescription && pc.remoteDescription.type) {
                // 远程描述已设置,直接添加候选
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log(`[handleIceCandidate] ✅ ICE候选已添加: ${userId} (${candidateType})`);
            } else {
                // 远程描述未设置,缓存候选
                console.log(`[handleIceCandidate] 缓存ICE候选 (等待远程描述): ${userId} (${candidateType})`);
                if (!this.pendingIceCandidates.has(userId)) {
                    this.pendingIceCandidates.set(userId, []);
                }
                this.pendingIceCandidates.get(userId).push(candidate);
            }
        } catch (error) {
            console.error('[handleIceCandidate] 添加ICE候选失败:', error);
        }
    }
    
    async processPendingIceCandidates(userId) {
        const pending = this.pendingIceCandidates.get(userId);
        if (pending && pending.length > 0) {
            console.log(`[processPendingIceCandidates] 处理 ${pending.length} 个缓存的ICE候选: ${userId}`);
            const pc = this.peerConnections.get(userId);
            if (pc) {
                for (const candidate of pending) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log(`[processPendingIceCandidates] ✅ 已添加缓存候选: ${candidate.type || 'unknown'}`);
                    } catch (error) {
                        console.error('[processPendingIceCandidates] 添加失败:', error);
                    }
                }
            }
            this.pendingIceCandidates.delete(userId);
        }
    }
    
    handleRemoteTrack(userId, event) {
        const stream = event.streams[0];
        const track = event.track;
        
        console.log(`[handleRemoteTrack] 用户: ${userId}`);
        console.log(`[handleRemoteTrack] 轨道类型: ${track.kind}`);
        console.log(`[handleRemoteTrack] 轨道状态: ${track.readyState}`);
        console.log(`[handleRemoteTrack] 轨道启用: ${track.enabled}`);
        console.log(`[handleRemoteTrack] Stream ID: ${stream.id}`);
        console.log(`[handleRemoteTrack] Stream tracks:`, stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
        
        // 查找或创建该用户的媒体元素
        let mediaContainer = document.getElementById(`remote-${userId}`);
        
        if (!mediaContainer) {
            console.log(`[handleRemoteTrack] 创建新的媒体容器: remote-${userId}`);
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
            audioEl.volume = 1.0;
            
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
            console.log(`[handleRemoteTrack] 媒体容器已添加到 DOM`);
        }
        
        const audioEl = document.getElementById(`audio-${userId}`);
        const videoEl = document.getElementById(`video-${userId}`);
        
        if (track.kind === 'audio') {
            console.log(`[handleRemoteTrack] 设置音频流到 audio-${userId}`);
            audioEl.srcObject = stream;
            
            // 监听音频元素事件
            audioEl.onloadedmetadata = () => {
                console.log(`[Audio] loadedmetadata - 音频元数据已加载: ${userId}`);
            };
            audioEl.oncanplay = () => {
                console.log(`[Audio] canplay - 音频可以播放: ${userId}`);
                audioEl.play().then(() => {
                    console.log(`[Audio] ✅ 音频开始播放: ${userId}, volume: ${audioEl.volume}`);
                }).catch(err => {
                    console.error(`[Audio] ❌ 音频播放失败: ${userId}`, err);
                });
            };
            audioEl.onplay = () => {
                console.log(`[Audio] play 事件触发: ${userId}`);
            };
            audioEl.onerror = (err) => {
                console.error(`[Audio] 错误: ${userId}`, err);
            };
            
        } else if (track.kind === 'video') {
            console.log(`[handleRemoteTrack] 设置视频流到 video-${userId}`);
            videoEl.srcObject = stream;
            videoEl.classList.remove('hidden');
            
            videoEl.onloadedmetadata = () => {
                console.log(`[Video] loadedmetadata - 视频元数据已加载: ${userId}`);
            };
            videoEl.oncanplay = () => {
                console.log(`[Video] canplay - 视频可以播放: ${userId}`);
            };
        }
    }
    
    removePeerConnection(userId) {
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
        }
        
        // 清除缓存的 ICE 候选
        this.pendingIceCandidates.delete(userId);
        
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
        const allPeers = Array.from(this.peerConnections.entries());
        const connectedCount = allPeers.filter(([_, pc]) => pc.connectionState === 'connected').length;
        
        console.log(`[updateConnectionStatus] 总连接数: ${allPeers.length}, 已连接: ${connectedCount}`);
        allPeers.forEach(([userId, pc]) => {
            console.log(`  - ${userId.substring(0, 8)}: ${pc.connectionState} (ICE: ${pc.iceConnectionState})`);
        });
        
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
