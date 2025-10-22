# 手动获取 Let's Encrypt 证书脚本
# 使用 certbot 在服务器上申请证书

param(
    [string]$Domain = "tx.qsgl.net",
    [string]$Email = "admin@qsgl.net"
)

Write-Host "=== 手动申请 Let's Encrypt 证书 ===" -ForegroundColor Cyan
Write-Host "域名: $Domain" -ForegroundColor Yellow
Write-Host ""

$sshKey = "C:\Key\tx.qsgl.net_id_ed25519"
$server = "tx.qsgl.net"

# 检查服务器是否已安装 certbot
Write-Host "1. 检查 Certbot 安装..." -ForegroundColor Cyan
ssh -i $sshKey root@$server "which certbot || echo 'Not installed'"

Write-Host ""
Write-Host "2. 安装 Certbot (如需要)..." -ForegroundColor Cyan
$installCmd = @"
if ! command -v certbot &> /dev/null; then
    echo '正在安装 Certbot...'
    apt-get update -qq
    apt-get install -y certbot
else
    echo 'Certbot 已安装'
fi
"@

ssh -i $sshKey root@$server $installCmd

Write-Host ""
Write-Host "3. 申请证书 (Standalone 模式)..." -ForegroundColor Cyan
Write-Host "注意: 需要临时停止占用 80 端口的服务" -ForegroundColor Yellow

$certCmd = @"
# 临时停止可能占用 80 端口的服务
systemctl stop nginx 2>/dev/null || true
docker stop caddy 2>/dev/null || true

# 申请证书
certbot certonly --standalone \
  -d $Domain \
  --non-interactive \
  --agree-tos \
  --email $Email \
  --preferred-challenges http

# 检查证书是否生成
if [ -f "/etc/letsencrypt/live/$Domain/fullchain.pem" ]; then
    echo ''
    echo '=== 证书申请成功! ==='
    echo "证书路径: /etc/letsencrypt/live/$Domain/"
    ls -lh /etc/letsencrypt/live/$Domain/
else
    echo ''
    echo '=== 证书申请失败 ==='
    exit 1
fi
"@

ssh -i $sshKey root@$server $certCmd

Write-Host ""
Write-Host "4. 复制证书到项目目录..." -ForegroundColor Cyan
$copyCmd = @"
mkdir -p /opt/webrtc-app/certs
cp /etc/letsencrypt/live/$Domain/fullchain.pem /opt/webrtc-app/certs/
cp /etc/letsencrypt/live/$Domain/privkey.pem /opt/webrtc-app/certs/
chmod 644 /opt/webrtc-app/certs/*.pem
ls -lh /opt/webrtc-app/certs/
"@

ssh -i $sshKey root@$server $copyCmd

Write-Host ""
Write-Host "5. 下载证书到本地..." -ForegroundColor Cyan
if (!(Test-Path ".\certs")) {
    New-Item -ItemType Directory -Path ".\certs" | Out-Null
}

scp -i $sshKey root@$server":/opt/webrtc-app/certs/fullchain.pem" .\certs\
scp -i $sshKey root@$server":/opt/webrtc-app/certs/privkey.pem" .\certs\

Write-Host ""
Write-Host "=== 证书获取完成! ===" -ForegroundColor Green
Write-Host "本地证书目录: .\certs\" -ForegroundColor Yellow
Write-Host "服务器证书目录: /opt/webrtc-app/certs/" -ForegroundColor Yellow
Write-Host ""
Write-Host "下一步: 配置 HTTPS" -ForegroundColor Cyan
Write-Host "运行: .\scripts\Configure-HTTPS.ps1" -ForegroundColor Yellow
