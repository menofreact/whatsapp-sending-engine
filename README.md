# WAHAsender - Dockerized WhatsApp PDF Sender

A simple, robust, Dockerized web application to send WhatsApp messages with PDF attachments using WAHA (WhatsApp HTTP API).

## Features
- **Dockerized**: Runs entirely in containers. No local Node.js required.
- **QR Connection**: Scan QR code from the web dashboard to connect.
- **PDF Parsing**: Automatically extracts Name and Mobile Number from uploaded PDFs.
- **Queue System**: FIFO queue with automatic retries and delay control.
- **Persistent Data**: Uses SQLite and Docker volumes to save session and queue history.

## Prerequisites
- **Local**: Docker & Docker Compose installed.
- **VPS**: Ubuntu/Debian server.

## Quick Start (Local)

1. Open a terminal in this folder.
2. Run the start command:
   ```bash
   docker-compose up -d
   ```
3. Open your browser to:
   [http://localhost:3000](http://localhost:3000)

## Deploy to VPS (Easy Mode)

1. **Package the App**:
   Run the PowerShell script to create a zip file:
   ```powershell
   ./package_for_vps.ps1
   ```
   This creates `WAHAsender_VPS.zip`.

2. **Upload to VPS**:
   Use SCP or FileZilla to upload `WAHAsender_VPS.zip` to your server.

3. **Install & Run on VPS**:
   SSH into your VPS and run:
   ```bash
   # Install unzip if missing
   sudo apt install unzip -y
   
   # Unzip
   unzip WAHAsender_VPS.zip -d wahasender
   cd wahasender
   
   # Run Setup Script (Installs Docker + Starts App)
   bash vps_setup.sh
   ```

4. **Access**:
   Open `http://YOUR_VPS_IP:3000`

---

## How to Use

1. **Connect WhatsApp**:
   - On the dashboard, click "Connect WhatsApp".
   - Wait for the QR code to appear.
   - Scan it with your phone (WhatsApp -> Linked Devices).
   - Status should change to "Connected".

2. **Upload PDFs**:
   - Drag & drop or select PDF files.
   - The system will try to extract Name and Mobile.
   - **Verify** the extracted data in the table. Edit if necessary.

3. **Set Message**:
   - Enter your message template (e.g., "Hi {{name}}...").
   - Click "Apply to Pending Queue".

4. **Start Sending**:
   - Click "Start Queue".
   - Watch the status update in real-time.

## Configuration (Advanced)
Edit `docker-compose.yml` environment variables:
- `MESSAGE_DELAY`: Time to wait between messages (seconds). Default: 10.
- `MAX_RETRIES`: Number of times to retry failed messages. Default: 3.
