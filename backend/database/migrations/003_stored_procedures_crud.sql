-- =========================================================================
-- OfficeConnect Enterprise LAN Messaging Platform - Master CRUD Stored Procedures
-- Target: Microsoft SQL Server 2019 / 2022 / Azure SQL
-- Purpose: Complete CRUD Stored Procedures with all Primary and Foreign
--          Keys standardized to INTEGER (INT).
-- =========================================================================

-- Ensure required schemas exist
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Auth') EXEC('CREATE SCHEMA [Auth]');
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Organization') EXEC('CREATE SCHEMA [Organization]');
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Chat') EXEC('CREATE SCHEMA [Chat]');
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Administration') EXEC('CREATE SCHEMA [Administration]');
GO

-- =========================================================================
-- SECTION 1: AUTHENTICATION & LOGIN CRUD
-- =========================================================================

-- 1.1 SP: User Login Lookup & Session Init (READ & UPDATE)
CREATE OR ALTER PROCEDURE [Auth].[sp_LoginUser]
    @UsernameOrEmail NVARCHAR(150),
    @ClientIp NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    DECLARE @IsActive BIT;

    -- Lookup user
    SELECT TOP 1 
        @UserId = u.[UserId],
        @IsActive = u.[IsActive]
    FROM [Auth].[Users] u
    WHERE LOWER(u.[Username]) = LOWER(LTRIM(RTRIM(@UsernameOrEmail)))
       OR LOWER(u.[Email]) = LOWER(LTRIM(RTRIM(@UsernameOrEmail)));

    IF @UserId IS NULL
    BEGIN
        -- Log failed login attempt
        INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
        VALUES (0, @UsernameOrEmail, 'FAILED_LOGIN', 'Auth', 'User not found in directory', @ClientIp, SYSUTCDATETIME());

        SELECT NULL AS [UserId], 'User not found' AS [ErrorMessage];
        RETURN;
    END;

    IF @IsActive = 0
    BEGIN
        SELECT NULL AS [UserId], 'Account is deactivated' AS [ErrorMessage];
        RETURN;
    END;

    -- Update last seen & online status
    UPDATE [Auth].[Users]
    SET [Status] = 'online',
        [LastSeen] = SYSUTCDATETIME(),
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    -- Record successful login audit log
    INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
    SELECT 
        u.[UserId],
        u.[FullName],
        'USER_LOGIN',
        'Auth',
        'Successful authentication on LAN (' + @ClientIp + ')',
        @ClientIp,
        SYSUTCDATETIME()
    FROM [Auth].[Users] u
    WHERE u.[UserId] = @UserId;

    -- Return full user record with role and department
    SELECT 
        u.[UserId] AS [id],
        u.[EmployeeId] AS [employeeId],
        u.[Username] AS [username],
        u.[FullName] AS [name],
        u.[Email] AS [email],
        u.[PasswordHash] AS [passwordHash],
        ISNULL(r.[RoleName], 'Employee') AS [role],
        u.[DepartmentId] AS [departmentId],
        ISNULL(d.[Name], 'General') AS [departmentName],
        u.[JobTitle] AS [jobTitle],
        u.[AvatarUrl] AS [avatarUrl],
        u.[Status] AS [status],
        u.[LastSeen] AS [lastSeen],
        u.[IsActive] AS [isActive],
        u.[CreatedAt] AS [createdAt],
        u.[UpdatedAt] AS [updatedAt]
    FROM [Auth].[Users] u
    LEFT JOIN [Auth].[UserRoles] ur ON u.[UserId] = ur.[UserId]
    LEFT JOIN [Auth].[Roles] r ON ur.[RoleId] = r.[RoleId]
    LEFT JOIN [Organization].[Departments] d ON u.[DepartmentId] = d.[DepartmentId]
    WHERE u.[UserId] = @UserId;
END;
GO

