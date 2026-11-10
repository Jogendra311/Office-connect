# OfficeConnect - Frontend SPA Application

Standalone enterprise frontend for the OfficeConnect LAN Chat & Collaboration Platform. Built with React 19, Redux Toolkit, Tailwind CSS v4, Lucide Icons, and Socket.IO Client.

---

## 🚀 Quick Start (Running Standalone)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set the backend API and WebSocket endpoints (e.g., pointing to your backend server running on port `5000`):
```env
# Point to your standalone backend API (Localhost or LAN Host IP)
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000

# LAN Host Info
VITE_SERVER_IP=10.1.60.8
VITE_LAN_SUBNET=10.1.60.0/24
```

### 3. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` (or `http://10.1.60.8:3000` from any other PC on your office subnet).

---

## 🏗️ Production Build & Hosting

To build the static production bundle:
```bash
npm run build
```
This produces optimized HTML, JavaScript, and CSS in the `frontend/dist/` directory.

### Hosting Options:
- **Windows IIS**: Create an IIS website pointing to `frontend/dist/` with a URL rewrite rule to `index.html` for client-side routing.
- **Nginx**:
  ```nginx
  server {
      listen 3000;
      server_name 10.1.60.8;
      root /path/to/frontend/dist;
      index index.html;

      location / {
          try_files $uri $uri/ /index.html;
      }

      location /api/ {
          proxy_pass http://10.1.60.8:5000/api/;
      }

      location /socket.io/ {
          proxy_pass http://10.1.60.8:5000/socket.io/;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
      }
  }
  ```
- **Node static server**:
  ```bash
  npx serve -s dist -l 3000
  ```

---

## 📡 Backend API Communication

The frontend automatically communicates with the backend via:
1. **Redux Toolkit Query (`src/features/api/apiSlice.ts`)**:
   - Uses `VITE_API_BASE_URL` with automatic Bearer token injection.
   - Fallback to `/api/v1` when proxied by Vite.
2. **Real-time Socket.IO (`src/services/socketClient.ts`)**:
   - Uses `VITE_SOCKET_URL` with JWT token handshake authentication.
   - Automatically handles reconnects, live messages, reactions, typing indicators, and presence updates.
