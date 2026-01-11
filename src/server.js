require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = require('./db');
const whatsapp = require('./whatsapp');
const pdfParser = require('./pdf');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_me';
if (JWT_SECRET === 'supersecretkey_change_me') {
    console.warn('WARNING: Using default JWT_SECRET. This is insecure in production!');
}

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

// --- MIDDLEWARE ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    next();
}

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
        if (!user) return res.status(400).json({ error: 'User not found' });

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        // Auto-initialize WhatsApp session on login
        whatsapp.getSession(user.id);

        res.json({ token, role: user.role, username: user.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, role, created_at FROM users");
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        await db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role || 'user']);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- WHATSAPP ROUTES (Scoped by User) ---

app.get('/api/status', authenticateToken, async (req, res) => {
    try {
        const status = await whatsapp.getStatus(req.user.id);
        res.json(status);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Debug endpoint - View internal engine state and logs
// In production, you might want to protect this with a special secret or admin check
app.get('/api/debug', async (req, res) => {
    try {
        const logs = whatsapp.getDebugLogs();
        const sessions = whatsapp.getAllSessions();
        const systemInfo = {
            env: process.env.NODE_ENV,
            chromePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        // Return HTML for easy reading
        const logHtml = logs.map(l => `<div>${l}</div>`).join('');
        res.send(`
            <html>
                <body style="font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px;">
                    <h2>System Status</h2>
                    <pre>${JSON.stringify(systemInfo, null, 2)}</pre>
                    <h2>Active Sessions</h2>
                    <pre>${JSON.stringify(sessions, null, 2)}</pre>
                    <h2>Recent Logs</h2>
                    <div style="background: #000; padding: 10px; border: 1px solid #333; height: 400px; overflow-y: scroll;">
                        ${logHtml}
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/qr', authenticateToken, async (req, res) => {
    try {
        const qr = await whatsapp.getQR(req.user.id);
        if (!qr) return res.status(404).json({ error: 'QR not ready' });
        res.json(qr);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/start', authenticateToken, async (req, res) => {
    try {
        await whatsapp.initialize(req.user.id);
        res.json({ status: 'starting' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/restart', authenticateToken, async (req, res) => {
    try {
        await whatsapp.logout(req.user.id); // Force cleanup
        await whatsapp.initialize(req.user.id);
        res.json({ status: 'restarting' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', authenticateToken, async (req, res) => {
    try {
        await whatsapp.logout(req.user.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- QUEUE ROUTES (Scoped by User) ---

app.get('/api/queue', authenticateToken, async (req, res) => {
    try {
        const rows = await db.all(
            "SELECT * FROM queue WHERE user_id = ? AND status IN ('pending', 'processing', 'staged') ORDER BY created_at DESC",
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports', authenticateToken, async (req, res) => {
    try {
        const rows = await db.all(
            "SELECT * FROM queue WHERE user_id = ? AND status IN ('completed', 'failed') ORDER BY updated_at DESC LIMIT 500",
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Preview PDF extraction (for direct send auto-fill)
app.post('/api/pdf/preview', authenticateToken, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        const parsed = await pdfParser(req.file.path);

        // Format mobile to WhatsApp standard (12 digits with 91 prefix)
        let formattedMobile = parsed.mobile || '';
        if (formattedMobile && !formattedMobile.startsWith('91') && formattedMobile.length === 10) {
            formattedMobile = '91' + formattedMobile;
        }

        const warnings = [];
        if (!parsed.name) warnings.push('Could not extract name from PDF - please enter manually');
        if (!parsed.mobile) warnings.push('Could not extract mobile number from PDF - please enter manually');

        res.json({
            success: true,
            name: parsed.name || '',
            mobile: formattedMobile,
            warnings,
            needsManualEntry: !parsed.name || !parsed.mobile,
            filePath: req.file.path,
            fileName: req.file.originalname
        });
    } catch (e) {
        res.status(500).json({ error: e.message, needsManualEntry: true });
    }
});

app.post('/api/send/direct', authenticateToken, upload.single('pdf'), async (req, res) => {
    try {
        let { name, mobile, message } = req.body;
        const pdfFile = req.file;

        try {
            // Auto-extract from PDF if missing
            if (pdfFile && (!name || !mobile)) {
                try {
                    const parsed = await pdfParser(pdfFile.path);
                    if (!name) name = parsed.name || 'Unknown';
                    if (!mobile) mobile = parsed.mobile || '';
                    console.log(`[DIRECT] Extracted from PDF - Name: ${name}, Mobile: ${mobile}`);
                } catch (e) {
                    console.error('Manual parsing failed:', e);
                }
            }

            // Validate mobile is present
            if (!mobile) {
                return res.status(400).json({
                    error: 'Mobile number is required. Could not extract from PDF - please enter manually.',
                    needsManualEntry: true
                });
            }

            if (pdfFile) {
                await whatsapp.sendPDF(req.user.id, mobile, pdfFile.path, pdfFile.originalname, message);
            } else {
                await whatsapp.sendText(req.user.id, mobile, message);
            }

            await db.run(
                'INSERT INTO queue (user_id, name, mobile, pdf_path, original_filename, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, name || 'Direct Send', mobile, pdfFile ? pdfFile.path : null, pdfFile ? pdfFile.originalname : null, message, 'completed']
            );
            res.json({ success: true });
        } catch (err) {
            await db.run(
                'INSERT INTO queue (user_id, name, mobile, pdf_path, original_filename, message, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, name || 'Direct Send', mobile, pdfFile ? pdfFile.path : null, pdfFile ? pdfFile.originalname : null, message, 'failed', err.message]
            );
            throw err;
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload', authenticateToken, upload.array('pdfs'), async (req, res) => {
    const results = { success: 0, failed: 0, warnings: [], items: [] };
    for (const file of req.files) {
        try {
            const data = await pdfParser(file.path);

            // Format mobile to WhatsApp standard
            let formattedMobile = data.mobile || '';
            if (formattedMobile && !formattedMobile.startsWith('91') && formattedMobile.length === 10) {
                formattedMobile = '91' + formattedMobile;
            }

            await db.run(
                'INSERT INTO queue (user_id, name, mobile, pdf_path, original_filename, status) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.id, data.name || 'Unknown', formattedMobile, file.path, file.originalname, 'staged']
            );

            results.success++;

            // Track extraction warnings
            if (!data.name || !data.mobile) {
                results.warnings.push({
                    file: file.originalname,
                    missingName: !data.name,
                    missingMobile: !data.mobile
                });
            }

            results.items.push({
                file: file.originalname,
                name: data.name || 'Unknown',
                mobile: formattedMobile || 'MISSING',
                needsEdit: !data.name || !data.mobile
            });
        } catch (e) {
            results.failed++;
            results.warnings.push({ file: file.originalname, error: e.message });
        }
    }

    // Add summary message for warnings
    if (results.warnings.length > 0) {
        results.warningMessage = `${results.warnings.length} file(s) need manual data entry. Please review and edit in the staging area.`;
    }

    res.json(results);
});

// Start processing queue for user
app.post('/api/queue/start', authenticateToken, async (req, res) => {
    const { messageTemplate } = req.body;

    // Non-blocking logic per user (simplified for now)
    processUserQueue(req.user.id, messageTemplate);

    res.json({ success: true, message: 'Queue started' });
});

app.post('/api/queue/approve-staged', authenticateToken, async (req, res) => {
    try {
        await db.run("UPDATE queue SET status = 'pending' WHERE user_id = ? AND status = 'staged'", [req.user.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update queue item (for editing name/mobile)
app.post('/api/queue/update', authenticateToken, async (req, res) => {
    try {
        const { id, name, mobile } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'ID is required' });
        }

        // Normalize mobile to 12 digits with 91 prefix
        let normalizedMobile = mobile ? mobile.replace(/\D/g, '') : '';
        if (normalizedMobile.length === 10 && /^[6-9]/.test(normalizedMobile)) {
            normalizedMobile = '91' + normalizedMobile;
        }

        await db.run(
            'UPDATE queue SET name = ?, mobile = ? WHERE id = ? AND user_id = ?',
            [name || 'Unknown', normalizedMobile, id, req.user.id]
        );

        res.json({ success: true });
    } catch (e) {
        console.error('Queue update error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/queue/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('DELETE FROM queue WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

async function processUserQueue(userId, template) {
    try {
        const items = await db.all("SELECT * FROM queue WHERE user_id = ? AND (status = 'pending' OR (status = 'failed' AND retries < 3))", [userId]);

        for (const item of items) {
            try {
                const message = template.replace(/{name}/g, item.name || 'Customer');
                if (item.pdf_path && fs.existsSync(item.pdf_path)) {
                    await whatsapp.sendPDF(userId, item.mobile, item.pdf_path, item.original_filename, message);
                } else {
                    await whatsapp.sendText(userId, item.mobile, message);
                }
                await db.run("UPDATE queue SET status = 'completed' WHERE id = ?", [item.id]);
                await new Promise(r => setTimeout(r, 2000)); // Delay
            } catch (err) {
                await db.run("UPDATE queue SET status = 'failed', retries = retries + 1, error = ? WHERE id = ?", [err.message, item.id]);
            }
        }
    } catch (e) { console.error(`Queue error for user ${userId}:`, e); }
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
