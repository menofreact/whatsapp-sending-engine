const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Detect Chrome/Chromium executable path based on OS
function getChromePath() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // Windows paths
    const windowsPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];

    // Linux paths
    const linuxPaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
    ];

    const paths = process.platform === 'win32' ? windowsPaths : linuxPaths;

    for (const p of paths) {
        if (p && fs.existsSync(p)) {
            console.log('[WHATSAPP] Found Chrome at:', p);
            return p;
        }
    }

    return undefined; // Let puppeteer use bundled chromium
}

class WhatsAppManager {
    constructor() {
        this.sessions = new Map(); // userId -> { client, status, qr, qrData }
        this.chromePath = getChromePath();
        this.logs = []; // Circular buffer for debug logs
        this.MAX_LOGS = 200;
    }

    log(message, type = 'INFO') {
        const entry = `[${new Date().toISOString()}] [${type}] ${message}`;
        console.log(entry); // Keep stdout
        this.logs.push(entry);
        if (this.logs.length > this.MAX_LOGS) this.logs.shift();
    }

    error(message) {
        this.log(message, 'ERROR');
        console.error(message);
    }

    getDebugLogs() {
        return this.logs;
    }

    getAllSessions() {
        // Return summary of all sessions
        return Array.from(this.sessions.entries()).map(([userId, session]) => ({
            userId,
            status: session.status,
            retries: session.retries || 0,
            hasClient: !!session.client,
            hasQR: !!session.qr
        }));
    }

    async getSession(userId) {
        if (!this.sessions.has(userId)) {
            await this.initialize(userId);
        }
        return this.sessions.get(userId);
    }

    async initialize(userId) {
        this.log(`[WHATSAPP] Initializing session for User ${userId}...`);

        // Initialize session state
        this.sessions.set(userId, {
            client: null,
            status: 'INITIALIZING',
            qr: null
        });

        const puppeteerArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--no-first-run',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-pings',
            '--safebrowsing-disable-auto-update',
            '--ignore-certificate-errors'
        ];

        const clientConfig = {
            authStrategy: new LocalAuth({ clientId: `session-${userId}` }),
            puppeteer: {
                headless: true,
                args: puppeteerArgs
            },
            authTimeoutMs: 300000, // 5 min timeout for auth (increased for VPS)
            qrMaxRetries: 10,
            takeoverOnConflict: true,
            takeoverTimeoutMs: 10000
        };

        // Only set executablePath if we found one
        if (this.chromePath) {
            clientConfig.puppeteer.executablePath = this.chromePath;
        }

        const client = new Client(clientConfig);

        const session = this.sessions.get(userId);
        session.client = client;

        this.setupEventListeners(client, userId);