-- 1.2 SP: Get User Profile (READ)
CREATE OR ALTER PROCEDURE [Auth].[sp_GetUserProfile]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        u.[UserId] AS [id],
        u.[EmployeeId] AS [employeeId],
        u.[Username] AS [username],
        u.[FullName] AS [name],
        u.[Email] AS [email],
        ISNULL(r.[RoleName], 'Employee') AS [role],
        u.[DepartmentId] AS [departmentId],
        ISNULL(d.[Name], 'General') AS [departmentName],
        u.[JobTitle] AS [jobTitle],
        u.[AvatarUrl] AS [avatarUrl],
        u.[Status] AS [status],
        u.[LastSeen] AS [lastSeen],
        u.[IsActive] AS [isActive],
        u.[CreatedAt] AS [createdAt],
        u.[UpdatedAt] AS [updatedAt]
    FROM [Auth].[Users] u
    LEFT JOIN [Auth].[UserRoles] ur ON u.[UserId] = ur.[UserId]
    LEFT JOIN [Auth].[Roles] r ON ur.[RoleId] = r.[RoleId]
    LEFT JOIN [Organization].[Departments] d ON u.[DepartmentId] = d.[DepartmentId]
    WHERE u.[UserId] = @UserId;
END;
GO

-- 1.3 SP: Update User Status (UPDATE)
CREATE OR ALTER PROCEDURE [Auth].[sp_UpdateUserStatus]
    @UserId INT,
    @Status NVARCHAR(20) -- 'online', 'away', 'busy', 'offline'
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [Auth].[Users]
    SET [Status] = @Status,
        [LastSeen] = SYSUTCDATETIME(),
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    SELECT @UserId AS [userId], @Status AS [status], SYSUTCDATETIME() AS [lastSeen];
END;
GO

-- 1.4 SP: Update User Profile (UPDATE)
CREATE OR ALTER PROCEDURE [Auth].[sp_UpdateUserProfile]
    @UserId INT,
    @FullName NVARCHAR(150) = NULL,
    @JobTitle NVARCHAR(100) = NULL,
    @AvatarUrl NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [Auth].[Users]
    SET [FullName] = ISNULL(@FullName, [FullName]),
        [JobTitle] = ISNULL(@JobTitle, [JobTitle]),
        [AvatarUrl] = ISNULL(@AvatarUrl, [AvatarUrl]),
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    EXEC [Auth].[sp_GetUserProfile] @UserId = @UserId;
END;
GO

-- 1.5 SP: Revoke All Tokens / Logout (DELETE/REVOKE)
CREATE OR ALTER PROCEDURE [Auth].[sp_RevokeUserTokens]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [Auth].[RefreshTokens]
    SET [IsRevoked] = 1
    WHERE [UserId] = @UserId;

    UPDATE [Auth].[Users]
    SET [Status] = 'offline',
        [LastSeen] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    SELECT @UserId AS [userId], 'Tokens revoked successfully' AS [message];
END;
GO

-- =========================================================================
-- SECTION 2: EMPLOYEE REGISTRATION & DIRECTORY MANAGEMENT CRUD
-- =========================================================================

