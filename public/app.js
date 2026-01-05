const API_BASE = '/api';

// State
let isConnected = false;
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const connectBtn = document.getElementById('connectBtn');
const connectMessage = document.getElementById('connectMsg');
const qrContainer = document.getElementById('qrContainer');
const qrImage = document.getElementById('qrImage');
const uploadPanel = document.getElementById('uploadPanel');
const templatePanel = document.getElementById('templatePanel');
const fileInput = document.getElementById('fileInput');
const queueTableBody = document.getElementById('queueTableBody');
const startQueueBtn = document.getElementById('startQueueBtn');
const pauseQueueBtn = document.getElementById('pauseQueueBtn');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const messageTemplate = document.getElementById('messageTemplate');

// 1. Connection Logic
async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();

        if (data.status === 'WORKING') {
            setConnected(true);
        } else {
            setConnected(false, data.status);
            if (data.status === 'SCAN_QR_CODE') {
                if (qrContainer.classList.contains('hidden')) {
                    qrContainer.classList.remove('hidden');
                    connectMessage.textContent = "Please scan the QR Code below";
                    connectMessage.classList.remove('hidden');
                    connectBtn.classList.add('hidden');
                    fetchQR();
                }
            } else if (data.status === 'STARTING') {
                connectBtn.disabled = true;
                connectBtn.textContent = 'Starting Engine...';
            }
        }
    } catch (e) {
        setConnected(false, 'Disconnected');
    }
}

function setConnected(connected, statusLabel = 'Disconnected') {
    isConnected = connected;
    statusText.textContent = connected ? 'Connected' : statusLabel;
    statusDot.className = `w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`;

    if (connected) {
        uploadPanel.classList.remove('opacity-50', 'pointer-events-none');
        templatePanel.classList.remove('opacity-50', 'pointer-events-none');
        connectBtn.classList.add('hidden');
        qrContainer.classList.add('hidden');
    } else {
        uploadPanel.classList.add('opacity-50', 'pointer-events-none');
    }
}

async function fetchQR() {
    try {
        const res = await fetch(`${API_BASE}/qr`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.image) {
                let imgSrc = data.image;
                if (!imgSrc.startsWith('data:image')) {
                    imgSrc = `data:image/png;base64,${imgSrc}`;
                }
                qrImage.src = imgSrc;
                qrImage.classList.remove('hidden');
                qrContainer.classList.remove('hidden');
            }
        }
    } catch (e) {
        console.error("Failed to fetch QR");
    }
}

connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Starting...';
    try {
        await fetch(`${API_BASE}/connect`, { method: 'POST' });
        setTimeout(fetchQR, 2000);
    } catch (e) {
        alert('Failed to start session');
        connectBtn.disabled = false;
    }
});

// 2. Upload Logic
fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('pdfs', files[i]);
    }

    try {
        document.getElementById('uploadProgress').classList.remove('hidden');
        await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        document.getElementById('uploadProgress').classList.add('hidden');
        fetchQueue();
        fileInput.value = '';
    } catch (e) {
        alert('Upload failed');
    }
});

const manualAddBtn = document.getElementById('manualAddBtn');
const manualNameInput = document.getElementById('manualName');
const manualMobileInput = document.getElementById('manualMobile');
const manualFileInput = document.getElementById('manualFile');

