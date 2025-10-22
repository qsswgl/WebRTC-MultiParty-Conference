using System.Collections.Concurrent;

namespace WebRTCApp.Services;

public class RoomManager
{
    private readonly ConcurrentDictionary<string, Room> _rooms = new();
    private readonly ConcurrentDictionary<string, UserConnection> _connections = new();

    public string CreateRoom(string userId, string connectionId)
    {
        var roomId = GenerateRoomId();
        var room = new Room
        {
            RoomId = roomId,
            CreatorId = userId,
            Members = new ConcurrentDictionary<string, UserConnection>()
        };

        var userConnection = new UserConnection
        {
            UserId = userId,
            ConnectionId = connectionId,
            RoomId = roomId
        };

        room.Members.TryAdd(userId, userConnection);
        _rooms.TryAdd(roomId, room);
        _connections.TryAdd(connectionId, userConnection);

        return roomId;
    }

    public bool JoinRoom(string roomId, string userId, string connectionId, int maxMembers = 10)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            return false;
        }

        // 限制房间最大人数(默认10人)
        if (room.Members.Count >= maxMembers)
        {
            return false;
        }

        var userConnection = new UserConnection
        {
            UserId = userId,
            ConnectionId = connectionId,
            RoomId = roomId
        };

        room.Members.TryAdd(userId, userConnection);
        _connections.TryAdd(connectionId, userConnection);

        return true;
    }

    public Room? GetRoom(string roomId)
    {
        _rooms.TryGetValue(roomId, out var room);
        return room;
    }

    public UserConnection? GetUserByConnectionId(string connectionId)
    {
        _connections.TryGetValue(connectionId, out var user);
        return user;
    }

    public void LeaveRoom(string connectionId)
    {
        if (!_connections.TryRemove(connectionId, out var userConnection))
        {
            return;
        }

        if (!_rooms.TryGetValue(userConnection.RoomId, out var room))
        {
            return;
        }

        room.Members.TryRemove(userConnection.UserId, out _);

        // 如果房间为空，删除房间
        if (room.Members.IsEmpty)
        {
            _rooms.TryRemove(userConnection.RoomId, out _);
            Console.WriteLine($"房间 {userConnection.RoomId} 已删除");
        }
    }

    public IEnumerable<UserConnection> GetRoomMembers(string roomId)
    {
        if (_rooms.TryGetValue(roomId, out var room))
        {
            return room.Members.Values;
        }
        return Enumerable.Empty<UserConnection>();
    }

    private string GenerateRoomId()
    {
        return Guid.NewGuid().ToString("N")[..8];
    }
}

public class Room
{
    public string RoomId { get; set; } = string.Empty;
    public string CreatorId { get; set; } = string.Empty;
    public ConcurrentDictionary<string, UserConnection> Members { get; set; } = new();
}

public class UserConnection
{
    public string UserId { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
}
