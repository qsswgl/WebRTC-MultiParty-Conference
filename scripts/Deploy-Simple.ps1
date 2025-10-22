# WebRTC应用简化部署脚本

param(
    [string]$Server = "tx.qsgl.net",
    [string]$SshKey = "C:\Key\tx.qsgl.net_id_ed25519",
    [string]$RemoteUser = "root",
    [string]$RemoteDir = "/opt/webrtc-app"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "WebRTC部署脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查SSH密钥
if (!(Test-Path $SshKey)) {
    Write-Host "X SSH密钥不存在: $SshKey" -ForegroundColor Red
    exit 1
}
Write-Host " SSH密钥已找到" -ForegroundColor Green

Write-Host " 准备部署到: $Server" -ForegroundColor Green
Write-Host ""

# 测试连接
Write-Host "测试SSH连接..." -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" -o StrictHostKeyChecking=no $RemoteUser@$Server `"echo connected`""
Invoke-Expression $sshCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "X SSH连接失败" -ForegroundColor Red
    exit 1
}
Write-Host " SSH连接成功" -ForegroundColor Green
Write-Host ""

# 创建远程目录
Write-Host "创建远程目录..." -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"mkdir -p $RemoteDir`""
Invoke-Expression $sshCmd
Write-Host " 目录已创建" -ForegroundColor Green
Write-Host ""

# 上传文件
Write-Host "上传项目文件..." -ForegroundColor Yellow
$scpCmd = "scp -i `"$SshKey`" -r * $RemoteUser@${Server}:$RemoteDir/"
Invoke-Expression $scpCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "X 文件上传失败" -ForegroundColor Red
    exit 1
}
Write-Host " 文件上传成功" -ForegroundColor Green
Write-Host ""

# 部署Docker
Write-Host "部署Docker容器..." -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"cd $RemoteDir; docker-compose down; docker-compose build; docker-compose up -d`""
Invoke-Expression $sshCmd
Write-Host ""

# 查看状态
Write-Host "检查容器状态..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"cd $RemoteDir; docker-compose ps`""
Invoke-Expression $sshCmd
Write-Host ""

# 查看日志
Write-Host "最近日志:" -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"cd $RemoteDir; docker-compose logs --tail=20`""
Invoke-Expression $sshCmd
Write-Host ""

Write-Host "=====================================" -ForegroundColor Green
Write-Host "部署完成!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "访问地址: https://$Server:8096" -ForegroundColor Cyan
