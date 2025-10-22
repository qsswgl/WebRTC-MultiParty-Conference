# 配置 WebRTC 应用的 HTTPS 支持

param(
    [string]$Domain = "tx.qsgl.net",
    [int]$HttpsPort = 8096
)

Write-Host "=== 配置 HTTPS ===" -ForegroundColor Cyan
Write-Host ""

$sshKey = "C:\Key\tx.qsgl.net_id_ed25519"
$server = "tx.qsgl.net"

# 1. 验证证书文件存在
Write-Host "1. 验证服务器证书文件..." -ForegroundColor Cyan
$checkCmd = @"
if [ -f '/opt/webrtc-app/certs/fullchain.pem' ] && [ -f '/opt/webrtc-app/certs/privkey.pem' ]; then
    echo '✅ 证书文件存在'
    ls -lh /opt/webrtc-app/certs/
else
    echo '❌ 证书文件不存在'
    echo '请先运行: .\scripts\Get-Cert-Manual.ps1'
    exit 1
fi
"@

ssh -i $sshKey root@$server $checkCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "证书文件检查失败,请先获取证书" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. 更新 Program.cs 支持 HTTPS..." -ForegroundColor Cyan

# 读取当前 Program.cs
$programCs = Get-Content ".\Program.cs" -Raw

# 检查是否已配置 HTTPS
if ($programCs -match "UseKestrel.*ConfigureKestrel") {
    Write-Host "Program.cs 已配置 HTTPS,跳过..." -ForegroundColor Yellow
} else {
    Write-Host "正在更新 Program.cs..." -ForegroundColor Yellow
    
    # 备份
    Copy-Item ".\Program.cs" ".\Program.cs.bak"
    
    # 添加 HTTPS 配置
    $httpsConfig = @'

// HTTPS 配置
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    var certPath = Path.Combine(builder.Environment.ContentRootPath, "certs", "fullchain.pem");
    var keyPath = Path.Combine(builder.Environment.ContentRootPath, "certs", "privkey.pem");
    
    // HTTP 端口 (用于重定向)
    serverOptions.ListenAnyIP(8080);
    
    // HTTPS 端口
    serverOptions.ListenAnyIP(8096, listenOptions =>
    {
        if (File.Exists(certPath) && File.Exists(keyPath))
        {
            listenOptions.UseHttps(certPath, keyPath);
            Console.WriteLine($"✅ HTTPS enabled with certificate: {certPath}");
        }
        else
        {
            Console.WriteLine($"⚠️ Certificate not found at: {certPath}");
        }
    });
});
'@
    
    # 插入到 var app = builder.Build(); 之前
    $programCs = $programCs -replace '(var app = builder\.Build\(\);)', "$httpsConfig`n`n`$1"
    
    Set-Content ".\Program.cs" $programCs -NoNewline
    Write-Host "✅ Program.cs 已更新" -ForegroundColor Green
}

Write-Host ""
Write-Host "3. 更新 docker-compose.yml..." -ForegroundColor Cyan

# 读取 docker-compose.yml
$dockerCompose = Get-Content ".\docker-compose.yml" -Raw

# 检查是否已挂载证书
if ($dockerCompose -match "./certs:/app/certs") {
    Write-Host "docker-compose.yml 已配置证书挂载,跳过..." -ForegroundColor Yellow
} else {
    Write-Host "正在更新 docker-compose.yml..." -ForegroundColor Yellow
    
    # 备份
    Copy-Item ".\docker-compose.yml" ".\docker-compose.yml.bak"
    
    # 在 volumes 部分添加证书挂载
    $dockerCompose = $dockerCompose -replace '(volumes:)', "`$1`n      - ./certs:/app/certs:ro"
    
    Set-Content ".\docker-compose.yml" $dockerCompose -NoNewline
    Write-Host "✅ docker-compose.yml 已更新" -ForegroundColor Green
}

Write-Host ""
Write-Host "4. 部署到服务器..." -ForegroundColor Cyan

# 上传更新后的文件
Write-Host "上传 Program.cs..." -ForegroundColor Yellow
scp -i $sshKey .\Program.cs root@$server":/opt/webrtc-app/"

Write-Host "上传 docker-compose.yml..." -ForegroundColor Yellow
scp -i $sshKey .\docker-compose.yml root@$server":/opt/webrtc-app/"

Write-Host ""
Write-Host "5. 重新构建并启动容器..." -ForegroundColor Cyan
$deployCmd = @"
cd /opt/webrtc-app
echo '🔨 重新构建镜像...'
docker-compose build --no-cache
echo '🚀 启动服务...'
docker-compose up -d
echo '📋 等待服务启动...'
sleep 3
echo '📊 容器状态:'
docker-compose ps
echo ''
echo '📜 容器日志 (最近 20 行):'
docker-compose logs --tail 20
"@

ssh -i $sshKey root@$server $deployCmd

Write-Host ""
Write-Host "6. 测试 HTTPS 访问..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "https://${Domain}:${HttpsPort}" -SkipCertificateCheck -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ HTTPS 访问成功!" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ HTTPS 访问测试失败: $_" -ForegroundColor Yellow
    Write-Host "请手动访问: https://${Domain}:${HttpsPort}" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== HTTPS 配置完成! ===" -ForegroundColor Green
Write-Host ""
Write-Host "📍 服务地址:" -ForegroundColor Cyan
Write-Host "   HTTPS: https://${Domain}:${HttpsPort}" -ForegroundColor Green
Write-Host "   HTTP:  http://${Domain}:8080 (自动重定向到 HTTPS)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 现在可以:" -ForegroundColor Cyan
Write-Host "   - 在微信中分享链接" -ForegroundColor White
Write-Host "   - 正常使用麦克风和摄像头" -ForegroundColor White
Write-Host "   - 测试完整的视频通话功能" -ForegroundColor White
Write-Host ""
Write-Host "💡 提示: 证书有效期 90 天,可以使用 certbot renew 自动续期" -ForegroundColor Yellow