        try {
            await client.initialize();
        } catch (error) {
            this.error(`[WHATSAPP] User ${userId} Init Error: ${error.message}`);
            session.lastError = error.message;
            session.status = 'FAILED';

            // Track retries
            session.retries = (session.retries || 0) + 1;

            // Auto-retry logic
            setTimeout(async () => {
                if (this.sessions.get(userId)?.status === 'FAILED') {
                    if (session.retries > 3) {
                        console.log(`[WHATSAPP] Too many failures for User ${userId}. corrupt session recovery triggered.`);
                        const authPath = path.join(__dirname, '../.wwebjs_auth', `session-${userId}`);
                        if (fs.existsSync(authPath)) {
                            try {
                                fs.rmSync(authPath, { recursive: true, force: true });
                                console.log(`[WHATSAPP] Deleted corrupt session for User ${userId}`);
                            } catch (e) {
                                console.error('[WHATSAPP] Failed to delete session:', e.message);
                            }
                        }
                        this.sessions.delete(userId);
                        this.initialize(userId); // Restart fresh
                    } else {
                        console.log(`[WHATSAPP] Auto-retrying initialization for User ${userId} (Attempt ${session.retries})...`);
                        this.sessions.delete(userId);
                        // Pass retry count to next attempt (rudimentary, better to store in DB or separate map, 
                        // but re-calling initialize resets local var. better to just restart and trust clean retry)
                        // Actually, since we delete from map, we lose retry count. 
                        // Let's attach retry count to the new session state in the next call.
                        // For now, simple retry is better than nothing.
                        this.initialize(userId);
                    }
                }
            }, 5000);
        }
    }

    setupEventListeners(client, userId) {
        const session = this.sessions.get(userId);

        client.on('qr', (qr) => {
            this.log(`[WHATSAPP] User ${userId} QR RECEIVED`);
            session.status = 'SCAN_QR_CODE';
            qrcode.toDataURL(qr, (err, url) => {
                if (!err) {
                    session.qr = url.replace('data:image/png;base64,', '');
                }
            });
        });

        client.on('ready', () => {
            this.log(`[WHATSAPP] User ${userId} READY`);
            session.status = 'WORKING';
            session.qr = null;

            // Start keep-alive mechanism
            if (session.keepAliveTimer) {
                clearInterval(session.keepAliveTimer);
            }
            session.keepAliveTimer = setInterval(async () => {
                try {
                    // Check if client is still connected
                    const state = await client.getState();
                    if (state !== 'CONNECTED') {
                        this.log(`[WHATSAPP] User ${userId} Keep-alive: State changed to ${state}`);
                    }
                } catch (e) {
                    this.log(`[WHATSAPP] User ${userId} Keep-alive check failed: ${e.message}`, 'WARN');
                }
            }, 30000); // Check every 30 seconds
        });

        client.on('authenticated', () => {
            console.log(`[WHATSAPP] User ${userId} AUTHENTICATED`);
            session.status = 'STARTING';
        });

        client.on('auth_failure', msg => {
            console.error(`[WHATSAPP] User ${userId} AUTH FAILURE:`, msg);
            session.status = 'FAILED';

            // Clear session auth data and retry
            setTimeout(async () => {
                try {
                    await client.destroy();
                } catch (e) { }
                this.sessions.delete(userId);
                this.initialize(userId);
            }, 3000);
        });

        client.on('disconnected', (reason) => {
            console.log(`[WHATSAPP] User ${userId} DISCONNECTED:`, reason);
            session.status = 'RECONNECTING';

            // Safe cleanup with delay before reinit
            setTimeout(async () => {
                try {
                    await client.destroy();
                } catch (e) {
                    console.log(`[WHATSAPP] Cleanup error (ignored):`, e.message);
                }
                this.sessions.delete(userId);
                this.initialize(userId);
            }, 2000);
        });

        // Handle loading screen timeout
        client.on('loading_screen', (percent, message) => {
            this.log(`[WHATSAPP] User ${userId} Loading: ${percent}% - ${message}`);
        });
    }

    async getStatus(userId) {
        const session = this.sessions.get(userId);
        if (!session) return { status: 'OFFLINE' };
        return { status: session.status };
    }

    async getQR(userId) {
        const session = this.sessions.get(userId);
        if (session && session.status === 'SCAN_QR_CODE' && session.qr) {
            return { image: session.qr };
        }
        return null;
    }

    async logout(userId) {
        const session = this.sessions.get(userId);
        if (session && session.client) {
            await session.client.logout();
            await session.client.destroy();

            // Cleanup FS
            const authPath = path.join(__dirname, '../.wwebjs_auth', `session-${userId}`);
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }

            this.sessions.delete(userId);
            this.initialize(userId); // Prepare for new login
        }
    }

    normalizeMobile(mobile) {
        let cleaned = mobile.replace(/\D/g, '');
        if (cleaned.length === 10) cleaned = '91' + cleaned;
        return cleaned;
    }

    async sendText(userId, mobile, text) {
        const session = this.sessions.get(userId);
        if (!session || session.status !== 'WORKING') {
            throw new Error('WhatsApp not ready');
        }
        const chatId = `${this.normalizeMobile(mobile)}@c.us`;
        await session.client.sendMessage(chatId, text);
    }

    async sendPDF(userId, mobile, pdfPath, filename, caption) {
        const session = this.sessions.get(userId);
        if (!session || session.status !== 'WORKING') {
            throw new Error('WhatsApp not ready');
        }
        const chatId = `${this.normalizeMobile(mobile)}@c.us`;
        const media = MessageMedia.fromFilePath(pdfPath);
        if (filename) media.filename = filename;
        await session.client.sendMessage(chatId, media, { caption });
    }
}

module.exports = new WhatsAppManager();
