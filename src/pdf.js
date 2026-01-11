const pdf = require('pdf-parse');
const fs = require('fs');

// Regex patterns for mobile numbers
// Primary: Matches 10-digit Indian mobile starting with 6-9
const MOBILE_REGEXES = [
    // With prefix: +91, 91, 0 followed by 10 digits
    /(?:\+91|91|0)[\-\s]?([6-9]\d{9})/,
    // After "Mobile" label: Mobile no: 9876543210
    /Mobile\s*(?:no|number|num)?[\s:]*([6-9]\d{9})/i,
    // After "Phone" label: Phone: 9876543210
    /Phone[\s:]*([6-9]\d{9})/i,
    // Standalone 10-digit mobile
    /\b([6-9]\d{9})\b/
];

// Name extraction patterns
const NAME_REGEXES = [
    /Patient\s*Name\s*:\s*((?:Mr\.|Mrs\.|Ms\.|Dr\.)?[A-Za-z\s\.]+)/i,
    /Name\s*:\s*((?:Mr\.|Mrs\.|Ms\.|Dr\.)?[A-Za-z\s\.]+)/i,
    /Customer\s*Name\s*:\s*((?:Mr\.|Mrs\.|Ms\.|Dr\.)?[A-Za-z\s\.]+)/i
];

// Words to stop at when cleaning name
const NAME_STOP_WORDS = ['ward', 'age', 'sex', 'gender', 'date', 'mobile', 'phone', 'address', 'uhid', 'reg'];

function cleanName(rawName) {
    if (!rawName) return null;

    let name = rawName.trim();

    // Remove trailing words that are clearly not part of the name
    const lowerName = name.toLowerCase();
    for (const stopWord of NAME_STOP_WORDS) {
        const idx = lowerName.indexOf(stopWord);
        if (idx > 0) {
            name = name.substring(0, idx).trim();
            break;
        }
    }

    // Clean up extra spaces and dots
    name = name.replace(/\s+/g, ' ').trim();

    // Remove trailing dots or incomplete words
    name = name.replace(/[.\s]+$/, '').trim();

    return name || null;
}

async function parsePDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    try {
        const data = await pdf(dataBuffer);
        const text = data.text;

        let mobile = null;
        let name = null;

        console.log('[PDF Parser] Text length:', text.length);
        console.log('[PDF Parser] Preview:', text.substring(0, 300).replace(/\n/g, ' '));

        // Extract Mobile - try each pattern in order
        for (const regex of MOBILE_REGEXES) {
            const match = text.match(regex);
            if (match) {
                // Get the captured group (10 digits) or full match
                let rawMobile = (match[1] || match[0]).replace(/[^\d]/g, '');

                // Validate it's a proper 10-digit number
                if (rawMobile.length === 10 && /^[6-9]/.test(rawMobile)) {
                    mobile = '91' + rawMobile;
                    console.log('[PDF Parser] Mobile found:', mobile);
                    break;
                } else if (rawMobile.length === 12 && rawMobile.startsWith('91')) {
                    mobile = rawMobile;
                    console.log('[PDF Parser] Mobile found with prefix:', mobile);
                    break;
                }
            }
        }

        // Extract Name
        for (const regex of NAME_REGEXES) {
            const match = text.match(regex);
            if (match && match[1]) {
                name = cleanName(match[1]);
                if (name) {
                    console.log('[PDF Parser] Name found:', name);
                    break;
                }
            }
        }

        return { name, mobile, text_preview: text.substring(0, 200) };

    } catch (error) {
        console.error('PDF Parse Error', error);
        throw error;
    }
}

module.exports = parsePDF;