manualAddBtn.addEventListener('click', async () => {
    const name = manualNameInput.value.trim();
    const mobile = manualMobileInput.value.trim();
    const file = manualFileInput.files[0];

    if (!mobile || !file) {
        alert('Please provide at least a Mobile Number and a PDF File.');
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('mobile', mobile);
    formData.append('pdf', file);

    manualAddBtn.disabled = true;
    manualAddBtn.textContent = 'Adding...';

    try {
        const res = await fetch(`${API_BASE}/queue/manual`, {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            manualNameInput.value = '';
            manualMobileInput.value = '';
            manualFileInput.value = '';
            alert('Item added successfully!');
            fetchQueue();
        } else {
            alert('Failed to add item manually.');
        }
    } catch (e) {
        console.error(e);
        alert('Error adding item.');
    } finally {
        manualAddBtn.disabled = false;
        manualAddBtn.textContent = 'Add to Queue';
    }
});

// 3. Queue Logic
async function fetchQueue() {
    // CRITICAL: Prevent re-rendering if user is currently typing/editing a field
    if (document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') &&
        queueTableBody.contains(document.activeElement)) {
        console.log("Skipping refresh to preserve focus...");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/queue`);
        const rows = await res.json();
        renderQueue(rows);
    } catch (e) {
        console.error(e);
    }
}

function renderQueue(items) {
    queueTableBody.innerHTML = '';
    items.forEach(item => {
        const tr = document.createElement('tr');
        let statusColor = 'text-gray-600';
        if (item.status === 'completed') statusColor = 'text-green-600 font-bold';
        if (item.status === 'processing') statusColor = 'text-blue-600 font-bold';
        if (item.status === 'failed') statusColor = 'text-red-600 font-bold';

        tr.innerHTML = `
            <td class="px-4 py-2">${item.id}</td>
            <td class="px-4 py-2 truncate max-w-xs" title="${item.original_filename}">${item.original_filename}</td>
            <td class="px-4 py-2">
                <input type="text" id="name-${item.id}" class="border rounded px-1 w-full text-sm" 
                       value="${item.name || ''}" 
                       ${item.status !== 'pending' && item.status !== 'failed' ? 'disabled' : ''}>
            </td>
            <td class="px-4 py-2">
                <input type="text" id="mobile-${item.id}" 
                       class="border rounded px-1 w-full text-sm ${!item.mobile ? 'border-red-500 bg-red-50' : ''}" 
                       placeholder="Required: 12-digit"
                       value="${item.mobile || ''}" 
                       ${item.status !== 'pending' && item.status !== 'failed' ? 'disabled' : ''}>
            </td>
            <td class="px-4 py-2 ${statusColor}">${item.status}</td>
            <td class="px-4 py-2 text-sm space-x-1">
                 ${item.status === 'pending' || item.status === 'failed' ?
                `<button onclick="saveRow(${item.id})" class="text-blue-500 hover:text-blue-700">Save</button> | 
                   <button onclick="deleteItem(${item.id})" class="text-red-500 hover:text-red-700">Del</button>`
                : '-'}
            </td>
        `;
        queueTableBody.appendChild(tr);
    });
}

window.saveRow = async (id) => {
    const name = document.getElementById(`name-${id}`).value;
    const mobile = document.getElementById(`mobile-${id}`).value;
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '...';

    try {
        await fetch(`${API_BASE}/queue/update/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mobile })
        });
        fetchQueue();
    } catch (e) {
        alert('Save failed');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

window.deleteItem = async (id) => {
    if (!confirm('Delete item?')) return;
    await fetch(`${API_BASE}/queue/${id}`, { method: 'DELETE' });
    fetchQueue();
}

saveTemplateBtn.addEventListener('click', async () => {
    const template = messageTemplate.value;
    await fetch(`${API_BASE}/queue/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
    });
    alert('Template applied!');
    fetchQueue();
});

startQueueBtn.addEventListener('click', async () => {
    const mobileInputs = document.querySelectorAll('input[id^="mobile-"]');
    let missingCount = 0;
    mobileInputs.forEach(input => {
        if (!input.disabled && !input.value.trim()) {
            input.classList.add('border-red-500', 'ring-2', 'ring-red-500');
            missingCount++;
        } else {
            input.classList.remove('border-red-500', 'ring-2', 'ring-red-500');
        }
    });

    if (missingCount > 0) {
        alert(`Please provide mobile numbers for ${missingCount} items before starting.`);
        return;
    }

    await fetch(`${API_BASE}/queue/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
    });
});

pauseQueueBtn.addEventListener('click', async () => {
    await fetch(`${API_BASE}/queue/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
    });
});

document.getElementById('clearCompletedBtn').addEventListener('click', fetchQueue);

// Init
setInterval(checkStatus, 3000);
setInterval(fetchQueue, 3000);
checkStatus();
fetchQueue();
