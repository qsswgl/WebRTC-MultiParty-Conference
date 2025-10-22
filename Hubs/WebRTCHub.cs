using Microsoft.AspNetCore.SignalR;
using WebRTCApp.Services;

namespace WebRTCApp.Hubs;

public class WebRTCHub : Hub
{
    private readonly RoomManager _roomManager;
    private readonly ILogger<WebRTCHub> _logger;

    public WebRTCHub(RoomManager roomManager, ILogger<WebRTCHub> logger)
    {
        _roomManager = roomManager;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation($"客户端连接: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation($"客户端断开: {Context.ConnectionId}");

        var user = _roomManager.GetUserByConnectionId(Context.ConnectionId);
        if (user != null)
        {
            var room = _roomManager.GetRoom(user.RoomId);
            if (room != null)
            {
                // 通知房间内其他成员
                await Clients.OthersInGroup(user.RoomId).SendAsync("UserLeft", new
                {
                    userId = user.UserId
                });
            }

            _roomManager.LeaveRoom(Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task<object> CreateRoom(string userId)
    {
        try
        {
            var roomId = _roomManager.CreateRoom(userId, Context.ConnectionId);
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

            _logger.LogInformation($"房间创建成功: {roomId}, 创建者: {userId}");

            return new
            {
                type = "room-created",
                roomId,
                userId
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "创建房间失败");
            throw;
        }
    }

    public async Task<object> JoinRoom(string roomId, string userId)
    {
        try
        {
            var success = _roomManager.JoinRoom(roomId, userId, Context.ConnectionId);

            if (!success)
            {
                return new
                {
                    type = "error",
                    message = "房间不存在或已满"
                };
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

            // 获取房间内所有成员
            var members = _roomManager.GetRoomMembers(roomId)
                .Select(m => new { m.UserId })
                .ToList();

            // 通知房间内其他成员有新用户加入
            await Clients.OthersInGroup(roomId).SendAsync("UserJoined", new
            {
                userId,
                members // 发送所有成员列表给新加入者
            });

            _logger.LogInformation($"用户 {userId} 加入房间 {roomId}, 当前人数: {members.Count}");

            return new
            {
                type = "room-joined",
                roomId,
                userId,
                members = members.Where(m => m.UserId != userId).ToList() // 返回其他成员列表
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "加入房间失败");
            throw;
        }
    }

    public async Task SendOffer(string targetUserId, object offer)
    {
        try
        {
            var sender = _roomManager.GetUserByConnectionId(Context.ConnectionId);
            if (sender == null) return;

            var members = _roomManager.GetRoomMembers(sender.RoomId);
            var target = members.FirstOrDefault(m => m.UserId == targetUserId);

            if (target != null)
            {
                await Clients.Client(target.ConnectionId).SendAsync("ReceiveOffer", new
                {
                    offer,
                    sender = sender.UserId
                });

                _logger.LogInformation($"Offer已转发: {sender.UserId} -> {targetUserId}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发送Offer失败");
        }
    }

    public async Task SendAnswer(string targetUserId, object answer)
    {
        try
        {
            var sender = _roomManager.GetUserByConnectionId(Context.ConnectionId);
            if (sender == null) return;

            var members = _roomManager.GetRoomMembers(sender.RoomId);
            var target = members.FirstOrDefault(m => m.UserId == targetUserId);

            if (target != null)
            {
                await Clients.Client(target.ConnectionId).SendAsync("ReceiveAnswer", new
                {
                    answer,
                    sender = sender.UserId
                });

                _logger.LogInformation($"Answer已转发: {sender.UserId} -> {targetUserId}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发送Answer失败");
        }
    }

    public async Task SendIceCandidate(string targetUserId, object candidate)
    {
        try
        {
            var sender = _roomManager.GetUserByConnectionId(Context.ConnectionId);
            if (sender == null) return;

            var members = _roomManager.GetRoomMembers(sender.RoomId);
            var target = members.FirstOrDefault(m => m.UserId == targetUserId);

            if (target != null)
            {
                await Clients.Client(target.ConnectionId).SendAsync("ReceiveIceCandidate", new
                {
                    candidate,
                    sender = sender.UserId
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发送ICE候选失败");
        }
    }

    public async Task LeaveRoom()
    {
        try
        {
            var user = _roomManager.GetUserByConnectionId(Context.ConnectionId);
            if (user != null)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, user.RoomId);

                // 通知其他成员
                await Clients.OthersInGroup(user.RoomId).SendAsync("UserLeft", new
                {
                    userId = user.UserId
                });

                _roomManager.LeaveRoom(Context.ConnectionId);
                _logger.LogInformation($"用户 {user.UserId} 离开房间 {user.RoomId}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "离开房间失败");
        }
    }
}
