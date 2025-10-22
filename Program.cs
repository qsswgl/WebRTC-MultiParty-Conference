using WebRTCApp.Hubs;
using WebRTCApp.Services;

var builder = WebApplication.CreateBuilder(args);

// 配置Kestrel监听8096端口
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(8096, listenOptions =>
    {
        // 如果有证书则启用HTTPS
        var certPath = builder.Configuration["CertPath"];
        if (!string.IsNullOrEmpty(certPath))
        {
            var pfxFile = Path.Combine(certPath, "cert.pfx");
            
            if (File.Exists(pfxFile))
            {
                listenOptions.UseHttps(pfxFile, "");
                Console.WriteLine("✓ HTTPS已启用");
            }
            else
            {
                Console.WriteLine($"⚠ 证书文件未找到: {pfxFile}");
            }
        }
    });
});

// 添加服务
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 102400; // 100 KB
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});

builder.Services.AddSingleton<RoomManager>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// 配置中间件
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();

app.UseRouting();

app.MapHub<WebRTCHub>("/webrtc");

app.MapFallbackToFile("index.html");

Console.WriteLine($"\n🚀 WebRTC服务器运行在端口 8096");
Console.WriteLine($"📡 SignalR Hub地址: /webrtc\n");

app.Run();
