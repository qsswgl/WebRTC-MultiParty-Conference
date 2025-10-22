# 证书获取脚本
# 从证书API获取qsgl.net泛域名证书

param(
    [string]$CertApiUrl = "http://tx.qsgl.net:5074/api/request-cert",
    [string]$Domain = "*.qsgl.net",
    [string]$OutputDir = ".\certs"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "证书获取脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 创建证书目录
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "✓ 创建证书目录: $OutputDir" -ForegroundColor Green
}

Write-Host "正在从API获取证书..." -ForegroundColor Yellow
Write-Host "API地址: $CertApiUrl" -ForegroundColor Gray
Write-Host "域名: $Domain" -ForegroundColor Gray
Write-Host ""

try {
    # 准备请求数据
    $requestBody = @{
        domain = $Domain
    } | ConvertTo-Json

    # 发送请求获取证书
    $response = Invoke-RestMethod -Uri $CertApiUrl `
                                  -Method Post `
                                  -Body $requestBody `
                                  -ContentType "application/json" `
                                  -TimeoutSec 30

    if ($response) {
        # 保存fullchain.pem
        if ($response.fullchain) {
            $fullchainPath = Join-Path $OutputDir "fullchain.pem"
            $response.fullchain | Out-File -FilePath $fullchainPath -Encoding UTF8 -NoNewline
            Write-Host "✓ 已保存证书链: $fullchainPath" -ForegroundColor Green
        }

        # 保存privkey.pem
        if ($response.privkey) {
            $privkeyPath = Join-Path $OutputDir "privkey.pem"
            $response.privkey | Out-File -FilePath $privkeyPath -Encoding UTF8 -NoNewline
            Write-Host "✓ 已保存私钥: $privkeyPath" -ForegroundColor Green
        }

        # 保存cert.pem (可选)
        if ($response.cert) {
            $certPath = Join-Path $OutputDir "cert.pem"
            $response.cert | Out-File -FilePath $certPath -Encoding UTF8 -NoNewline
            Write-Host "✓ 已保存证书: $certPath" -ForegroundColor Green
        }

        # 保存chain.pem (可选)
        if ($response.chain) {
            $chainPath = Join-Path $OutputDir "chain.pem"
            $response.chain | Out-File -FilePath $chainPath -Encoding UTF8 -NoNewline
            Write-Host "✓ 已保存中间证书: $chainPath" -ForegroundColor Green
        }

        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Cyan
        Write-Host "证书获取成功！" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Cyan
        
        # 显示证书有效期（如果API返回）
        if ($response.expiryDate) {
            Write-Host "证书有效期至: $($response.expiryDate)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "✗ API返回空响应" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host ""
    Write-Host "✗ 证书获取失败！" -ForegroundColor Red
    Write-Host "错误信息: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "HTTP状态码: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "  1. API地址是否正确" -ForegroundColor Yellow
    Write-Host "  2. 网络连接是否正常" -ForegroundColor Yellow
    Write-Host "  3. API服务是否运行中" -ForegroundColor Yellow
    
    exit 1
}

Write-Host ""
Write-Host "证书文件已保存到: $OutputDir" -ForegroundColor Cyan
