require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');

const db = require('./db');
const whatsapp = require('./whatsapp');
const pdfParser = require('./pdf');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// --- API ROUTES ---

// 1. Session & QR
app.get('/api/status', async (req, res) => {
    try {
        const status = await whatsapp.getSessionStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/start', async (req, res) => {
    try {
        const result = await whatsapp.startSession();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/qr', async (req, res) => {
    try {
        const qr = await whatsapp.getQR();
        if (!qr) return res.status(404).json({ error: 'QR not ready' });
        res.json(qr);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Queue Management
app.get('/api/queue', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM queue ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/queue/manual', upload.single('pdf'), async (req, res) => {
    try {
        const { name, mobile } = req.body;
        const pdfPath = req.file ? req.file.path : null;
        const filename = req.file ? req.file.originalname : null;

        await db.run(
            'INSERT INTO queue (name, mobile, pdf_path, original_filename) VALUES (?, ?, ?, ?)',
            [name, mobile, pdfPath, filename]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload', upload.array('pdfs'), async (req, res) => {
    const results = { success: 0, failed: 0, errors: [] };

    for (const file of req.files) {
        try {
            const data = await pdfParser.parsePDF(file.path);
            await db.run(
                'INSERT INTO queue (name, mobile, pdf_path, original_filename) VALUES (?, ?, ?, ?)',
                [data.name, data.mobile, file.path, file.originalname]
            );
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({ file: file.originalname, error: error.message });
        }
    }
    res.json(results);
});

app.post('/api/send/direct', upload.single('pdf'), async (req, res) => {
    try {
        const { name, mobile, message } = req.body;
        const pdfFile = req.file;

        if (pdfFile) {
            await whatsapp.sendPDF(mobile, pdfFile.path, pdfFile.originalname, message);
        } else {
            await whatsapp.sendText(mobile, message);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Sending Logic
let isProcessing = false;

app.post('/api/queue/start', async (req, res) => {
    if (isProcessing) return res.status(400).json({ error: 'Queue already processing' });

    const { messageTemplate } = req.body;
    isProcessing = true;

    // Non-blocking processing
    processQueue(messageTemplate);

    res.json({ success: true, message: 'Queue started' });
});

async function processQueue(template) {
    try {
        const items = await db.all("SELECT * FROM queue WHERE status = 'pending' OR status = 'failed' AND retries < 3");

        for (const item of items) {
            try {
                const message = template.replace(/{name}/g, item.name || 'Customer');

                // Process item
                console.log(`Processing message to ${item.name} (${item.mobile})...`);
                if (item.pdf_path && fs.existsSync(item.pdf_path)) {
                    await whatsapp.sendPDF(item.mobile, item.pdf_path, item.original_filename, message);
                } else {
                    await whatsapp.sendText(item.mobile, message);
                }

                await db.run("UPDATE queue SET status = 'sent', error = NULL WHERE id = ?", [item.id]);

                // Small delay between messages
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`Failed to send item ${item.id}:`, err.message);
                await db.run(
                    "UPDATE queue SET status = 'failed', retries = retries + 1, error = ? WHERE id = ?",
                    [err.message, item.id]
                );
            }
        }
    } finally {
        isProcessing = false;
    }
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    whatsapp.initialize().catch(err => {
        console.error('[SERVER] Failed to auto-initialize WhatsApp:', err);
    });
});
