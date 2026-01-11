import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    MessageSquare,
    Upload,
    Send,
    AlertCircle,
    CheckCircle2,
    RefreshCcw,
    User,
    Phone,
    FileText,
    Edit,
    Trash2,
    LogOut,
    Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper Components
const NavItem = ({ icon, label, active, onClick, showDot }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all relative ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-white/5'
            }`}
    >
        {icon}
        <span className="font-medium">{label}</span>
        {showDot && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
    </button>
);

const StatusBadge = ({ status }) => {
    const configs = {
        WORKING: { color: 'text-emerald-400', label: 'Engine Active' },
        SCAN_QR_CODE: { color: 'text-amber-400', label: 'Action Required: Scan QR' },
        OFFLINE: { color: 'text-red-400', label: 'Engine Offline' },
        STARTING: { color: 'text-blue-400', label: 'Initializing...' },
        INITIALIZING: { color: 'text-blue-400', label: 'Setting up...' },
        UNKNOWN: { color: 'text-gray-400', label: 'Connecting...' }
    };
    const config = configs[status] || configs.UNKNOWN;
    return (
        <div className="flex items-center gap-2 glass-panel px-4 py-2 border-white/5 shadow-inner">
            <div className={`w-2.5 h-2.5 rounded-full ${config.color === 'text-emerald-400' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
                config.color === 'text-amber-400' ? 'bg-amber-400 animate-pulse' : 'bg-gray-400'}`} />
            <span className={`text-xs font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
        </div>
    );
};

