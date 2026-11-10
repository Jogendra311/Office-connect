# OfficeConnect - Backend API & WebSocket Server

Standalone enterprise backend for the OfficeConnect LAN Chat & Collaboration Platform. Built with Express, TypeScript, Socket.IO, and Microsoft SQL Server with complete CRUD Stored Procedures.

---

## 🚀 Quick Start (Running Standalone)

### 1. Install Dependencies
```bash
cd backend
npm install
```
  

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your local or LAN parameters:
```bash
cp .env.example .env
```

Key variables in `.env`:
```env
PORT=5000
SERVER_IP=10.1.60.8
LAN_SUBNET=10.1.60.0/24
CORS_ORIGIN=http://localhost:3000,http://10.1.60.8:3000

# Microsoft SQL Server
DB_SERVER=10.1.60.8
DB_PORT=1433
DB_DATABASE=OfficeConnect
DB_USER=sa
DB_PASSWORD=davd@234
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true
```

### 3. Start the Server
```bash
# Development mode with hot auto-reload
npm run dev

# Or build & run for production
npm run build
npm start
```
The backend server will start on port `5000` (e.g., `http://localhost:5000` or `http://10.1.60.8:5000`).

---

## 🗄️ Database & Stored Procedures (CRUD)

All schema migrations and Stored Procedures are located in:
- `backend/database/migrations/001_initial_schema.sql` (Tables & Indexes)
- `backend/database/migrations/003_stored_procedures_crud.sql` (Master CRUD SPs)

You can run them in **SQL Server Management Studio (SSMS)** or trigger deployment via the API:
```bash
curl -X POST http://localhost:5000/api/v1/admin/sql-server/install-sp \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```

### Supported CRUD Stored Procedures:
1. **Authentication & Login**:
   - `[Auth].[sp_LoginUser]` - Performs user lookup, status update to online, and audit log.
   - `[Auth].[sp_GetUserProfile]` - Returns user profile with role and department.
   - `[Auth].[sp_UpdateUserStatus]` - Updates presence ('online', 'away', 'busy', 'offline').
   - `[Auth].[sp_UpdateUserProfile]` - Updates display name, job title, and avatar.
   - `[Auth].[sp_RevokeUserTokens]` - Revokes active refresh tokens on logout.

2. **Employee Registration & Directory (CRUD)**:
   - `[Auth].[sp_RegisterEmployee]` - Full transactional registration with general channel auto-enrollment.
   - `[Auth].[sp_GetAllEmployees]` - Lists employees with role and department info.
   - `[Auth].[sp_UpdateEmployeeStatus]` - Activates or deactivates employee accounts.
   - `[Auth].[sp_UpdateEmployeeRole]` - Promotes/modifies roles (`Super Admin`, `Admin`, `Department Admin`, `Employee`).
   - `[Auth].[sp_DeleteEmployee]` - Soft deletes and deactivates employee records.

3. **Conversations & Channels (CRUD)**:
   - `[Chat].[sp_CreateConversation]` - Creates direct or group channels with 1-to-1 deduplication.
   - `[Chat].[sp_GetUserConversations]` - Lists conversations with unread counts and message previews.
   - `[Chat].[sp_AddConversationMember]` - Joins new user to group channel.
   - `[Chat].[sp_RemoveConversationMember]` - Removes member from channel.

4. **Chat Messages (CRUD)**:
   - `[Chat].[sp_CreateMessage]` - Idempotent message insert with conversation timestamp touch.
   - `[Chat].[sp_GetMessagesCursor]` - Cursor-based paginated chat message retrieval.
   - `[Chat].[sp_UpdateMessageContent]` - Edits message content and marks `IsEdited = 1`.
   - `[Chat].[sp_DeleteMessage]` - Soft deletes message and masks content.
   - `[Chat].[sp_ToggleReaction]` - Atomically toggles emoji reactions without race conditions.
   - `[Chat].[sp_TogglePinMessage]` - Toggles message pinned status.

5. **Security & Audit Logs**:
   - `[Administration].[sp_RecordAuditLog]` - Records immutable LAN security action.
   - `[Administration].[sp_GetAuditLogs]` - Fetches audit trail.

---

## 📡 REST API & WebSocket Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | GET | Server health & LAN diagnostic status |
| `/api/v1/auth/login` | POST | Authenticate employee & issue JWT |
| `/api/v1/auth/super-register` | POST | Super User authorized employee registration |
| `/api/v1/auth/me` | GET | Current logged-in user profile |
| `/api/v1/conversations` | GET, POST | List and create conversations/channels |
| `/api/v1/messages/:convId` | GET | Cursor-paginated message history |
| `/api/v1/messages` | POST | Send internal chat message |
| `/api/v1/admin/users` | GET, POST | Employee accounts management |
| `/api/v1/admin/audit-logs` | GET | Immutable security audit trail |
| `/api/v1/admin/sql-server/status` | GET | SQL Server connection status |
| `/api/v1/admin/sql-server/test-connection` | POST | Test live ping to SQL Server |
| `/api/v1/admin/sql-server/install-sp` | POST | Deploy Master CRUD Stored Procedures |
| `/socket.io` | WS | Real-time WebSocket event connection |