-- 2.1 SP: Register New Employee (CREATE - Transactional with General Channel Auto-Enrollment)
CREATE OR ALTER PROCEDURE [Auth].[sp_RegisterEmployee]
    @EmployeeId INT,
    @Username NVARCHAR(50),
    @FullName NVARCHAR(150),
    @Email NVARCHAR(150),
    @PasswordHash NVARCHAR(255),
    @RoleName NVARCHAR(50) = 'Employee',
    @DepartmentId INT = 1,
    @JobTitle NVARCHAR(100),
    @AvatarUrl NVARCHAR(500) = NULL,
    @RegisteredByUserId INT = NULL,
    @RegisteredByName NVARCHAR(150) = 'Super Admin',
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Validation: Check duplicate Username
        IF EXISTS (SELECT 1 FROM [Auth].[Users] WHERE LOWER([Username]) = LOWER(LTRIM(RTRIM(@Username))))
            THROW 50001, 'Username is already registered in employee directory.', 1;

        -- 2. Validation: Check duplicate Corporate Email
        IF EXISTS (SELECT 1 FROM [Auth].[Users] WHERE LOWER([Email]) = LOWER(LTRIM(RTRIM(@Email))))
            THROW 50002, 'Corporate email address is already registered.', 1;

        -- 3. Validation: Check duplicate Employee ID
        IF EXISTS (SELECT 1 FROM [Auth].[Users] WHERE [EmployeeId] = @EmployeeId)
            THROW 50003, 'Employee ID is already assigned to another account.', 1;

        -- 4. Check or fallback Department
        IF NOT EXISTS (SELECT 1 FROM [Organization].[Departments] WHERE [DepartmentId] = @DepartmentId)
        BEGIN
            SELECT TOP 1 @DepartmentId = [DepartmentId] FROM [Organization].[Departments];
            IF @DepartmentId IS NULL
            BEGIN
                INSERT INTO [Organization].[Departments] ([Name], [Code], [Description])
                VALUES ('Information Technology', 'IT', 'Internal IT Infrastructure');
                SET @DepartmentId = SCOPE_IDENTITY();
            END;
        END;

        -- 5. Insert User Record (UserId generated via IDENTITY)
        INSERT INTO [Auth].[Users] (
            [EmployeeId], [Username], [FullName], [Email],
            [PasswordHash], [DepartmentId], [JobTitle], [AvatarUrl],
            [Status], [LastSeen], [IsActive], [CreatedAt], [UpdatedAt]
        )
        VALUES (
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

        DECLARE @NewUserId INT = SCOPE_IDENTITY();

        -- 6. Assign User Role
        DECLARE @RoleId INT;
        SELECT @RoleId = [RoleId] FROM [Auth].[Roles] WHERE [RoleName] = @RoleName;
        IF @RoleId IS NULL
        BEGIN
            INSERT INTO [Auth].[Roles] ([RoleName], [Description])
            VALUES (@RoleName, @RoleName + ' role');
            SET @RoleId = SCOPE_IDENTITY();
        END;

        INSERT INTO [Auth].[UserRoles] ([UserId], [RoleId], [AssignedAt])
        VALUES (@NewUserId, @RoleId, SYSUTCDATETIME());

        -- 7. Auto-Enroll in General Announcement Channel (ConversationId = 1 or first group)
        DECLARE @GeneralConvId INT = 1;
        IF NOT EXISTS (SELECT 1 FROM [Chat].[Conversations] WHERE [ConversationId] = @GeneralConvId)
        BEGIN
            SELECT TOP 1 @GeneralConvId = [ConversationId] 
            FROM [Chat].[Conversations] 
            WHERE [Type] = 'group' AND ([Title] LIKE '%General%' OR [Title] LIKE '%Announcement%');
        END;

        IF @GeneralConvId IS NOT NULL AND EXISTS (SELECT 1 FROM [Chat].[Conversations] WHERE [ConversationId] = @GeneralConvId)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [Chat].[ConversationMembers] WHERE [ConversationId] = @GeneralConvId AND [UserId] = @NewUserId)
            BEGIN
                INSERT INTO [Chat].[ConversationMembers] ([ConversationId], [UserId], [Role], [JoinedAt])
                VALUES (@GeneralConvId, @NewUserId, CASE WHEN @RoleName IN ('Admin', 'Super Admin') THEN 'admin' ELSE 'member' END, SYSUTCDATETIME());
            END;
        END;

        -- 8. Record Immutable Audit Log
        INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
        VALUES (
            ISNULL(@RegisteredByUserId, @NewUserId),
            @RegisteredByName,
            'SUPER_USER_REGISTRATION',
            'User',
            'Super User registered employee ' + @FullName + ' (' + @Username + ', ' + @RoleName + ') in department ' + CAST(@DepartmentId AS NVARCHAR(10)),
            @IpAddress,
            SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;

        -- 9. Return Created User Record
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
        WHERE u.[UserId] = @NewUserId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 2.2 SP: Get All Employees (READ)
CREATE OR ALTER PROCEDURE [Auth].[sp_GetAllEmployees]
    @ActiveOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        u.[UserId] AS [id],
        u.[EmployeeId] AS [employeeId],
        u.[Username] AS [username],
        u.[FullName] AS [name],
        u.[Email] AS [email],
        ISNULL(r.[RoleName], 'Employee') AS [role],
        u.[DepartmentId] AS [departmentId],
        ISNULL(d.[Name], 'General') AS [departmentName],
        u.[JobTitle] AS [jobTitle],
        u.[AvatarUrl] AS [avatarUrl],
        u.[Status] AS [status],
        u.[LastSeen] AS [lastSeen],
        u.[IsActive] AS [isActive],
        u.[CreatedAt] AS [createdAt],
        u.[UpdatedAt] AS [updatedAt]
    FROM [Auth].[Users] u
    LEFT JOIN [Auth].[UserRoles] ur ON u.[UserId] = ur.[UserId]
    LEFT JOIN [Auth].[Roles] r ON ur.[RoleId] = r.[RoleId]
    LEFT JOIN [Organization].[Departments] d ON u.[DepartmentId] = d.[DepartmentId]
    WHERE (@ActiveOnly = 0 OR u.[IsActive] = 1)
    ORDER BY u.[FullName] ASC;
END;
GO

-- 2.3 SP: Update Employee Active Status (UPDATE - Activate/Deactivate)
CREATE OR ALTER PROCEDURE [Auth].[sp_UpdateEmployeeStatus]
    @TargetUserId INT,
    @IsActive BIT,
    @AdminUserId INT,
    @AdminName NVARCHAR(150),
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;

    IF @TargetUserId = @AdminUserId
        THROW 50004, 'Administrators cannot deactivate their own account.', 1;

    UPDATE [Auth].[Users]
    SET [IsActive] = @IsActive,
        [Status] = CASE WHEN @IsActive = 0 THEN 'offline' ELSE [Status] END,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @TargetUserId;

    IF @IsActive = 0
    BEGIN
        UPDATE [Auth].[RefreshTokens]
        SET [IsRevoked] = 1
        WHERE [UserId] = @TargetUserId;
    END;

    INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
    VALUES (
        @AdminUserId,
        @AdminName,
        CASE WHEN @IsActive = 1 THEN 'ACTIVATE_EMPLOYEE' ELSE 'DEACTIVATE_EMPLOYEE' END,
        'User',
        'Changed active state to ' + CAST(@IsActive AS NVARCHAR(1)) + ' for user ' + CAST(@TargetUserId AS NVARCHAR(10)),
        @IpAddress,
        SYSUTCDATETIME()
    );

    EXEC [Auth].[sp_GetUserProfile] @UserId = @TargetUserId;
END;
GO

-- 2.4 SP: Update Employee Role (UPDATE)
CREATE OR ALTER PROCEDURE [Auth].[sp_UpdateEmployeeRole]
    @TargetUserId INT,
    @NewRoleName NVARCHAR(50),
    @AdminUserId INT,
    @AdminName NVARCHAR(150),
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT;
    SELECT @RoleId = [RoleId] FROM [Auth].[Roles] WHERE [RoleName] = @NewRoleName;

    IF @RoleId IS NULL
    BEGIN
        INSERT INTO [Auth].[Roles] ([RoleName], [Description])
        VALUES (@NewRoleName, @NewRoleName + ' role');
        SET @RoleId = SCOPE_IDENTITY();
    END;

    MERGE [Auth].[UserRoles] AS target
    USING (SELECT @TargetUserId AS [UserId], @RoleId AS [RoleId]) AS source
    ON (target.[UserId] = source.[UserId])
    WHEN MATCHED THEN
        UPDATE SET [RoleId] = source.[RoleId], [AssignedAt] = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT ([UserId], [RoleId], [AssignedAt])
        VALUES (source.[UserId], source.[RoleId], SYSUTCDATETIME());

    UPDATE [Auth].[Users]
    SET [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @TargetUserId;

    INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
    VALUES (
        @AdminUserId,
        @AdminName,
        'CHANGE_EMPLOYEE_ROLE',
        'User',
        'Promoted/Modified role to ' + @NewRoleName + ' for user ' + CAST(@TargetUserId AS NVARCHAR(10)),
        @IpAddress,
        SYSUTCDATETIME()
    );

    EXEC [Auth].[sp_GetUserProfile] @UserId = @TargetUserId;
END;
GO

-- 2.5 SP: Delete / Soft Delete Employee (DELETE)
CREATE OR ALTER PROCEDURE [Auth].[sp_DeleteEmployee]
    @TargetUserId INT,
    @AdminUserId INT,
    @AdminName NVARCHAR(150),
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [Auth].[Users]
    SET [IsActive] = 0,
        [Status] = 'offline',
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @TargetUserId;

    UPDATE [Auth].[RefreshTokens]
    SET [IsRevoked] = 1
    WHERE [UserId] = @TargetUserId;

    INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
    VALUES (
        @AdminUserId,
        @AdminName,
        'DELETE_EMPLOYEE',
        'User',
        'Soft-deleted and deactivated employee account ' + CAST(@TargetUserId AS NVARCHAR(10)),
        @IpAddress,
        SYSUTCDATETIME()
    );

    SELECT @TargetUserId AS [userId], 'Employee deactivated and removed from active roster' AS [message];
END;
GO

-- =========================================================================
-- SECTION 3: CONVERSATIONS & CHANNELS CRUD
-- =========================================================================

-- 3.1 SP: Create Conversation (CREATE - Direct with 1-to-1 Deduplication, or Group)
CREATE OR ALTER PROCEDURE [Chat].[sp_CreateConversation]
    @Type NVARCHAR(20), -- 'direct' or 'group'
    @Title NVARCHAR(150) = NULL,
    @Description NVARCHAR(500) = NULL,
    @AvatarUrl NVARCHAR(500) = NULL,
    @CreatedById INT,
    @RecipientUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        -- Check deduplication for 1-to-1 direct chats
        IF @Type = 'direct' AND @RecipientUserId IS NOT NULL
        BEGIN
            DECLARE @ExistingConvId INT;
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

        BEGIN TRANSACTION;

        INSERT INTO [Chat].[Conversations] ([Type], [Title], [Description], [AvatarUrl], [CreatedById], [CreatedAt], [UpdatedAt])
        VALUES (@Type, @Title, @Description, @AvatarUrl, @CreatedById, SYSUTCDATETIME(), SYSUTCDATETIME());

        DECLARE @NewConvId INT = SCOPE_IDENTITY();

        -- Creator is admin
        INSERT INTO [Chat].[ConversationMembers] ([ConversationId], [UserId], [Role], [JoinedAt])
        VALUES (@NewConvId, @CreatedById, 'admin', SYSUTCDATETIME());

        -- Add recipient if direct chat
        IF @Type = 'direct' AND @RecipientUserId IS NOT NULL
        BEGIN
            INSERT INTO [Chat].[ConversationMembers] ([ConversationId], [UserId], [Role], [JoinedAt])
            VALUES (@NewConvId, @RecipientUserId, 'member', SYSUTCDATETIME());
        END;

        COMMIT TRANSACTION;

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
        WHERE c.[ConversationId] = @NewConvId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 3.2 SP: Get User Conversations (READ - with unread counts and latest message)
CREATE OR ALTER PROCEDURE [Chat].[sp_GetUserConversations]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        c.[ConversationId] AS [id],
        c.[Type] AS [type],
        CASE 
            WHEN c.[Type] = 'direct' THEN otherUser.[FullName]
            ELSE c.[Title]
        END AS [title],
        c.[Description] AS [description],
        CASE 
            WHEN c.[Type] = 'direct' THEN otherUser.[AvatarUrl]
            ELSE c.[AvatarUrl]
        END AS [avatarUrl],
        c.[CreatedById] AS [createdById],
        c.[CreatedAt] AS [createdAt],
        c.[UpdatedAt] AS [updatedAt],
        lastMsg.[Content] AS [lastMessageContent],
        lastMsg.[CreatedAt] AS [lastMessageCreatedAt],
        lastMsgSender.[FullName] AS [lastMessageSenderName],
        (
            SELECT COUNT(1)
            FROM [Chat].[Messages] m
            LEFT JOIN [Chat].[MessageReceipts] mr ON m.[MessageId] = mr.[MessageId] AND mr.[UserId] = @UserId AND mr.[Status] = 'read'
            WHERE m.[ConversationId] = c.[ConversationId] 
              AND m.[SenderId] <> @UserId 
              AND mr.[ReceiptId] IS NULL
        ) AS [unreadCount]
    FROM [Chat].[Conversations] c
    INNER JOIN [Chat].[ConversationMembers] cm ON c.[ConversationId] = cm.[ConversationId] AND cm.[UserId] = @UserId
    OUTER APPLY (
        SELECT TOP 1 u.[FullName], u.[AvatarUrl]
        FROM [Chat].[ConversationMembers] otherCm
        INNER JOIN [Auth].[Users] u ON otherCm.[UserId] = u.[UserId]
        WHERE otherCm.[ConversationId] = c.[ConversationId] AND otherCm.[UserId] <> @UserId
    ) otherUser
    OUTER APPLY (
        SELECT TOP 1 m.[Content], m.[CreatedAt], m.[SenderId]
        FROM [Chat].[Messages] m
        WHERE m.[ConversationId] = c.[ConversationId] AND m.[IsDeleted] = 0
        ORDER BY m.[CreatedAt] DESC
    ) lastMsg
    LEFT JOIN [Auth].[Users] lastMsgSender ON lastMsg.[SenderId] = lastMsgSender.[UserId]
    ORDER BY c.[UpdatedAt] DESC;
END;
GO

-- 3.3 SP: Add Conversation Member (CREATE - Join Channel)
CREATE OR ALTER PROCEDURE [Chat].[sp_AddConversationMember]
    @ConversationId INT,
    @UserId INT,
    @Role NVARCHAR(20) = 'member'
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [Chat].[ConversationMembers] WHERE [ConversationId] = @ConversationId AND [UserId] = @UserId)
    BEGIN
        INSERT INTO [Chat].[ConversationMembers] ([ConversationId], [UserId], [Role], [JoinedAt])
        VALUES (@ConversationId, @UserId, @Role, SYSUTCDATETIME());
    END;

    SELECT @ConversationId AS [conversationId], @UserId AS [userId], @Role AS [role], 'Joined channel' AS [status];
END;
GO

-- 3.4 SP: Remove Conversation Member / Leave Channel (DELETE)
CREATE OR ALTER PROCEDURE [Chat].[sp_RemoveConversationMember]
    @ConversationId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM [Chat].[ConversationMembers]
    WHERE [ConversationId] = @ConversationId AND [UserId] = @UserId;

    SELECT @ConversationId AS [conversationId], @UserId AS [userId], 'Removed from channel' AS [status];
END;
GO

-- =========================================================================
-- SECTION 4: CHAT MESSAGES CRUD
-- =========================================================================

-- 4.1 SP: Create Message (CREATE - Idempotent, Touches Conversation, Returns Enriched Message)
CREATE OR ALTER PROCEDURE [Chat].[sp_CreateMessage]
    @ConversationId INT,
    @SenderId INT,
    @Content NVARCHAR(MAX),
    @IdempotencyId INT = NULL,
    @ReplyToMessageId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        -- Idempotency Check: if already inserted, return existing message without re-inserting
        IF @IdempotencyId IS NOT NULL
        BEGIN
            DECLARE @ExistingMsgId INT;
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

        BEGIN TRANSACTION;

        INSERT INTO [Chat].[Messages] (
            [ConversationId], [SenderId], [Content],
            [IdempotencyId], [ReplyToMessageId], [IsPinned], [IsEdited],
            [IsDeleted], [Status], [CreatedAt], [UpdatedAt]
        )
        VALUES (
            @ConversationId, @SenderId, @Content,
            @IdempotencyId, @ReplyToMessageId, 0, 0, 0, 'sent',
            SYSUTCDATETIME(), SYSUTCDATETIME()
        );

        DECLARE @NewMsgId INT = SCOPE_IDENTITY();

        -- Touch Conversation UpdatedAt
        UPDATE [Chat].[Conversations]
        SET [UpdatedAt] = SYSUTCDATETIME()
        WHERE [ConversationId] = @ConversationId;

        COMMIT TRANSACTION;

        -- Return enriched message
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
        WHERE m.[MessageId] = @NewMsgId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.2 SP: Get Messages by Conversation (READ - Cursor Pagination)
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
        SELECT @CursorCreatedAt = [CreatedAt] FROM [Chat].[Messages] WHERE [MessageId] = @CursorMessageId;
    END;

    ;WITH OrderedMessages AS (
        SELECT TOP (@Limit + 1)
            m.[MessageId] AS [id],
            m.[ConversationId] AS [conversationId],
            m.[SenderId] AS [senderId],
            u.[FullName] AS [senderName],
            u.[AvatarUrl] AS [senderAvatar],
            CASE WHEN m.[IsDeleted] = 1 THEN 'This message was deleted' ELSE m.[Content] END AS [content],
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
        WHERE m.[ConversationId] = @ConversationId
          AND (@CursorCreatedAt IS NULL OR m.[CreatedAt] < @CursorCreatedAt)
        ORDER BY m.[CreatedAt] DESC
    )
    SELECT * FROM OrderedMessages
    ORDER BY [createdAt] ASC;
END;
GO

-- 4.3 SP: Update Message Content (UPDATE - Edit Message)
CREATE OR ALTER PROCEDURE [Chat].[sp_UpdateMessageContent]
    @MessageId INT,
    @SenderId INT,
    @NewContent NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [Chat].[Messages] WHERE [MessageId] = @MessageId AND [SenderId] = @SenderId)
        THROW 50005, 'Unauthorized or message not found.', 1;

    UPDATE [Chat].[Messages]
    SET [Content] = @NewContent,
        [IsEdited] = 1,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [MessageId] = @MessageId;

    SELECT 
        m.[MessageId] AS [id],
        m.[ConversationId] AS [conversationId],
        m.[Content] AS [content],
        m.[IsEdited] AS [isEdited],
        m.[UpdatedAt] AS [updatedAt]
    FROM [Chat].[Messages] m
    WHERE m.[MessageId] = @MessageId;
