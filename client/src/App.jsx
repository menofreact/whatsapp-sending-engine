import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import Login from './Login';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';

const App = () => {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard' or 'admin'

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // Restore session (simple JWT decode or better, verify with backend. For now, trusting token presence + simplified restore)
            // In a real app, you'd decode payload or fetch /api/me
            // Here assuming if token exists, we are logged in. 
            // Better: Decode token to get username/role.
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUser({ username: payload.username, role: payload.role });
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
        setView('dashboard');
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setView('dashboard');
    };

    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    if (view === 'admin' && user.role === 'admin') {
        return (
            <div className="min-h-screen">
                <div className="p-4">
                    <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} /> Back to Dashboard
                    </button>
                </div>
                <AdminPanel />
            </div>
        );
    }

    return (
        <Dashboard
            user={user}
            onLogout={handleLogout}
            onAdminClick={() => setView('admin')}
        />
    );
};

export default App;
