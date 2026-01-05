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
    Clock,
    Trash2,
    Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App = () => {
    const [status, setStatus] = useState({ status: 'UNKNOWN' });
    const [qr, setQr] = useState(null);
    const [queue, setQueue] = useState([]);
    const [template, setTemplate] = useState('Hello {name}, please find your report attached.');
    const [manualEntry, setManualEntry] = useState({ name: '', mobile: '', message: '', pdf: null });
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [message, setMessage] = useState(null);

    // Polling for status and queue
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await axios.get('/api/status');
                console.log('Current Status:', res.data.status);
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

        fetchStatus();
        fetchQueue();
        const interval = setInterval(() => {
            fetchStatus();
            fetchQueue();
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

    const handleBulkUpload = async (e) => {
        const formData = new FormData();
        for (const file of e.target.files) formData.append('pdfs', file);
        try {
            await axios.post('/api/upload', formData);
            setMessage({ type: 'success', text: 'Files uploaded and processed' });
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

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <nav className="w-64 glass-panel m-4 flex flex-col items-center py-8 space-y-8 hidden md:flex">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">WAHA SENDER</h1>
                <div className="flex flex-col w-full px-4 space-y-2">
                    <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <NavItem icon={<MessageSquare size={20} />} label="Queue" active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} />
                    <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </div>
            </nav>

            <main className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">
                {/* Header */}
                <header className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-semibold">Welcome back, Zareef</h2>
                        <p className="text-gray-400 text-sm">System is running smooth.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <StatusBadge status={status.status} />
                    </div>
                </header>

                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Connection Status Widget */}
                        <section className="lg:col-span-1 glass-panel p-6 flex flex-col items-center justify-center space-y-4 min-h-[300px]">
                            <h3 className="text-lg font-medium self-start mb-2">WhatsApp Connection</h3>
                            {status.status === 'SCAN_QR_CODE' && qr ? (
                                <div className="bg-white p-4 rounded-xl shadow-2xl shadow-blue-500/20">
                                    <img src={`data:image/png;base64,${qr}`} alt="QR" className="w-48 h-48" />
                                    <p className="text-gray-900 text-xs text-center mt-2 font-medium">Scan to Connect</p>
                                </div>
                            ) : status.status === 'WORKING' || status.status === 'ONLINE' ? (
                                <div className="flex flex-col items-center space-y-4">
                                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                                        <CheckCircle2 size={48} className="text-emerald-400" />
                                    </div>
                                    <p className="text-emerald-400 font-medium">Connected & Active</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center space-y-4">
                                    <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                                        <RefreshCcw size={48} className="text-blue-400 animate-spin-slow" />
                                    </div>
                                    <button className="glass-button" onClick={() => axios.post('/api/start')}>Start Session</button>
                                </div>
                            )}
                        </section>

                        {/* Manual Entry Form */}
                        <section className="lg:col-span-2 glass-panel p-6">
                            <h3 className="text-lg font-medium mb-6">Quick Add</h3>
                            <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Recipient Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors z-10" size={18} />
                                        <input
                                            className="input-field w-full relative z-0 force-padding"
                                            placeholder="e.g. John Doe"
                                            value={manualEntry.name}
                                            onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Mobile Number</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors z-10" size={18} />
                                        <input
                                            className="input-field w-full relative z-0 force-padding"
                                            placeholder="919998887776"
                                            value={manualEntry.mobile}
                                            onChange={(e) => setManualEntry({ ...manualEntry, mobile: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Message Box</label>
                                    <div className="relative group">
                                        <MessageSquare className="absolute left-4 top-4 text-gray-500 group-focus-within:text-blue-400 transition-colors z-10" size={18} />
                                        <textarea
                                            className="input-field w-full h-32 resize-none relative z-0 force-padding-textarea"
                                            placeholder="Type your message here..."
                                            value={manualEntry.message}
                                            onChange={(e) => setManualEntry({ ...manualEntry, message: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">PDF Report (Optional)</label>
                                    <input
                                        type="file"
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30"
                                        onChange={(e) => setManualEntry({ ...manualEntry, pdf: e.target.files[0] })}
                                    />
                                </div>
                                <div className="md:col-span-2 pt-2">
                                    <button type="submit" className="glass-button w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 py-3">
                                        <Send size={18} /> Send Directly
                                    </button>
                                </div>
                            </form>
                        </section>

                        {/* Bulk Upload Section */}
                        <section className="lg:col-span-3 glass-panel p-8 bg-gradient-to-br from-blue-600/10 to-emerald-600/10 border-blue-500/20">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-4 bg-blue-500/20 rounded-full border border-blue-500/30">
                                    <FileText size={32} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold">Bulk Upload Reports</h3>
                                    <p className="text-gray-400 text-sm mt-1">Upload multiple PDFs. We'll automatically extract names and mobile numbers.</p>
                                </div>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    id="bulk-upload"
                                    onChange={handleBulkUpload}
                                />
                                <label htmlFor="bulk-upload" className="glass-button bg-blue-500/20 px-8 py-3 cursor-pointer inline-flex items-center gap-2 font-semibold">
                                    Select PDF Files
                                </label>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'queue' && (
                    <div className="space-y-6">
                        {/* Control Bar */}
                        <div className="glass-panel p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex-1 w-full md:w-auto relative group">
                                <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Message Template</label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-4 top-4 text-gray-500 group-focus-within:text-blue-400 transition-colors z-10" size={18} />
                                    <textarea
                                        className="input-field w-full h-24 pt-3 resize-none text-sm relative z-0 force-padding-textarea"
                                        value={template}
                                        onChange={(e) => setTemplate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={startQueue}
                                disabled={isProcessing}
                                className="glass-button bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 h-fit flex items-center gap-2 font-bold text-lg disabled:opacity-50"
                            >
                                <Send size={20} /> {isProcessing ? 'Processing...' : 'Start Sending'}
                            </button>
                        </div>

                        {/* Queue Table */}
                        <div className="glass-panel overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="px-6 py-4">Recipient</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Created At</th>
                                            <th className="px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <AnimatePresence>
                                            {queue.map((item) => (
                                                <motion.tr
                                                    key={item.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-blue-500/10 p-2 rounded-lg"><User size={16} className="text-blue-400" /></div>
                                                            <div>
                                                                <div className="font-medium">{item.name || 'Unknown'}</div>
                                                                <div className="text-xs text-gray-500">{item.mobile}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold w-fit ${item.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' :
                                                            item.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                                                'bg-amber-500/10 text-amber-400'
                                                            }`}>
                                                            {item.status}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-gray-500">
                                                        {new Date(item.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </div>
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

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-white/5'
            }`}
    >
        {icon}
        <span className="font-medium">{label}</span>
    </button>
);

const StatusBadge = ({ status }) => {
    const configs = {
        WORKING: { color: 'text-emerald-400', label: 'Online' },
        SCAN_QR_CODE: { color: 'text-amber-400', label: 'Scan QR' },
        OFFLINE: { color: 'text-red-400', label: 'Offline' },
        UNKNOWN: { color: 'text-gray-400', label: 'Connecting...' }
    };
    const config = configs[status] || configs.UNKNOWN;
    return (
        <div className="flex items-center gap-2 glass-panel px-3 py-1.5 border-white/5">
            <div className={`w-2 h-2 rounded-full ${config.color === 'text-emerald-400' ? 'bg-emerald-400 outline outline-4 outline-emerald-400/20' : 'bg-gray-400'}`} />
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
    );
};

export default App;
