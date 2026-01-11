import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Users, Key, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

const AdminPanel = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/admin/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/users', newUser);
            setMessage({ type: 'success', text: 'User created successfully' });
            setNewUser({ username: '', password: '', role: 'user' });
            fetchUsers();
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to create user' });
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto p-8">
            <header className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 text-purple-400">
                    <Shield size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Admin Console</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage system access and users.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create User Form */}
                <section className="glass-panel p-8 h-fit">
                    <h3 className="text-lg font-bold mb-6 uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <UserPlus size={18} /> Add New User
                    </h3>
                    <form onSubmit={handleCreateUser} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Username</label>
                            <input
                                className="input-field w-full h-12 bg-white/5 border-white/10 hover:border-white/20 transition-all rounded-xl px-4"
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Password</label>
                            <input
                                className="input-field w-full h-12 bg-white/5 border-white/10 hover:border-white/20 transition-all rounded-xl px-4"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Role</label>
                            <select
                                className="input-field w-full h-12 bg-white/5 border-white/10 hover:border-white/20 transition-all rounded-xl px-4 text-gray-300"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            >
                                <option value="user">Standard User</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                        <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-[0.2em] py-3 rounded-xl shadow-lg shadow-purple-900/20 transition-all mt-4">
                            Create User
                        </button>
                    </form>
                    {message && (
                        <div className={`mt-4 p-3 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {message.text}
                        </div>
                    )}
                </section>

                {/* User List */}
                <section className="lg:col-span-2 glass-panel overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-lg font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Users size={18} /> Active Accounts
                        </h3>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-400">{users.length} Users</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Username</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Created At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-white/[0.02]">
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">#{user.id}</td>
                                        <td className="px-6 py-4 font-bold text-white">{user.username}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[9px] uppercase font-black tracking-wider ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdminPanel;
