# WebRTCӦ�ü򻯲���ű�

param(
    [string]$Server = "tx.qsgl.net",
    [string]$SshKey = "C:\Key\tx.qsgl.net_id_ed25519",
    [string]$RemoteUser = "root",
    [string]$RemoteDir = "/opt/webrtc-app"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "WebRTC����ű�" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# ���SSH��Կ
if (!(Test-Path $SshKey)) {
    Write-Host "X SSH��Կ������: $SshKey" -ForegroundColor Red
    exit 1
}
Write-Host " SSH��Կ���ҵ�" -ForegroundColor Green

Write-Host " ׼������: $Server" -ForegroundColor Green
Write-Host ""

# ��������
Write-Host "����SSH����..." -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" -o StrictHostKeyChecking=no $RemoteUser@$Server `"echo connected`""
Invoke-Expression $sshCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "X SSH����ʧ��" -ForegroundColor Red
    exit 1
}
Write-Host " SSH���ӳɹ�" -ForegroundColor Green
Write-Host ""

# ����Զ��Ŀ¼
Write-Host "����Զ��Ŀ¼..." -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"mkdir -p $RemoteDir`""
Invoke-Expression $sshCmd
Write-Host " Ŀ¼�Ѵ���" -ForegroundColor Green
Write-Host ""

# �ϴ��ļ�
Write-Host "�ϴ���Ŀ�ļ�..." -ForegroundColor Yellow
$scpCmd = "scp -i `"$SshKey`" -r * $RemoteUser@${Server}:$RemoteDir/"
Invoke-Expression $scpCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "X �ļ��ϴ�ʧ��" -ForegroundColor Red
    exit 1
}
Write-Host " �ļ��ϴ��ɹ�" -ForegroundColor Green
Write-Host ""

# ����Docker
Write-Host "����Docker����..." -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"cd $RemoteDir; docker-compose down; docker-compose build; docker-compose up -d`""
Invoke-Expression $sshCmd
Write-Host ""

# �鿴״̬
Write-Host "�������״̬..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"cd $RemoteDir; docker-compose ps`""
Invoke-Expression $sshCmd
Write-Host ""

# �鿴��־
Write-Host "�����־:" -ForegroundColor Yellow
$sshCmd = "ssh -i `"$SshKey`" $RemoteUser@$Server `"cd $RemoteDir; docker-compose logs --tail=20`""
Invoke-Expression $sshCmd
Write-Host ""

Write-Host "=====================================" -ForegroundColor Green
Write-Host "�������!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "���ʵ�ַ: https://$Server:8096" -ForegroundColor Cyan
