const db = require('./db');
const waha = require('./waha');
const path = require('path');

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const MESSAGE_DELAY = parseInt(process.env.MESSAGE_DELAY || '10') * 1000;

let isProcessing = false;
let isPaused = false;

// Function to get next pending item
function getNextItem() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`,
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function updateStatus(id, status, logs = '') {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        db.run(
            `UPDATE queue SET status = ?, logs = logs || ?, updated_at = ? WHERE id = ?`,
            [status, logs ? `\n[${timestamp}] ${logs}` : '', timestamp, id],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

function incrementRetry(id) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE queue SET retries = retries + 1 WHERE id = ?`,
            [id],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

function renderMessage(template, item) {
    if (!template) return '';
    return template
        .replace(/{{name}}/g, item.name || '')
        .replace(/{{mobile}}/g, item.mobile || '');
}

async function processQueue() {
    if (isProcessing || isPaused) return;

    try {
        const item = await getNextItem();
        if (!item) return; // Queue empty

        isProcessing = true;

        // Check if WAHA is connected
        const sessionStatus = await waha.getSessionStatus();
        if (sessionStatus.status !== 'WORKING') { // Simplified check
            // Do not fail item, just wait
            console.log('WAHA not ready, waiting...');
            isProcessing = false;
            return;
        }

        console.log(`Processing item ${item.id} for ${item.mobile}`);
        await updateStatus(item.id, 'processing', 'Started processing');

        try {
            await new Promise(r => setTimeout(r, MESSAGE_DELAY));

            // 1. Send PDF
            await waha.sendPDF(item.mobile, item.pdf_path, item.original_filename, '');

            // 2. Send Text if exists
            // We expect `item.message` to be the raw template stored by the UI
            if (item.message && item.message.trim().length > 0) {
                const text = renderMessage(item.message, item);
                if (text) {
                    await waha.sendText(item.mobile, text);
                }
            }

            await updateStatus(item.id, 'completed', 'Sent successfully');

        } catch (err) {
            console.error(`Failed item ${item.id}:`, err.message);
            const newStatus = (item.retries + 1 >= MAX_RETRIES) ? 'failed' : 'pending';
            await incrementRetry(item.id);
            await updateStatus(item.id, newStatus, `Failed: ${err.message}`);
        }

    } catch (err) {
        console.error('Queue processing error:', err);
    } finally {
        isProcessing = false;
    }
}

// Start polling
setInterval(processQueue, 3000); // Check every 3 seconds

module.exports = {
    start: () => { isPaused = false; },
    pause: () => { isPaused = true; },
    getStatus: () => ({ isProcessing, isPaused })
};
