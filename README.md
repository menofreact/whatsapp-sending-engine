# WhatsApp Sending Engine 🚀

A high-performance, standalone WhatsApp integration engine designed for developers. This engine provides a stable REST API to send text and PDF messages using an integrated `whatsapp-web.js` backend, eliminating the need for expensive third-party APIs.

---

## 🌟 Key Features
- **Standalone Engine**: No external dependencies like WAHA required; the engine is fully self-contained.
- **Dockerized Stability**: Runs in a optimized Debian-based container with pre-configured Chromium and shared memory optimizations.
- **Web QR Interface**: Includes a lightweight, pre-built web dashboard to link your WhatsApp account via QR code.
- **RESTful API**: Easily integrate with other projects using standard POST/GET endpoints.
- **Persistent Sessions**: Securely saves your WhatsApp session across restarts using Docker volumes.
- **PDF Extraction**: Built-in support for processing and sending PDF attachments.

---

## 🛠️ Tech Stack
- **Engine**: [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- **Runtime**: Node.js 18 (Bullseye)
- **Browser**: Headless Chromium
- **Framework**: Express.js
- **Database**: SQLite (for queue management)
- **Container**: Docker & Docker Compose

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/menofreact/whatsapp-sending-engine.git
cd whatsapp-sending-engine
```

### 2. Deploy with Docker
```bash
docker-compose up -d --build
```

### 3. Connect Your Account
Open your browser and navigate to `http://localhost:3000`. Wait for the QR code to appear, scan it with your phone, and you're ready to send!

---

## 🔌 API Reference

### Get Status
`GET /api/status` - Returns the current connection status of the WhatsApp engine.

### Get QR Code
`GET /api/qr` - Returns the current QR code (base64) for authentication.

### Send Direct Message
`POST /api/send/direct`
```json
{
  "mobile": "919998887776",
  "message": "Hello from the Engine!",
  "pdf_path": "optional_path_to_pdf"
}
```

---

## 🛡️ Security & Privacy
This project is designed with privacy in mind. The `.gitignore` is strictly configured to ensure that **no session data, databases, or sensitive user information** is ever committed to the repository.

---

## 👨‍💻 Author
**Mohammed Zareef Raichur**

---

## 📄 License
MIT License. Feel free to use this engine in your own commercial or private projects.
