-- =========================================================================
-- OfficeConnect Enterprise LAN Messaging Platform - Stored Procedures (SPs)
-- Target: Microsoft SQL Server 2019 / 2022 / Azure SQL
-- Purpose: Complete CRUD Stored Procedures covering:
--   1. Authentication & Login (Login, Profile, Status, Token Revocation)
--   2. Employee Registration & Management (Create, Read, Update, Delete/Status, Role)
--   3. Conversations & Channels (Create, Read List, Read Details, Update, Member Management)
--   4. Chat Messages (Create/Send, Read with Cursor, Update Content, Soft Delete, Reactions, Pins)
--   5. Security Audit Logging (Record Log, Read Logs)
-- =========================================================================

-- Ensure required schemas exist
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Auth') EXEC('CREATE SCHEMA [Auth]');
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Organization') EXEC('CREATE SCHEMA [Organization]');
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Chat') EXEC('CREATE SCHEMA [Chat]');
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Administration') EXEC('CREATE SCHEMA [Administration]');
GO

-- =========================================================================
-- 1. STORED PROCEDURE: Register New Employee / User
-- Schema: [Auth].[sp_RegisterEmployee]
-- Description: Validates uniqueness, provisions user account, assigns role,
--              auto-enrolls into #general-announcements, and writes audit log.
-- =========================================================================
CREATE OR ALTER PROCEDURE [Auth].[sp_RegisterEmployee]
    @UserId NVARCHAR(50) = NULL,
    @EmployeeId NVARCHAR(50),
    @Username NVARCHAR(50),
    @FullName NVARCHAR(150),
    @Email NVARCHAR(150),
    @PasswordHash NVARCHAR(255),
    @RoleName NVARCHAR(50) = 'Employee',
    @DepartmentId NVARCHAR(50),
    @JobTitle NVARCHAR(100),
    @AvatarUrl NVARCHAR(500) = NULL,
    @RegisteredByUserId NVARCHAR(50) = NULL,
    @RegisteredByName NVARCHAR(150) = 'Super Admin',
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Validation: Check duplicate Username
        IF EXISTS (SELECT 1 FROM [Auth].[Users] WHERE LOWER([Username]) = LOWER(@Username))
        BEGIN
            THROW 50001, 'Username is already registered in employee directory.', 1;
        END;

        -- 2. Validation: Check duplicate Corporate Email
        IF EXISTS (SELECT 1 FROM [Auth].[Users] WHERE LOWER([Email]) = LOWER(@Email))
        BEGIN
            THROW 50002, 'Corporate email address is already registered.', 1;
        END;

        -- 3. Validation: Check duplicate Employee ID
        IF EXISTS (SELECT 1 FROM [Auth].[Users] WHERE [EmployeeId] = @EmployeeId)
        BEGIN
            THROW 50003, 'Employee ID is already assigned to another account.', 1;
        END;

        -- 4. Validation: Verify Department exists (or fallback to first department)
        IF NOT EXISTS (SELECT 1 FROM [Organization].[Departments] WHERE [DepartmentId] = @DepartmentId)
        BEGIN
            SELECT TOP 1 @DepartmentId = [DepartmentId] FROM [Organization].[Departments];
            IF @DepartmentId IS NULL
            BEGIN
                -- Create default IT dept if missing
                SET @DepartmentId = 'dept-it';
                INSERT INTO [Organization].[Departments] ([DepartmentId], [Name], [Code], [Description])
                VALUES (@DepartmentId, 'Information Technology', 'IT', 'Internal IT Infrastructure');
            END;
        END;

        -- 5. Generate UserId if not provided
        IF @UserId IS NULL OR LTRIM(RTRIM(@UserId)) = ''
        BEGIN
            SET @UserId = 'usr-' + LOWER(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''));
        END;

        -- 6. Insert User Record
        INSERT INTO [Auth].[Users] (
            [UserId],
            [EmployeeId],
            [Username],
            [FullName],
            [Email],
            [PasswordHash],
            [DepartmentId],
            [JobTitle],
            [AvatarUrl],
            [Status],
            [LastSeen],
            [IsActive],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES (
            @UserId,
            @EmployeeId,
            LOWER(LTRIM(RTRIM(@Username))),
            LTRIM(RTRIM(@FullName)),
            LOWER(LTRIM(RTRIM(@Email))),
            @PasswordHash,
            @DepartmentId,
            LTRIM(RTRIM(@JobTitle)),
            @AvatarUrl,
            'offline',
            SYSUTCDATETIME(),
            1,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );

        -- 7. Assign User Role
        DECLARE @RoleId NVARCHAR(50);
        SELECT @RoleId = [RoleId] FROM [Auth].[Roles] WHERE [RoleName] = @RoleName;
        IF @RoleId IS NULL
        BEGIN
            -- Ensure role exists
            SET @RoleId = 'role-' + LOWER(REPLACE(@RoleName, ' ', '-'));
            IF NOT EXISTS (SELECT 1 FROM [Auth].[Roles] WHERE [RoleId] = @RoleId)
            BEGIN
                INSERT INTO [Auth].[Roles] ([RoleId], [RoleName], [Description])
                VALUES (@RoleId, @RoleName, @RoleName + ' access level');
            END;
        END;

        INSERT INTO [Auth].[UserRoles] ([UserRoleId], [UserId], [RoleId], [AssignedAt])
        VALUES ('ur-' + LOWER(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', '')), @UserId, @RoleId, SYSUTCDATETIME());

        -- 8. Auto-Enroll in General Announcement Channel
        DECLARE @GeneralConvId NVARCHAR(50) = 'conv-general';
        IF NOT EXISTS (SELECT 1 FROM [Chat].[Conversations] WHERE [ConversationId] = @GeneralConvId)
        BEGIN
            SELECT TOP 1 @GeneralConvId = [ConversationId] 
            FROM [Chat].[Conversations] 
            WHERE [Type] = 'group' AND ([Title] LIKE '%General%' OR [Title] LIKE '%Announcement%');
        END;

        IF @GeneralConvId IS NOT NULL AND EXISTS (SELECT 1 FROM [Chat].[Conversations] WHERE [ConversationId] = @GeneralConvId)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [Chat].[ConversationMembers] WHERE [ConversationId] = @GeneralConvId AND [UserId] = @UserId)
            BEGIN
                INSERT INTO [Chat].[ConversationMembers] (
                    [MemberId],
                    [ConversationId],
                    [UserId],
                    [Role],
                    [JoinedAt]
                )
                VALUES (
                    'cm-' + @GeneralConvId + '-' + @UserId,
                    @GeneralConvId,
                    @UserId,
                    CASE WHEN @RoleName IN ('Admin', 'Super Admin') THEN 'admin' ELSE 'member' END,
                    SYSUTCDATETIME()
                );
            END;
        END;

        -- 9. Record Immutable Audit Log
        DECLARE @AuditLogId NVARCHAR(50) = 'log-' + LOWER(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''));
        DECLARE @ActorUserId NVARCHAR(50) = ISNULL(@RegisteredByUserId, @UserId);

        INSERT INTO [Administration].[AuditLogs] (
            [LogId],
            [UserId],
            [UserName],
            [Action],
            [TargetResource],
            [Details],
            [IpAddress],
            [Timestamp]
        )
        VALUES (
            @AuditLogId,
            @ActorUserId,
            @RegisteredByName,
            'SUPER_USER_REGISTRATION',
            'User',
            'Super User registered new employee ' + @FullName + ' (' + @Username + ', ' + @RoleName + ') in department ' + @DepartmentId,
            @IpAddress,
            SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;

        -- 10. Return the Created User with Joined Details
        SELECT 
            u.[UserId] AS [id],
            u.[EmployeeId] AS [employeeId],
            u.[Username] AS [username],
            u.[FullName] AS [name],
            u.[Email] AS [email],
            u.[DepartmentId] AS [departmentId],
            d.[Name] AS [departmentName],
            u.[JobTitle] AS [jobTitle],
            @RoleName AS [role],
            u.[AvatarUrl] AS [avatarUrl],
            u.[Status] AS [status],
            u.[IsActive] AS [isActive],
            u.[CreatedAt] AS [createdAt],
            u.[UpdatedAt] AS [updatedAt]
        FROM [Auth].[Users] u
        LEFT JOIN [Organization].[Departments] d ON u.[DepartmentId] = d.[DepartmentId]
        WHERE u.[UserId] = @UserId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO

-- =========================================================================
-- 2. STORED PROCEDURE: Send & Store Chat Message
-- Schema: [Chat].[sp_CreateMessage]
-- Description: Idempotent message persistence, conversation timestamp update,
--              and enriched sender result query.
-- =========================================================================
CREATE OR ALTER PROCEDURE [Chat].[sp_CreateMessage]
    @MessageId NVARCHAR(50) = NULL,
    @ConversationId NVARCHAR(50),
    @SenderId NVARCHAR(50),
    @Content NVARCHAR(MAX),
    @IdempotencyId NVARCHAR(100) = NULL,
    @ReplyToMessageId NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        -- 1. Idempotency Check: return existing message if already inserted
        IF @IdempotencyId IS NOT NULL AND LTRIM(RTRIM(@IdempotencyId)) <> ''
        BEGIN
            DECLARE @ExistingMsgId NVARCHAR(50);
            SELECT @ExistingMsgId = [MessageId] 
            FROM [Chat].[Messages] 
            WHERE [ConversationId] = @ConversationId AND [IdempotencyId] = @IdempotencyId;

            IF @ExistingMsgId IS NOT NULL
            BEGIN
                SELECT 
                    m.[MessageId] AS [id],
                    m.[ConversationId] AS [conversationId],
                    m.[SenderId] AS [senderId],
                    u.[FullName] AS [senderName],
                    u.[AvatarUrl] AS [senderAvatar],
                    m.[Content] AS [content],
                    m.[IdempotencyId] AS [idempotencyId],
                    m.[ReplyToMessageId] AS [replyToMessageId],
                    m.[IsPinned] AS [isPinned],
                    m.[IsEdited] AS [isEdited],
                    m.[IsDeleted] AS [isDeleted],
                    m.[Status] AS [status],
                    m.[CreatedAt] AS [createdAt],
                    m.[UpdatedAt] AS [updatedAt]
                FROM [Chat].[Messages] m
                LEFT JOIN [Auth].[Users] u ON m.[SenderId] = u.[UserId]
                WHERE m.[MessageId] = @ExistingMsgId;
                RETURN;
            END;
        END;

        -- 2. Generate MessageId if not provided
        IF @MessageId IS NULL OR LTRIM(RTRIM(@MessageId)) = ''
        BEGIN
            SET @MessageId = 'msg-' + CAST(DATEDIFF_BIG(MILLISECOND, '1970-01-01', SYSUTCDATETIME()) AS NVARCHAR(30)) + '-' + LOWER(LEFT(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 6));
        END;

        BEGIN TRANSACTION;

        -- 3. Insert Message
        INSERT INTO [Chat].[Messages] (
            [MessageId],
            [ConversationId],
            [SenderId],
            [Content],
            [IdempotencyId],
            [ReplyToMessageId],
            [IsPinned],
            [IsEdited],
            [IsDeleted],
            [Status],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES (
            @MessageId,
            @ConversationId,
            @SenderId,
            @Content,
            @IdempotencyId,
            @ReplyToMessageId,
            0,
            0,
            0,
            'sent',
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );

        -- 4. Update Conversation UpdatedAt timestamp
        UPDATE [Chat].[Conversations]
        SET [UpdatedAt] = SYSUTCDATETIME()
        WHERE [ConversationId] = @ConversationId;

        COMMIT TRANSACTION;

        -- 5. Return Enriched Message Record
        SELECT 
            m.[MessageId] AS [id],
            m.[ConversationId] AS [conversationId],
            m.[SenderId] AS [senderId],
            u.[FullName] AS [senderName],
            u.[AvatarUrl] AS [senderAvatar],
            m.[Content] AS [content],
            m.[IdempotencyId] AS [idempotencyId],
            m.[ReplyToMessageId] AS [replyToMessageId],
            rm.[Content] AS [replyToPreview],
            ru.[FullName] AS [replyToSenderName],
            m.[IsPinned] AS [isPinned],
            m.[IsEdited] AS [isEdited],
            m.[IsDeleted] AS [isDeleted],
            m.[Status] AS [status],
            m.[CreatedAt] AS [createdAt],
            m.[UpdatedAt] AS [updatedAt]
        FROM [Chat].[Messages] m
        LEFT JOIN [Auth].[Users] u ON m.[SenderId] = u.[UserId]
        LEFT JOIN [Chat].[Messages] rm ON m.[ReplyToMessageId] = rm.[MessageId]
        LEFT JOIN [Auth].[Users] ru ON rm.[SenderId] = ru.[UserId]
        WHERE m.[MessageId] = @MessageId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        RAISERROR(@ErrMsg, @ErrSeverity, @ErrState);
    END CATCH;
END;
GO

-- =========================================================================
-- 3. STORED PROCEDURE: Create Conversation / Direct Chat / Team Group
-- Schema: [Chat].[sp_CreateConversation]
-- Description: Creates conversation, avoids duplicate 1-to-1 direct chats,
--              and registers members.
-- =========================================================================
CREATE OR ALTER PROCEDURE [Chat].[sp_CreateConversation]
    @ConversationId NVARCHAR(50) = NULL,
    @Type NVARCHAR(20), -- 'direct' or 'group'
    @Title NVARCHAR(150) = NULL,
    @Description NVARCHAR(500) = NULL,
    @AvatarUrl NVARCHAR(500) = NULL,
    @CreatedById NVARCHAR(50),
    @RecipientUserId NVARCHAR(50) = NULL -- Required if Type = 'direct'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        -- 1. Deduplication for 1-to-1 Direct Chats
        IF @Type = 'direct' AND @RecipientUserId IS NOT NULL
        BEGIN
            DECLARE @ExistingConvId NVARCHAR(50);
            SELECT TOP 1 @ExistingConvId = c.[ConversationId]
            FROM [Chat].[Conversations] c
            INNER JOIN [Chat].[ConversationMembers] m1 ON c.[ConversationId] = m1.[ConversationId] AND m1.[UserId] = @CreatedById
            INNER JOIN [Chat].[ConversationMembers] m2 ON c.[ConversationId] = m2.[ConversationId] AND m2.[UserId] = @RecipientUserId
            WHERE c.[Type] = 'direct';

            IF @ExistingConvId IS NOT NULL
            BEGIN
                SELECT 
                    c.[ConversationId] AS [id],
                    c.[Type] AS [type],
                    c.[Title] AS [title],
                    c.[Description] AS [description],
                    c.[AvatarUrl] AS [avatarUrl],
                    c.[CreatedById] AS [createdById],
                    c.[CreatedAt] AS [createdAt],
                    c.[UpdatedAt] AS [updatedAt]
                FROM [Chat].[Conversations] c
                WHERE c.[ConversationId] = @ExistingConvId;
                RETURN;
            END;
        END;

        -- 2. Generate ConversationId if not passed
        IF @ConversationId IS NULL OR LTRIM(RTRIM(@ConversationId)) = ''
        BEGIN
            SET @ConversationId = 'conv-' + CAST(DATEDIFF_BIG(MILLISECOND, '1970-01-01', SYSUTCDATETIME()) AS NVARCHAR(30)) + '-' + LOWER(LEFT(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 6));
        END;

        BEGIN TRANSACTION;

        -- 3. Insert Conversation
        INSERT INTO [Chat].[Conversations] (
            [ConversationId],
            [Type],
            [Title],
            [Description],
            [AvatarUrl],
            [CreatedById],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES (
            @ConversationId,
            @Type,
            @Title,
            @Description,
            @AvatarUrl,
            @CreatedById,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );

        -- 4. Add Creator as Admin/Member
        INSERT INTO [Chat].[ConversationMembers] (
            [MemberId],
            [ConversationId],
            [UserId],
            [Role],
            [JoinedAt]
        )
        VALUES (
            'cm-' + @ConversationId + '-' + @CreatedById,
            @ConversationId,
            @CreatedById,
            'admin',
            SYSUTCDATETIME()
        );

        -- 5. If Direct chat, add Recipient
        IF @Type = 'direct' AND @RecipientUserId IS NOT NULL
        BEGIN
            INSERT INTO [Chat].[ConversationMembers] (
                [MemberId],
                [ConversationId],
                [UserId],
                [Role],
                [JoinedAt]
            )
            VALUES (
                'cm-' + @ConversationId + '-' + @RecipientUserId,
                @ConversationId,
                @RecipientUserId,
                'member',
                SYSUTCDATETIME()
            );
        END;

        COMMIT TRANSACTION;

        -- 6. Return Conversation Result
        SELECT 
            c.[ConversationId] AS [id],
            c.[Type] AS [type],
            c.[Title] AS [title],
            c.[Description] AS [description],
            c.[AvatarUrl] AS [avatarUrl],
            c.[CreatedById] AS [createdById],
            c.[CreatedAt] AS [createdAt],
            c.[UpdatedAt] AS [updatedAt]
        FROM [Chat].[Conversations] c
        WHERE c.[ConversationId] = @ConversationId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        RAISERROR(@ErrMsg, @ErrSeverity, @ErrState);
    END CATCH;
END;
GO

-- =========================================================================
-- 4. STORED PROCEDURE: Toggle Message Emoji Reaction
-- Schema: [Chat].[sp_ToggleReaction]
-- Description: Toggles reaction (adds if missing, removes if existing).
-- =========================================================================
CREATE OR ALTER PROCEDURE [Chat].[sp_ToggleReaction]
    @MessageId NVARCHAR(50),
    @UserId NVARCHAR(50),
    @Emoji NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 FROM [Chat].[MessageReactions] 
        WHERE [MessageId] = @MessageId AND [UserId] = @UserId AND [Emoji] = @Emoji
    )
    BEGIN
        -- Remove reaction
        DELETE FROM [Chat].[MessageReactions] 
        WHERE [MessageId] = @MessageId AND [UserId] = @UserId AND [Emoji] = @Emoji;

        SELECT 'removed' AS [action], @MessageId AS [messageId], @UserId AS [userId], @Emoji AS [emoji];
    END
    ELSE
    BEGIN
        -- Add reaction
        DECLARE @ReactionId NVARCHAR(50) = 'rx-' + LOWER(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''));
        INSERT INTO [Chat].[MessageReactions] ([ReactionId], [MessageId], [UserId], [Emoji], [CreatedAt])
        VALUES (@ReactionId, @MessageId, @UserId, @Emoji, SYSUTCDATETIME());

        SELECT 'added' AS [action], @MessageId AS [messageId], @UserId AS [userId], @Emoji AS [emoji];
    END;
END;
GO

-- =========================================================================
-- 5. STORED PROCEDURE: Record Immutable Security Audit Log
-- Schema: [Administration].[sp_RecordAuditLog]
-- =========================================================================
CREATE OR ALTER PROCEDURE [Administration].[sp_RecordAuditLog]
    @LogId NVARCHAR(50) = NULL,
    @UserId NVARCHAR(50),
    @UserName NVARCHAR(150),
    @Action NVARCHAR(100),
    @TargetResource NVARCHAR(100),
    @Details NVARCHAR(MAX) = NULL,
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;

    IF @LogId IS NULL OR LTRIM(RTRIM(@LogId)) = ''
    BEGIN
        SET @LogId = 'log-' + CAST(DATEDIFF_BIG(MILLISECOND, '1970-01-01', SYSUTCDATETIME()) AS NVARCHAR(30)) + '-' + LOWER(LEFT(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 6));
    END;

    INSERT INTO [Administration].[AuditLogs] (
        [LogId],
        [UserId],
        [UserName],
        [Action],
        [TargetResource],
        [Details],
        [IpAddress],
        [Timestamp]
    )
    VALUES (
        @LogId,
        @UserId,
        @UserName,
        @Action,
        @TargetResource,
        @Details,
        @IpAddress,
        SYSUTCDATETIME()
    );

    SELECT 
        [LogId] AS [id],
        [UserId] AS [userId],
        [UserName] AS [userName],
        [Action] AS [action],
        [TargetResource] AS [targetResource],
        [Details] AS [details],
        [IpAddress] AS [ipAddress],
        [Timestamp] AS [timestamp]
    FROM [Administration].[AuditLogs]
    WHERE [LogId] = @LogId;
END;
GO

PRINT '✅ OfficeConnect Enterprise Stored Procedures installed successfully!';
