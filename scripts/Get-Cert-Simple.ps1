# 简单证书获取脚本
param(
    [string]$ApiUrl = "http://tx.qsgl.net:5074/api/request-cert",
    [string]$Domain = "*.qsgl.net",
    [string]$OutputDir = ".\certs"
)

Write-Host "Getting SSL certificate..." -ForegroundColor Cyan

# 创建证书目录
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# 请求证书
$body = @{ domain = $Domain } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    
    # 保存证书文件
    if ($response.fullchain) {
        $response.fullchain | Out-File -FilePath "$OutputDir\fullchain.pem" -Encoding UTF8 -NoNewline
        Write-Host "Saved: fullchain.pem" -ForegroundColor Green
    }
    
    if ($response.privkey) {
        $response.privkey | Out-File -FilePath "$OutputDir\privkey.pem" -Encoding UTF8 -NoNewline
        Write-Host "Saved: privkey.pem" -ForegroundColor Green
    }
    
    Write-Host "Certificate obtained successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to get certificate: $_" -ForegroundColor Red
    Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow
    exit 1
}
