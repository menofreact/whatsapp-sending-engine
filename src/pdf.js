const pdf = require('pdf-parse');
const fs = require('fs');

// Regex patterns
// Matches: 919876543210, +91 98765 43210, 9876543210
const MOBILE_REGEX = /(?:\+91|91)?[\-\s]?[6-9]\d{9}/;

// Simple heuristic for names, can be improved based on specific PDF format
// Looking for lines starting with "Name:", "Patient Name:", etc.
const NAME_REGEXES = [
    /Name\s*:\s*([A-Za-z\s\.]+)/i,
    /Patient Name\s*:\s*([A-Za-z\s\.]+)/i,
    /Customer Name\s*:\s*([A-Za-z\s\.]+)/i
];

async function parsePDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    try {
        const data = await pdf(dataBuffer);
        const text = data.text;

        let mobile = null;
        let name = null;

        // Extract Mobile
        const mobileMatch = text.match(MOBILE_REGEX);
        if (mobileMatch) {
            let rawMobile = mobileMatch[0].replace(/[^\d]/g, '');
            // Normalize to 91 prefix
            if (rawMobile.length === 10) {
                rawMobile = '91' + rawMobile;
            } else if (rawMobile.startsWith('0')) {
                rawMobile = '91' + rawMobile.substring(1);
            }
            // Ensure it starts with 91
            if (!rawMobile.startsWith('91')) {
                rawMobile = '91' + rawMobile; // Fallback if it was just 10 digits
            }
            mobile = rawMobile;
        }

        // Extract Name
        for (const regex of NAME_REGEXES) {
            const match = text.match(regex);
            if (match && match[1]) {
                name = match[1].trim();
                // Truncate to first 10 chars to avoid extra info (Ward Info etc)
                if (name.length > 10) {
                    name = name.substring(0, 10).trim();
                }
                break;
            }
        }

        // Fallback: If no name found, use filename? No, let user edit.

        return { name, mobile, text_preview: text.substring(0, 100) };

    } catch (error) {
        console.error('PDF Parse Error', error);
        throw error;
    }
}

module.exports = parsePDF;