END;
GO

-- 4.4 SP: Delete Message (DELETE / Soft-Delete)
CREATE OR ALTER PROCEDURE [Chat].[sp_DeleteMessage]
    @MessageId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1 FROM [Chat].[Messages] m
        LEFT JOIN [Auth].[UserRoles] ur ON ur.[UserId] = @UserId
        LEFT JOIN [Auth].[Roles] r ON ur.[RoleId] = r.[RoleId]
        WHERE m.[MessageId] = @MessageId AND (m.[SenderId] = @UserId OR r.[RoleName] IN ('Super Admin', 'Admin'))
    )
        THROW 50006, 'Unauthorized to delete this message.', 1;

    UPDATE [Chat].[Messages]
    SET [IsDeleted] = 1,
        [Content] = 'This message was deleted',
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [MessageId] = @MessageId;

    SELECT @MessageId AS [id], 1 AS [isDeleted], 'This message was deleted' AS [content];
END;
GO

-- 4.5 SP: Toggle Emoji Reaction (CREATE/DELETE)
CREATE OR ALTER PROCEDURE [Chat].[sp_ToggleReaction]
    @MessageId INT,
    @UserId INT,
    @Emoji NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM [Chat].[MessageReactions] WHERE [MessageId] = @MessageId AND [UserId] = @UserId AND [Emoji] = @Emoji)
    BEGIN
        DELETE FROM [Chat].[MessageReactions] WHERE [MessageId] = @MessageId AND [UserId] = @UserId AND [Emoji] = @Emoji;
        SELECT 'removed' AS [action], @MessageId AS [messageId], @UserId AS [userId], @Emoji AS [emoji];
    END
    ELSE
    BEGIN
        INSERT INTO [Chat].[MessageReactions] ([MessageId], [UserId], [Emoji], [CreatedAt])
        VALUES (@MessageId, @UserId, @Emoji, SYSUTCDATETIME());

        SELECT 'added' AS [action], @MessageId AS [messageId], @UserId AS [userId], @Emoji AS [emoji];
    END;
