// 简化的点对点 WebRTC 客户端 (两人通话)
class SimpleP2PClient {
    constructor() {
        this.connection = null;
        this.peerConnection = null;
        this.localStream = null;
        this.roomId = null;
        this.userId = 'user_' + Math.random().toString(36).substring(2, 11);
        this.remoteUserId = null;
        this.isInitiator = false;
        
        // 简化的 ICE 配置
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                {
                    urls: ['turn:a.relay.metered.ca:80'],
                    username: 'e1c0ce9dfdab18f097861f1f',
                    credential: 'sPIE/RbUXEZ7EJ1Q'
                }
            ]
        };
        
        this.init();
    }
    
    async init() {
        console.log('[Simple P2P] 初始化...');
        
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        this.setupEventListeners();
        await this.connectSignalR();
        this.checkUrlParams();
    }
    
    setupEventListeners() {
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            const roomId = document.getElementById('roomIdInput').value;
            if (roomId) this.joinRoom(roomId);
        });
        document.getElementById('leaveRoomBtn').addEventListener('click', () => this.leaveRoom());
    }
    
    async connectSignalR() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/webrtc")
            .configureLogging(signalR.LogLevel.Information)
            .build();
        
        this.setupSignalRHandlers();
        
        try {
            await this.connection.start();
            console.log("[SignalR] 已连接");
            this.showToast('已连接到服务器', 'success');
        } catch (err) {
            console.error("[SignalR] 连接失败:", err);
            this.showToast('连接失败', 'error');
        }
    }
    
    setupSignalRHandlers() {
        // 用户加入
        this.connection.on("UserJoined", async (data) => {
            console.log('[UserJoined]', data.userId);
            this.remoteUserId = data.userId;
            this.showToast(`用户加入: ${data.userId.substring(0, 8)}`, 'info');
            
            // 作为已在房间的用户,主动发起连接
            if (!this.peerConnection) {
                this.isInitiator = true;
                await this.createPeerConnection();
            }
        });
        
        // 收到 Offer
        this.connection.on("ReceiveOffer", async (data) => {
            console.log('[ReceiveOffer] from:', data.sender);
            this.remoteUserId = data.sender;
            this.isInitiator = false;
            
            if (!this.peerConnection) {
                await this.createPeerConnection();
            }
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.connection.invoke("SendAnswer", data.sender, answer);
            console.log('[Answer] 已发送');
        });
        
        // 收到 Answer
        this.connection.on("ReceiveAnswer", async (data) => {
            console.log('[ReceiveAnswer] from:', data.sender);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        });
        
        // 收到 ICE 候选
        this.connection.on("ReceiveIceCandidate", async (data) => {
            try {
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('[ICE] 候选已添加:', data.candidate.type);
                }
            } catch (error) {
                console.error('[ICE] 添加候选失败:', error);
            }
        });
        
        // 用户离开
        this.connection.on("UserLeft", (data) => {
            console.log('[UserLeft]', data.userId);
            this.showToast('对方已离开', 'info');
            this.closePeerConnection();
        });
    }
    
    async createRoom() {
        try {
            const result = await this.connection.invoke("CreateRoom", this.userId);
            this.roomId = result.roomId;
            this.isInitiator = true;
            
            await this.getUserMedia();
            this.showRoomInterface();
            this.showToast('房间创建成功', 'success');
            
            document.getElementById('roomIdDisplay').textContent = this.roomId;
            document.getElementById('shareLink').value = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
        } catch (error) {
            console.error('[CreateRoom] 失败:', error);
            this.showToast('创建房间失败', 'error');
        }
    }
    
    async joinRoom(roomId) {
        try {
            const result = await this.connection.invoke("JoinRoom", roomId, this.userId);
            
            if (result.type === 'error') {
                this.showToast(result.message, 'error');
                return;
            }
            
            this.roomId = roomId;
            this.isInitiator = false;
            
            await this.getUserMedia();
            this.showRoomInterface();
            this.showToast('已加入房间', 'success');
            
            // 如果房间里有人,等待对方发起连接
            console.log('[JoinRoom] 等待连接...');
        } catch (error) {
            console.error('[JoinRoom] 失败:', error);
            this.showToast('加入房间失败', 'error');
        }
    }
    
    async getUserMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            document.getElementById('localAudio').srcObject = this.localStream;
            console.log('[Media] 本地音频流获取成功');
        } catch (error) {
            console.error('[Media] 获取失败:', error);
            throw error;
        }
    }
    
    async createPeerConnection() {
        console.log('[PC] 创建 PeerConnection, initiator:', this.isInitiator);
        
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        // 添加本地流
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
                console.log('[PC] 添加轨道:', track.kind);
            });
        }
        
        // 处理远程流
        this.peerConnection.ontrack = (event) => {
            console.log('[PC] 收到远程流:', event.track.kind);
            const remoteAudio = document.getElementById('remoteAudio');
            remoteAudio.srcObject = event.streams[0];
            this.showToast('✅ 音频连接成功!', 'success');
        };
        
        // 处理 ICE 候选
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log('[ICE] 发送候选:', event.candidate.type, event.candidate.address);
                await this.connection.invoke("SendIceCandidate", this.remoteUserId, event.candidate);
            }
        };
        
        // 连接状态监听
        this.peerConnection.onconnectionstatechange = () => {
            console.log('[PC] 连接状态:', this.peerConnection.connectionState);
            document.getElementById('connectionStatus').textContent = 
                `连接状态: ${this.peerConnection.connectionState}`;
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('[ICE] 连接状态:', this.peerConnection.iceConnectionState);
        };
        
        // 如果是发起者,创建 Offer
        if (this.isInitiator) {
            try {
                console.log('[Offer] 创建 Offer...');
                const offer = await this.peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: false
                });
                await this.peerConnection.setLocalDescription(offer);
                await this.connection.invoke("SendOffer", this.remoteUserId, offer);
                console.log('[Offer] 已发送');
            } catch (error) {
                console.error('[Offer] 创建失败:', error);
            }
        }
    }
    
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.remoteUserId = null;
        document.getElementById('remoteAudio').srcObject = null;
    }
    
    async leaveRoom() {
        try {
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }
            this.closePeerConnection();
            await this.connection.invoke("LeaveRoom");
            this.hideRoomInterface();
            this.showToast('已离开房间', 'info');
        } catch (error) {
            console.error('[LeaveRoom] 失败:', error);
        }
    }
    
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (roomId) {
            document.getElementById('roomIdInput').value = roomId;
            setTimeout(() => this.joinRoom(roomId), 500);
        }
    }
    
    showRoomInterface() {
        document.getElementById('setupPanel').style.display = 'none';
        document.getElementById('roomPanel').style.display = 'block';
    }
    
    hideRoomInterface() {
        document.getElementById('setupPanel').style.display = 'block';
        document.getElementById('roomPanel').style.display = 'none';
    }
    
    showToast(message, type = 'info') {
        console.log(`[Toast ${type}]`, message);
        // 简化版,只在控制台显示
    }
}

// 初始化
let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new SimpleP2PClient();
});
