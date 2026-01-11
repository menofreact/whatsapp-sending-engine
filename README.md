# WhatsApp Sending Engine 🚀

A high-performance, standalone WhatsApp integration engine designed for developers. This engine provides a stable REST API to send text and PDF messages using an integrated `whatsapp-web.js` backend, eliminating the need for expensive third-party APIs.

---

## 🌟 Key Features
- **Standalone Engine**: No external dependencies like WAHA required; the engine is fully self-contained.
- **Dockerized Stability**: Runs in a optimized Debian-based container with pre-configured Chromium and shared memory optimizations.
- **Web QR Interface**: Includes a lightweight, pre-built web dashboard to link your WhatsApp account via QR code.
- **RESTful API**: Easily integrate with other projects using standard POST/GET endpoints.
- **Persistent Sessions**: Securely saves your WhatsApp session across restarts using Docker volumes.
- **PDF Extraction**: Built-in support for auto-extracting name and mobile from PDFs.
- **Multi-User Support**: Admin panel for managing multiple users.
- **VPS Optimized**: Resource limits, health checks, and proper signal handling.

---

## 🛠️ Tech Stack
- **Engine**: [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- **Runtime**: Node.js 18 (Bullseye)
- **Browser**: Headless Chromium
- **Framework**: Express.js
- **Database**: SQLite (for queue management)
- **Container**: Docker & Docker Compose

---

## 🚀 Quick Start (VPS Deployment)

### 1. Clone the Repository
```bash
git clone https://github.com/menofreact/whatsapp-sending-engine.git
cd whatsapp-sending-engine
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set a secure JWT_SECRET
nano .env
```

### 3. Deploy with Docker
```bash
docker-compose up -d --build
```

### 4. Connect Your Account
Open your browser and navigate to `http://your-vps-ip:3000`. 
- Login with `admin` / `admin123` (change password after first login)
- Wait for the QR code to appear
- Scan it with your phone

---

## 📦 VPS Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+
- **RAM**: Minimum 1GB, Recommended 2GB
- **Storage**: 5GB+ free space
- **Docker**: Docker Engine 20.10+ and Docker Compose v2

### Resource Limits (Configurable in docker-compose.yml)
- Memory: 2GB max, 512MB reserved
- CPU: 2 cores max, 0.5 cores reserved

---

## 🔌 API Reference

All API endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_token>
```

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and get JWT token |

### WhatsApp
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Get connection status |
| GET | `/api/qr` | Get QR code (base64) |
| POST | `/api/start` | Initialize WhatsApp session |
| POST | `/api/restart` | Restart WhatsApp session |
| POST | `/api/logout` | Disconnect WhatsApp |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send/direct` | Send direct message with PDF |
| POST | `/api/upload` | Bulk upload PDFs to queue |
| POST | `/api/pdf/preview` | Extract name/mobile from PDF |
| GET | `/api/queue` | Get pending queue items |
| POST | `/api/queue/start` | Start processing queue |
| POST | `/api/queue/update` | Update queue item |
| DELETE | `/api/queue/:id` | Delete queue item |

---

## 🐳 Docker Commands

```bash
# Start the engine
docker-compose up -d

# View logs
docker-compose logs -f wahasender

# Restart
docker-compose restart

# Stop
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

---

## 🛡️ Security & Privacy
- JWT-based authentication
- Non-root Docker container
- Session data stored in Docker volumes (not in repo)
- `.gitignore` configured to exclude all sensitive data

---

## 👨‍💻 Author
**Mohammed Zareef Raichur**

---

## 📄 License
MIT License. Feel free to use this engine in your own commercial or private projects.