const Dashboard = ({ user, onLogout, onAdminClick }) => {
    const [status, setStatus] = useState({ status: 'UNKNOWN' });
    const [qr, setQr] = useState(null);
    const [reports, setReports] = useState([]);
    const [template, setTemplate] = useState('Your Lab report is here from RIMS Hospital Raichur');
    const [manualEntry, setManualEntry] = useState({ name: '', mobile: '', message: 'Your Lab report is here from RIMS Hospital Raichur', pdf: null });
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [message, setMessage] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [queue, setQueue] = useState([]);

    // Sync manual message with template
    useEffect(() => {
        setManualEntry(prev => ({ ...prev, message: template }));
    }, [template]);

    // Polling for status, queue, and reports
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await axios.get('/api/status');
                // console.log('Current Status:', res.data.status);
                setStatus(res.data);
                if (res.data.status === 'SCAN_QR_CODE') fetchQR();
            } catch (err) { console.error('Status Fetch Error:', err); }
        };

        const fetchQueue = async () => {
            try {
                const res = await axios.get('/api/queue');
                setQueue(res.data);
            } catch (err) { console.error(err); }
        };

        const fetchReports = async () => {
            try {
                const res = await axios.get('/api/reports');
                setReports(res.data);
            } catch (err) { console.error(err); }
        };

        fetchStatus();
        fetchQueue();
        fetchReports();
        const interval = setInterval(() => {
            fetchStatus();
            fetchQueue();
            fetchReports();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchQR = async () => {
        try {
            const res = await axios.get('/api/qr');
            setQr(res.data.image);
        } catch (err) { setQr(null); }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();

        if (!manualEntry.mobile && !manualEntry.pdf) {
            setMessage({ type: 'error', text: 'Mobile number is required for text messages' });
            return;
        }

        const formData = new FormData();
        formData.append('name', manualEntry.name);
        formData.append('mobile', manualEntry.mobile);
        formData.append('message', manualEntry.message);
        if (manualEntry.pdf) formData.append('pdf', manualEntry.pdf);

        try {
            setMessage({ type: 'success', text: 'Sending message...' });
            await axios.post('/api/send/direct', formData);
            setManualEntry({ name: '', mobile: '', message: '', pdf: null });
            setMessage({ type: 'success', text: 'Message sent successfully' });
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Failed to send message';
            setMessage({ type: 'error', text: errorMsg });
        }
    };

    const handlePdfSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setManualEntry(prev => ({ ...prev, pdf: file }));
        setMessage({ type: 'success', text: 'Extracting data from PDF...' });

        // Create FormData and call preview API
        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const res = await axios.post('/api/pdf/preview', formData);

            // Auto-fill extracted data
            setManualEntry(prev => ({
                ...prev,
                name: res.data.name || prev.name,
                mobile: res.data.mobile || prev.mobile,
                pdf: file
            }));

            if (res.data.needsManualEntry) {
                const missing = [];
                if (!res.data.name) missing.push('name');
                if (!res.data.mobile) missing.push('mobile number');
                setMessage({
                    type: 'error',
                    text: `Could not extract ${missing.join(' and ')} from PDF. Please enter manually.`
                });
            } else {
                setMessage({
                    type: 'success',
                    text: `Extracted: ${res.data.name} - ${res.data.mobile}`
                });
            }
        } catch (err) {
            setMessage({
                type: 'error',
                text: 'Could not extract data from PDF. Please enter name and mobile manually.'
            });
        }
    };

    const handleBulkUpload = async (e) => {
        const formData = new FormData();
        for (const file of e.target.files) formData.append('pdfs', file);
        try {
            setMessage({ type: 'success', text: 'Uploading and extracting data from PDFs...' });
            const res = await axios.post('/api/upload', formData);

            if (res.data.warningMessage) {
                setMessage({ type: 'error', text: res.data.warningMessage });
            } else {
                setMessage({ type: 'success', text: `${res.data.success} files uploaded successfully` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Upload failed' });
        }
    };

    const startQueue = async () => {
        try {
            setIsProcessing(true);
            await axios.post('/api/queue/start', { messageTemplate: template });
            setMessage({ type: 'success', text: 'Queue processing started' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to start queue' });
        } finally {
            setIsProcessing(false);
        }
    };

    const approveAll = async () => {
        try {
            await axios.post('/api/queue/approve-staged');
            setMessage({ type: 'success', text: 'All staged items approved' });
        } catch (err) { setMessage({ type: 'error', text: 'Approval failed' }); }
    };

    const updateItem = async (id, name, mobile) => {
        try {
            await axios.post('/api/queue/update', { id, name, mobile });
            setEditingItem(null);
            setMessage({ type: 'success', text: 'Saved' });
        } catch (err) { setMessage({ type: 'error', text: 'Save failed' }); }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect?')) return;
        setIsProcessing(true); // Reuse processing state for UI feedback
        try {
            await axios.post('/api/logout');
            setStatus({ status: 'SCAN_QR_CODE' });
            setMessage({ type: 'success', text: 'Disconnected successfully' });
            setQr(null);
        } catch (err) { setMessage({ type: 'error', text: 'Logout failed' }); }
        finally { setIsProcessing(false); }
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <nav className="w-64 glass-panel m-4 flex flex-col items-center py-8 space-y-8 hidden md:flex">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">ENGINE DASHBOARD</h1>
                <div className="flex flex-col w-full px-4 space-y-2">
                    <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <NavItem icon={<Send size={20} />} label="Bulk Send" active={activeTab === 'bulk-send'} onClick={() => setActiveTab('bulk-send')} showDot={queue.length > 0} />
                    <NavItem icon={<CheckCircle2 size={20} />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
                </div>

                <div className="mt-auto w-full px-4 space-y-2 border-t border-white/10 pt-4">
                    {user.role === 'admin' && (
                        <NavItem icon={<Shield size={20} />} label="Admin Panel" onClick={onAdminClick} />
                    )}
                    <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut size={20} />
                        <span className="font-medium">Logout</span>
                    </button>
                    <div className="text-[10px] text-gray-500 text-center uppercase font-black tracking-widest pt-2">{user.username}</div>
                </div>
            </nav>

            <main className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">
                {/* Header */}
                <header className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">System Console <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded ml-2">v3.0 (Multi-User)</span></h2>
                        <p className="text-gray-500 text-sm mt-1">Manage your automated WhatsApp campaigns.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <StatusBadge status={status.status} />
                    </div>
                </header>

                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Connection Status Widget */}
                        <section className="lg:col-span-1 glass-panel p-8 flex flex-col items-center justify-center space-y-6 min-h-[350px] relative overflow-hidden group">
                            <h3 className="text-lg font-bold self-start mb-2 uppercase tracking-widest text-gray-400">Connection</h3>
                            {status.status === 'SCAN_QR_CODE' && qr ? (
                                <div className="bg-white p-5 rounded-2xl shadow-2xl shadow-blue-500/40 transform hover:scale-105 transition-transform">
                                    <img src={`data:image/png;base64,${qr}`} alt="QR" className="w-48 h-48" />
                                    <p className="text-gray-900 text-[10px] text-center mt-3 font-black uppercase tracking-tighter">Scan with WhatsApp</p>
                                </div>
                            ) : status.status === 'WORKING' || status.status === 'ONLINE' ? (
                                <div className="flex flex-col items-center space-y-5">
                                    <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                                        <CheckCircle2 size={56} className="text-emerald-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-emerald-400 font-black uppercase tracking-widest text-sm">Engine Active</p>
                                        <p className="text-gray-500 text-xs mt-1">Ready to transmit</p>
                                        <div className="flex gap-2 mt-4 justify-center">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Restart Engine?')) return;
                                                    setIsProcessing(true);
                                                    try { await axios.post('/api/restart'); setStatus({ status: 'INITIALIZING' }); setMessage({ type: 'success', text: 'Restarting...' }); }
                                                    catch (e) { setMessage({ type: 'error', text: 'Restart failed' }); }
                                                    finally { setIsProcessing(false); }
                                                }}
                                                disabled={isProcessing}
                                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest border border-blue-400/20 hover:bg-blue-400/10 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                                            >
                                                Restart
                                            </button>
                                            <button
                                                onClick={handleDisconnect}
                                                disabled={isProcessing}
                                                className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest border border-red-500/20 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : status.status === 'INITIALIZING' || status.status === 'STARTING' ? (
                                <div className="flex flex-col items-center space-y-6">
                                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                        <RefreshCcw size={48} className="text-blue-400 animate-spin" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-blue-400 font-bold uppercase tracking-widest text-sm animate-pulse">Booting Engine...</p>
                                        <p className="text-gray-500 text-xs mt-1">Please wait a moment</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center space-y-6">
                                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                        <RefreshCcw size={48} className="text-blue-400 animate-spin-slow" />
                                    </div>
                                    <button className="glass-button bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-blue-500/20" onClick={() => axios.post('/api/start')}>Initialize Engine</button>
                                </div>
                            )}
                        </section>

                        {/* Manual Entry Form */}
                        <section className="lg:col-span-2 glass-panel p-8">
                            <h3 className="text-lg font-bold mb-8 uppercase tracking-widest text-gray-400">Direct Message</h3>
                            <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Recipient Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-400 transition-colors z-10" size={18} />
                                        <input
                                            className="input-field w-full h-12 bg-white/5 border-white/10 hover:border-white/20 transition-all !pl-20"
                                            placeholder="John Doe (Optional if PDF attached)"
                                            value={manualEntry.name}
                                            onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Mobile Number</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-emerald-400 transition-colors z-10" size={18} />
                                        <input
                                            className="input-field w-full h-12 bg-white/5 border-white/10 hover:border-white/20 transition-all !pl-20"
                                            placeholder="919998887776"
                                            value={manualEntry.mobile}
                                            onChange={(e) => setManualEntry({ ...manualEntry, mobile: e.target.value })}
                                            required={!manualEntry.pdf}
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Message Content</label>
                                    <div className="relative group">
                                        <MessageSquare className="absolute left-5 top-4 text-gray-600 group-focus-within:text-blue-400 transition-colors z-10" size={18} />
                                        <textarea
                                            className="input-field w-full h-32 pt-4 resize-none bg-white/5 border-white/10 hover:border-white/20 transition-all !pl-20"
                                            placeholder="Type your message..."
                                            value={manualEntry.message}
                                            onChange={(e) => setManualEntry({ ...manualEntry, message: e.target.value })}
                                            required={!manualEntry.pdf}
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Attachment (PDF)</label>
                                    <label className="flex items-center w-full bg-white/5 border border-dashed border-white/20 rounded-xl p-4 hover:border-blue-500/50 transition-colors cursor-pointer group">
                                        <Upload size={20} className="text-gray-500 mr-4 group-hover:text-blue-400" />
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            className="hidden"
                                            onChange={handlePdfSelect}
                                        />
                                        <span className="text-xs text-gray-600 italic ml-auto">{manualEntry.pdf ? manualEntry.pdf.name : 'Click to attach PDF (will auto-extract name & mobile)'}</span>
                                    </label>
                                </div>
                                <div className="md:col-span-2 pt-4">
                                    <button type="submit" className="glass-button w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-xl shadow-emerald-900/20 transition-all active:scale-[0.98]">
                                        Dispatch Message
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}

                {activeTab === 'bulk-send' && (
                    <div className="space-y-8 max-w-6xl">
                        {/* Bulk Upload Section */}
                        <section className="glass-panel p-10 bg-gradient-to-br from-blue-600/[0.03] to-emerald-600/[0.03] border-white/5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-20" />
                            <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10">
                                        <Upload size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Bulk Dispatch</h3>
                                        <p className="text-gray-500 text-sm mt-1">Ingest PDF reports for automated distribution.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input type="file" multiple className="hidden" id="bulk-upload" onChange={handleBulkUpload} />
                                    <label htmlFor="bulk-upload" className="glass-button bg-white text-gray-900 px-8 py-4 rounded-xl cursor-pointer inline-flex items-center gap-3 font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl shadow-white/5 border-none">
                                        <FileText size={20} /> Select Reports
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* Control Bar */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-3 space-y-3 group glass-panel p-6 border-white/5">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em]">Message Template</label>
                                    <span className="text-[10px] text-blue-500/50 font-mono underline hover:text-blue-400 cursor-help">Template Tags: {'{name}'}</span>
                                </div>
                                <div className="relative">
                                    <MessageSquare className="absolute left-4 top-4 text-gray-700 group-focus-within:text-blue-400 transition-colors z-10" size={20} />
                                    <textarea
                                        className="input-field w-full h-28 pt-4 resize-none text-base font-medium relative z-0 pl-14 bg-black/20 border-white/5 rounded-xl focus:border-blue-500/30 transition-all"
                                        value={template}
                                        onChange={(e) => setTemplate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col h-full">
                                <button
                                    onClick={startQueue}
                                    disabled={isProcessing}
                                    className="glass-button flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-8 h-full flex flex-col items-center justify-center gap-4 font-black text-xl disabled:opacity-50 shadow-2xl shadow-emerald-500/30 rounded-2xl group transition-all"
                                >
                                    <Send size={32} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    <span>{isProcessing ? 'SENDING...' : 'DISPATCH ALL'}</span>
                                </button>
                                {queue.some(i => i.status === 'staged') && (
                                    <button
                                        onClick={approveAll}
                                        className="mt-4 w-full text-center text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-white transition-colors py-2 border border-blue-500/20 rounded-lg bg-blue-500/5"
                                    >
                                        Approve Pipeline
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Queue Table */}
                        <div className="glass-panel overflow-hidden border-white/5 shadow-2xl bg-black/10 backdrop-blur-xl">
                            <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-300">Staging Area</h4>
                                </div>
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-2 text-[9px] uppercase font-black tracking-widest text-blue-400 border border-blue-400/20 px-3 py-1 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(59,130,246,0.5)]" /> Review</div>
                                    <div className="flex items-center gap-2 text-[9px] uppercase font-black tracking-widest text-amber-400 border border-amber-400/20 px-3 py-1 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pending</div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-gray-600 text-[10px] uppercase font-black tracking-[0.2em]">
                                        <tr>
                                            <th className="px-8 py-6">Recipient Identity</th>
                                            <th className="px-8 py-6">Status</th>
                                            <th className="px-8 py-6">Network Identifier</th>
                                            <th className="px-8 py-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <AnimatePresence>
                                            {(Array.isArray(queue) ? queue : []).map((item) => (
                                                <motion.tr
                                                    key={item.id}
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`hover:bg-white/[0.03] transition-colors ${!item.mobile && item.status === 'staged' ? 'bg-red-500/[0.07] border-l-4 border-l-red-500' : ''}`}
                                                >
                                                    <td className="px-8 py-5">
                                                        {editingItem?.id === item.id ? (
                                                            <input
                                                                className="input-field py-2 text-sm w-48 bg-white/10 border-blue-500/50"
                                                                value={editingItem.name}
                                                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 text-blue-400 group-hover:bg-blue-500/10 transition-colors"><User size={20} /></div>
                                                                <div>
                                                                    <div className="font-bold text-white text-base tracking-tight">{item.name || 'Anonymous'}</div>
                                                                    <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Subscriber</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className={`px-3 py-1 rounded-md text-[10px] uppercase font-black w-fit border-2 ${item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            item.status === 'failed' ? 'bg-red-500/20 text-red-100 border-red-500/30' :
                                                                item.status === 'staged' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            }`}>
                                                            {item.status}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-sm font-mono tracking-tighter">
                                                        {editingItem?.id === item.id ? (
                                                            <input
                                                                className="input-field py-2 text-sm w-48 bg-white/10 border-blue-500/50"
                                                                value={editingItem.mobile}
                                                                onChange={(e) => setEditingItem({ ...editingItem, mobile: e.target.value })}
                                                            />
                                                        ) : (
                                                            <span className={!item.mobile ? 'text-red-400 font-black flex items-center gap-2' : 'text-gray-400 font-bold'}>
                                                                {!item.mobile && <AlertCircle size={14} />} {item.mobile || 'MISSING DATA'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-5">
                                                            {editingItem?.id === item.id ? (
                                                                <>
                                                                    <button onClick={() => updateItem(item.id, editingItem.name, editingItem.mobile)} className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Commit</button>
                                                                    <button onClick={() => setEditingItem(null)} className="text-gray-500 text-[10px] font-black uppercase hover:text-white">Abort</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => setEditingItem(item)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"><Edit size={18} /></button>
                                                                    <button onClick={() => axios.delete(`/api/queue/${item.id}`)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"><Trash2 size={18} /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                        {queue.length === 0 && (
                                            <tr><td colSpan="4" className="px-8 py-20 text-center text-gray-600 uppercase font-black tracking-[0.5em] text-xs opacity-50">Empty Dispatch Queue</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-6">
                        <section className="glass-panel overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-lg font-medium">Message History</h3>
                                <div className="text-xs text-gray-400">Showing last 500 records</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="px-6 py-4">Recipient</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Sent Time</th>
                                            <th className="px-6 py-4">Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {reports.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-medium">{item.name}</div>
                                                        <div className="text-xs text-gray-500">{item.mobile}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold w-fit ${item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {item.status}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500">
                                                    {new Date(item.updated_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                                                    {item.error || 'Delivered successfully'}
                                                </td>
                                            </tr>
                                        ))}
                                        {reports.length === 0 && (
                                            <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No history available yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}
            </main>

            {/* Notifications */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border z-50 ${message.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-200' : 'bg-red-900/90 border-red-500/30 text-red-200'
                            }`}
                    >
                        {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        <span className="font-medium">{message.text}</span>
                        <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100 uppercase text-[10px] font-bold">Close</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
