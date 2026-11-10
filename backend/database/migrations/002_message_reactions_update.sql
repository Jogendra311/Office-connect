-- =========================================================================
-- OfficeConnect Enterprise LAN Messaging Platform
-- Migration: 002_message_reactions_update.sql
-- Target: Microsoft SQL Server 2019 / 2022
-- Purpose: Schema upgrade, indexing, constraints and stored procedures for
--          Chat.MessageReactions with user-aggregated reaction summaries.
-- All Primary Keys and Foreign Keys are standardized to INTEGER (INT).
-- =========================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Ensure Table Chat.MessageReactions exists with all required columns
IF OBJECT_ID('[Chat].[MessageReactions]', 'U') IS NULL
BEGIN
    CREATE TABLE [Chat].[MessageReactions] (
        [ReactionId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MessageId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Emoji] NVARCHAR(20) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_MessageReactions_Messages] FOREIGN KEY ([MessageId]) 
            REFERENCES [Chat].[Messages]([MessageId]) ON DELETE CASCADE,
        CONSTRAINT [FK_MessageReactions_Users] FOREIGN KEY ([UserId]) 
            REFERENCES [Auth].[Users]([UserId]),
        CONSTRAINT [UQ_MessageReactions_User_Msg_Emoji] UNIQUE ([MessageId], [UserId], [Emoji])
    );
END
GO

-- 2. Performance Indexes for Real-Time Querying & Aggregation
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[Chat].[MessageReactions]') AND name = 'IX_MessageReactions_MessageId')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_MessageReactions_MessageId] 
    ON [Chat].[MessageReactions] ([MessageId])
    INCLUDE ([UserId], [Emoji], [CreatedAt]);
END;
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[Chat].[MessageReactions]') AND name = 'IX_MessageReactions_User_Message')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_MessageReactions_User_Message] 
    ON [Chat].[MessageReactions] ([UserId], [MessageId])
    INCLUDE ([Emoji]);
END;
GO

-- 3. Stored Procedure: Atomic Reaction Toggle with Summary
CREATE OR ALTER PROCEDURE [Chat].[sp_ToggleMessageReaction]
    @MessageId INT,
    @UserId INT,
    @Emoji NVARCHAR(20),
    @ActionType NVARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- Check if reaction already exists
    DECLARE @ExistingReactionId INT = NULL;

    SELECT @ExistingReactionId = [ReactionId]
    FROM [Chat].[MessageReactions] WITH (UPDLOCK, HOLDLOCK)
    WHERE [MessageId] = @MessageId 
      AND [UserId] = @UserId 
      AND [Emoji] = @Emoji;

    IF @ExistingReactionId IS NOT NULL
    BEGIN
        -- Remove reaction
        DELETE FROM [Chat].[MessageReactions]
        WHERE [ReactionId] = @ExistingReactionId;

        SET @ActionType = 'REMOVED';
    END
    ELSE
    BEGIN
        -- Add reaction with IDENTITY auto-generation
        INSERT INTO [Chat].[MessageReactions] ([MessageId], [UserId], [Emoji], [CreatedAt])
        VALUES (@MessageId, @UserId, @Emoji, SYSUTCDATETIME());

        SET @ActionType = 'ADDED';
    END

    COMMIT TRANSACTION;

    -- Return updated reaction summary for this message
    SELECT 
        r.[Emoji],
        COUNT(*) AS [Count],
        MAX(CASE WHEN r.[UserId] = @UserId THEN 1 ELSE 0 END) AS [ReactedByCurrentUser],
        STRING_AGG(u.[FullName], ', ') WITHIN GROUP (ORDER BY r.[CreatedAt]) AS [ReactedByUsers]
    FROM [Chat].[MessageReactions] r
    INNER JOIN [Auth].[Users] u ON r.[UserId] = u.[UserId]
    WHERE r.[MessageId] = @MessageId
    GROUP BY r.[Emoji];
END;
GO

-- 4. Stored Procedure: Get Message Reactions Summary
CREATE OR ALTER PROCEDURE [Chat].[sp_GetMessageReactionsSummary]
    @MessageId INT,
    @CurrentUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        r.[Emoji],
        COUNT(*) AS [Count],
        MAX(CASE WHEN r.[UserId] = @CurrentUserId THEN 1 ELSE 0 END) AS [ReactedByCurrentUser],
        STRING_AGG(u.[FullName], ', ') WITHIN GROUP (ORDER BY r.[CreatedAt]) AS [ReactedByUsers]
    FROM [Chat].[MessageReactions] r
    INNER JOIN [Auth].[Users] u ON r.[UserId] = u.[UserId]
    WHERE r.[MessageId] = @MessageId
    GROUP BY r.[Emoji];
END;
GO
