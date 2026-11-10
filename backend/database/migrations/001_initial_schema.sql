-- =========================================================================
-- OfficeConnect Enterprise LAN Messaging Platform - Database Schema
-- Target: Microsoft SQL Server 2019 / 2022 / Azure SQL
-- Designed for LAN deployment (e.g. 10.1.60.0/24 subnet)
-- All Primary Keys and Foreign Keys are standardized to INTEGER (INT).
-- =========================================================================

-- 1. SCHEMAS
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Auth')
    EXEC('CREATE SCHEMA [Auth]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Organization')
    EXEC('CREATE SCHEMA [Organization]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Chat')
    EXEC('CREATE SCHEMA [Chat]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Communication')
    EXEC('CREATE SCHEMA [Communication]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Administration')
    EXEC('CREATE SCHEMA [Administration]');
GO

-- 2. AUTH TABLES
IF OBJECT_ID('[Auth].[Roles]', 'U') IS NULL
BEGIN
    CREATE TABLE [Auth].[Roles] (
        [RoleId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [RoleName] NVARCHAR(100) NOT NULL UNIQUE,
        [Description] NVARCHAR(255) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID('[Organization].[Departments]', 'U') IS NULL
BEGIN
    CREATE TABLE [Organization].[Departments] (
        [DepartmentId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Name] NVARCHAR(100) NOT NULL UNIQUE,
        [Code] NVARCHAR(20) NOT NULL UNIQUE,
        [Description] NVARCHAR(255) NULL,
        [ManagerId] INT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID('[Auth].[Users]', 'U') IS NULL
BEGIN
    CREATE TABLE [Auth].[Users] (
        [UserId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [EmployeeId] INT NOT NULL UNIQUE,
        [Username] NVARCHAR(50) NOT NULL UNIQUE,
        [Email] NVARCHAR(150) NOT NULL UNIQUE,
        [PasswordHash] NVARCHAR(255) NOT NULL,
        [FullName] NVARCHAR(150) NOT NULL,
        [DepartmentId] INT NOT NULL,
        [JobTitle] NVARCHAR(100) NOT NULL,
        [AvatarUrl] NVARCHAR(500) NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'offline', -- online, away, busy, offline
        [LastSeen] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_Users_Departments] FOREIGN KEY ([DepartmentId]) REFERENCES [Organization].[Departments]([DepartmentId])
    );
    CREATE NONCLUSTERED INDEX [IX_Users_Username] ON [Auth].[Users]([Username]);
    CREATE NONCLUSTERED INDEX [IX_Users_Email] ON [Auth].[Users]([Email]);
    CREATE NONCLUSTERED INDEX [IX_Users_Department] ON [Auth].[Users]([DepartmentId]);
END;
GO

IF OBJECT_ID('[Auth].[UserRoles]', 'U') IS NULL
BEGIN
    CREATE TABLE [Auth].[UserRoles] (
        [UserRoleId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [RoleId] INT NOT NULL,
        [AssignedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_UserRoles_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]) ON DELETE CASCADE,
        CONSTRAINT [FK_UserRoles_Roles] FOREIGN KEY ([RoleId]) REFERENCES [Auth].[Roles]([RoleId]),
        CONSTRAINT [UQ_UserRoles_User_Role] UNIQUE ([UserId], [RoleId])
    );
END;
GO

IF OBJECT_ID('[Auth].[RefreshTokens]', 'U') IS NULL
BEGIN
    CREATE TABLE [Auth].[RefreshTokens] (
        [TokenId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [TokenHash] NVARCHAR(255) NOT NULL UNIQUE,
        [ExpiresAt] DATETIME2 NOT NULL,
        [IsRevoked] BIT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [ReplacedByTokenHash] NVARCHAR(255) NULL,
        CONSTRAINT [FK_RefreshTokens_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX [IX_RefreshTokens_User_Expires] ON [Auth].[RefreshTokens]([UserId], [ExpiresAt]);
END;
GO

IF OBJECT_ID('[Auth].[UserSessions]', 'U') IS NULL
BEGIN
    CREATE TABLE [Auth].[UserSessions] (
        [SessionId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [IpAddress] NVARCHAR(50) NOT NULL,
        [UserAgent] NVARCHAR(255) NULL,
        [LastActiveAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [IsRevoked] BIT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_UserSessions_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]) ON DELETE CASCADE
    );
END;
GO

-- 3. CHAT CONVERSATIONS & MEMBERS
IF OBJECT_ID('[Chat].[Conversations]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[Conversations] (
        [ConversationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Type] NVARCHAR(20) NOT NULL, -- 'direct' or 'group'
        [Title] NVARCHAR(150) NULL,
        [Description] NVARCHAR(500) NULL,
        [AvatarUrl] NVARCHAR(500) NULL,
        [CreatedById] INT NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_Conversations_Creator] FOREIGN KEY ([CreatedById]) REFERENCES [Auth].[Users]([UserId])
    );
    CREATE NONCLUSTERED INDEX [IX_Conversations_UpdatedAt] ON [Chat].[Conversations]([UpdatedAt] DESC);
END;
GO

IF OBJECT_ID('[Chat].[ConversationMembers]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[ConversationMembers] (
        [MemberId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [ConversationId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Role] NVARCHAR(20) NOT NULL DEFAULT 'member', -- 'admin', 'member'
        [JoinedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [LastReadMessageId] INT NULL,
        CONSTRAINT [FK_ConvMembers_Conversations] FOREIGN KEY ([ConversationId]) REFERENCES [Chat].[Conversations]([ConversationId]) ON DELETE CASCADE,
        CONSTRAINT [FK_ConvMembers_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]),
        CONSTRAINT [UQ_ConvMembers_User_Conv] UNIQUE ([ConversationId], [UserId])
    );
    CREATE NONCLUSTERED INDEX [IX_ConvMembers_User] ON [Chat].[ConversationMembers]([UserId]);
    CREATE NONCLUSTERED INDEX [IX_ConvMembers_Conversation] ON [Chat].[ConversationMembers]([ConversationId]);
END;
GO

-- 4. CHAT MESSAGES
IF OBJECT_ID('[Chat].[Messages]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[Messages] (
        [MessageId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [ConversationId] INT NOT NULL,
        [SenderId] INT NOT NULL,
        [Content] NVARCHAR(MAX) NOT NULL,
        [IdempotencyId] INT NULL,
        [ReplyToMessageId] INT NULL,
        [IsPinned] BIT NOT NULL DEFAULT 0,
        [IsEdited] BIT NOT NULL DEFAULT 0,
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sending', 'sent', 'delivered', 'read', 'failed'
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_Messages_Conversations] FOREIGN KEY ([ConversationId]) REFERENCES [Chat].[Conversations]([ConversationId]) ON DELETE CASCADE,
        CONSTRAINT [FK_Messages_Users] FOREIGN KEY ([SenderId]) REFERENCES [Auth].[Users]([UserId]),
        CONSTRAINT [FK_Messages_ReplyTo] FOREIGN KEY ([ReplyToMessageId]) REFERENCES [Chat].[Messages]([MessageId])
    );
    CREATE NONCLUSTERED INDEX [IX_Messages_Conv_Created] ON [Chat].[Messages]([ConversationId], [CreatedAt] DESC);
    CREATE NONCLUSTERED INDEX [IX_Messages_Idempotency] ON [Chat].[Messages]([ConversationId], [IdempotencyId]) WHERE [IdempotencyId] IS NOT NULL;
END;
GO

-- 5. RECEIPTS, REACTIONS, ATTACHMENTS, PINNED
IF OBJECT_ID('[Chat].[MessageReceipts]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[MessageReceipts] (
        [ReceiptId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MessageId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Status] NVARCHAR(20) NOT NULL, -- 'delivered', 'read'
        [Timestamp] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_MessageReceipts_Messages] FOREIGN KEY ([MessageId]) REFERENCES [Chat].[Messages]([MessageId]) ON DELETE CASCADE,
        CONSTRAINT [FK_MessageReceipts_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]),
        CONSTRAINT [UQ_MessageReceipts_User_Msg_Status] UNIQUE ([MessageId], [UserId], [Status])
    );
END;
GO

IF OBJECT_ID('[Chat].[MessageReactions]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[MessageReactions] (
        [ReactionId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MessageId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Emoji] NVARCHAR(20) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_MessageReactions_Messages] FOREIGN KEY ([MessageId]) REFERENCES [Chat].[Messages]([MessageId]) ON DELETE CASCADE,
        CONSTRAINT [FK_MessageReactions_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]),
        CONSTRAINT [UQ_MessageReactions_User_Msg_Emoji] UNIQUE ([MessageId], [UserId], [Emoji])
    );
END;
GO

IF OBJECT_ID('[Chat].[MessageAttachments]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[MessageAttachments] (
        [AttachmentId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MessageId] INT NOT NULL,
        [FileName] NVARCHAR(255) NOT NULL,
        [FileSize] BIGINT NOT NULL,
        [FileType] NVARCHAR(50) NOT NULL,
        [MimeType] NVARCHAR(100) NOT NULL,
        [StoragePath] NVARCHAR(500) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_MessageAttachments_Messages] FOREIGN KEY ([MessageId]) REFERENCES [Chat].[Messages]([MessageId]) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('[Chat].[PinnedMessages]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[PinnedMessages] (
        [PinId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [ConversationId] INT NOT NULL,
        [MessageId] INT NOT NULL,
        [PinnedById] INT NOT NULL,
        [PinnedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_PinnedMessages_Conversations] FOREIGN KEY ([ConversationId]) REFERENCES [Chat].[Conversations]([ConversationId]),
        CONSTRAINT [FK_PinnedMessages_Messages] FOREIGN KEY ([MessageId]) REFERENCES [Chat].[Messages]([MessageId]) ON DELETE CASCADE,
        CONSTRAINT [FK_PinnedMessages_Users] FOREIGN KEY ([PinnedById]) REFERENCES [Auth].[Users]([UserId]),
        CONSTRAINT [UQ_PinnedMessages_Conv_Msg] UNIQUE ([ConversationId], [MessageId])
    );
END;
GO

-- 6. COMMUNICATION & AUDIT LOGS
IF OBJECT_ID('[Communication].[Notifications]', 'U') IS NULL
BEGIN
    CREATE TABLE [Communication].[Notifications] (
        [NotificationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [Body] NVARCHAR(1000) NOT NULL,
        [ConversationId] INT NULL,
        [IsRead] BIT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_Notifications_Users] FOREIGN KEY ([UserId]) REFERENCES [Auth].[Users]([UserId]) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX [IX_Notifications_User_Read] ON [Communication].[Notifications]([UserId], [IsRead]);
END;
GO

IF OBJECT_ID('[Administration].[AuditLogs]', 'U') IS NULL
BEGIN
    CREATE TABLE [Administration].[AuditLogs] (
        [LogId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [UserName] NVARCHAR(150) NOT NULL,
        [Action] NVARCHAR(100) NOT NULL,
        [TargetResource] NVARCHAR(100) NOT NULL,
        [Details] NVARCHAR(MAX) NULL,
        [IpAddress] NVARCHAR(50) NOT NULL,
        [Timestamp] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_Timestamp] ON [Administration].[AuditLogs]([Timestamp] DESC);
END;
GO

IF OBJECT_ID('[Administration].[ApplicationSettings]', 'U') IS NULL
BEGIN
    CREATE TABLE [Administration].[ApplicationSettings] (
        [SettingKey] NVARCHAR(100) NOT NULL PRIMARY KEY,
        [SettingValue] NVARCHAR(MAX) NOT NULL,
        [Description] NVARCHAR(255) NULL,
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- 7. STORED PROCEDURE: Cursor-Based Message Pagination
CREATE OR ALTER PROCEDURE [Chat].[sp_GetMessagesCursor]
    @ConversationId INT,
    @CursorMessageId INT = NULL,
    @Limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CursorCreatedAt DATETIME2 = NULL;
    
    IF @CursorMessageId IS NOT NULL
    BEGIN
        SELECT @CursorCreatedAt = CreatedAt 
        FROM [Chat].[Messages] 
        WHERE [MessageId] = @CursorMessageId;
    END

    SELECT TOP (@Limit)
        m.[MessageId],
        m.[ConversationId],
        m.[SenderId],
        u.[FullName] AS [SenderName],
        u.[AvatarUrl] AS [SenderAvatar],
        m.[Content],
        m.[IdempotencyId],
        m.[ReplyToMessageId],
        rm.[Content] AS [ReplyToContent],
        ru.[FullName] AS [ReplyToSenderName],
        m.[IsPinned],
        m.[IsEdited],
        m.[IsDeleted],
        m.[Status],
        m.[CreatedAt],
        m.[UpdatedAt]
    FROM [Chat].[Messages] m
    INNER JOIN [Auth].[Users] u ON m.[SenderId] = u.[UserId]
    LEFT JOIN [Chat].[Messages] rm ON m.[ReplyToMessageId] = rm.[MessageId]
    LEFT JOIN [Auth].[Users] ru ON rm.[SenderId] = ru.[UserId]
    WHERE m.[ConversationId] = @ConversationId
      AND (@CursorCreatedAt IS NULL OR m.[CreatedAt] < @CursorCreatedAt)
    ORDER BY m.[CreatedAt] DESC;
END;
GO
