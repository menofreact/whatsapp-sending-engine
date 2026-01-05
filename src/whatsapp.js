const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ],
                executablePath: '/usr/bin/chromium'
            },
            authTimeoutMs: 60000,
            qrMaxRetries: 10
        });

        this.qrCodeData = null;
        this.status = 'INITIALIZING';
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.on('qr', (qr) => {
            console.log('[WHATSAPP] QR RECEIVED');
            this.status = 'SCAN_QR_CODE';
            qrcode.toDataURL(qr, (err, url) => {
                if (err) {
                    console.error('[WHATSAPP] Error generating QR code:', err);
                    return;
                }
                this.qrCodeData = url.replace('data:image/png;base64,', '');
            });
        });

        this.client.on('ready', () => {
            console.log('[WHATSAPP] Client is READY');
            this.status = 'WORKING';
            this.qrCodeData = null;
        });

        this.client.on('authenticated', () => {
            console.log('[WHATSAPP] Client AUTHENTICATED');
            this.status = 'STARTING';
        });

        this.client.on('auth_failure', msg => {
            console.error('[WHATSAPP] AUTHENTICATION FAILURE:', msg);
            this.status = 'FAILED';
        });

        this.client.on('disconnected', (reason) => {
            console.log('[WHATSAPP] Client DISCONNECTED:', reason);
            this.status = 'SCAN_QR_CODE';
            this.initialize();
        });

        this.client.on('loading_screen', (percent, message) => {
            console.log('[WHATSAPP] LOADING:', percent, message);
        });
    }

    async initialize() {
        try {
            console.log('[WHATSAPP] Initializing WhatsApp Client...');
            await this.client.initialize();
        } catch (error) {
            console.error('[WHATSAPP] Failed to initialize WhatsApp Client:');
            console.error(error);
            this.status = 'FAILED';
        }
    }

    async getSessionStatus() {
        return {
            status: this.status,
            name: 'whatsapp-sending-engine'
        };
    }

    async getQR() {
        if (this.status === 'SCAN_QR_CODE' && this.qrCodeData) {
            return { image: this.qrCodeData };
        }
        return null;
    }

    async startSession() {
        if (this.status === 'FAILED') {
            await this.initialize();
        }
        return { status: 'starting' };
    }

    normalizeMobile(mobile) {
        let cleaned = mobile.replace(/\D/g, '');
        if (cleaned.length === 10) cleaned = '91' + cleaned;
        return cleaned;
    }

    async sendText(mobile, text) {
        try {
            const chatId = `${this.normalizeMobile(mobile)}@c.us`;
            await this.client.sendMessage(chatId, text);
            return true;
        } catch (error) {
            console.error('Send Text error:', error);
            throw error;
        }
    }

    async sendPDF(mobile, pdfPath, filename, caption) {
        try {
            const chatId = `${this.normalizeMobile(mobile)}@c.us`;
            const media = MessageMedia.fromFilePath(pdfPath);

            // Override filename if provided
            if (filename) media.filename = filename;

            await this.client.sendMessage(chatId, media, { caption });
            return true;
        } catch (error) {
            console.error('Send PDF error:', error);
            throw error;
        }
    }
}

module.exports = new WhatsAppService();
