const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'shell',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        console.log('Loading HTML...');
        // We assume this script runs in /app, so manual.html is in /app/manual.html
        const htmlPath = path.join(__dirname, 'manual.html');
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

        console.log('Generating PDF...');
        await page.pdf({
            path: 'User_Manual_v2.7.pdf',
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        console.log('PDF Generated successfully: User_Manual_v2.7.pdf');
        await browser.close();
    } catch (e) {
        console.error('Error generating PDF:', e);
        process.exit(1);
    }
})();