END;
GO

-- 4.6 SP: Toggle Pin Message (UPDATE)
CREATE OR ALTER PROCEDURE [Chat].[sp_TogglePinMessage]
    @MessageId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentPinned BIT;
    SELECT @CurrentPinned = [IsPinned] FROM [Chat].[Messages] WHERE [MessageId] = @MessageId;

    IF @CurrentPinned IS NULL
        THROW 50007, 'Message not found', 1;

    DECLARE @NewPinned BIT = 1 - @CurrentPinned;

    UPDATE [Chat].[Messages]
    SET [IsPinned] = @NewPinned,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [MessageId] = @MessageId;

    SELECT @MessageId AS [id], @NewPinned AS [isPinned];
END;
GO

-- =========================================================================
-- SECTION 5: SECURITY AUDIT LOGGING CRUD
-- =========================================================================

-- 5.1 SP: Record Security Audit Log (CREATE)
CREATE OR ALTER PROCEDURE [Administration].[sp_RecordAuditLog]
    @UserId INT,
    @UserName NVARCHAR(150),
    @Action NVARCHAR(100),
    @TargetResource NVARCHAR(100),
    @Details NVARCHAR(MAX) = NULL,
    @IpAddress NVARCHAR(50) = '127.0.0.1'
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [Administration].[AuditLogs] ([UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp])
    VALUES (@UserId, @UserName, @Action, @TargetResource, @Details, @IpAddress, SYSUTCDATETIME());

    DECLARE @NewLogId INT = SCOPE_IDENTITY();

    SELECT [LogId] AS [id], [UserId] AS [userId], [UserName] AS [userName], [Action] AS [action], [TargetResource] AS [targetResource], [Details] AS [details], [IpAddress] AS [ipAddress], [Timestamp] AS [timestamp]
    FROM [Administration].[AuditLogs]
    WHERE [LogId] = @NewLogId;
END;
GO

-- 5.2 SP: Get Security Audit Logs (READ)
CREATE OR ALTER PROCEDURE [Administration].[sp_GetAuditLogs]
    @Limit INT = 200
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@Limit)
        [LogId] AS [id],
        [UserId] AS [userId],
        [UserName] AS [userName],
        [Action] AS [action],
        [TargetResource] AS [targetResource],
        [Details] AS [details],
        [IpAddress] AS [ipAddress],
        [Timestamp] AS [timestamp]
    FROM [Administration].[AuditLogs]
    ORDER BY [Timestamp] DESC;
END;
GO

PRINT '✅ OfficeConnect Enterprise Master CRUD Stored Procedures compiled & installed successfully with integer (INT) IDs!';
