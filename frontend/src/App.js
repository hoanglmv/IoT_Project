import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Settings, Mic, MessageSquare, Server, Cpu, Activity, Send } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3000/api'; // Change to IP if running on phone

function App() {
    const [history, setHistory] = useState([]);
    const [settings, setSettings] = useState({ voice: 'alloy', system_prompt: '' });
    const [showSettings, setShowSettings] = useState(false);
    const [status, setStatus] = useState('Idle'); // Idle, Listening, Processing, Speaking
    const messagesEndRef = useRef(null);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/history`);
            setHistory(res.data.reverse()); // Show chronological
        } catch (e) { console.error(e); }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/settings`);
            setSettings(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchHistory();
        fetchSettings();
        const interval = setInterval(fetchHistory, 3000); // Polling for now
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const saveSettings = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${BACKEND_URL}/settings`, { key: 'voice', value: settings.voice });
            await axios.post(`${BACKEND_URL}/settings`, { key: 'system_prompt', value: settings.system_prompt });
            setShowSettings(false);
            alert('Settings Saved!');
        } catch (e) { alert('Error saving settings'); }
    };

    // Mocking status updates since ESP32 WebSocket isn't there yet
    // In a real scenario, this would be updated via WebSockets from Backend
    useEffect(() => {
        const randomStatuses = ['Idle', 'Idle', 'Listening...', 'Processing...', 'Speaking...'];
        // const statusInterval = setInterval(()=> setStatus(randomStatuses[Math.floor(Math.random()*randomStatuses.length)]), 5000);
        // return () => clearInterval(statusInterval);
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black overflow-hidden relative">

            {/* Background Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]" />

            <div className="w-full max-w-5xl p-6 z-10 flex flex-col h-screen">

                {/* Header */}
                <header className="flex justify-between items-center mb-8 glass-panel px-6 py-4 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Cpu className="text-white w-7 h-7" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 animate-pulse-ring" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">ESP32 Voice AI</h1>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Server className="w-3 h-3" />
                                <span>Backend Online</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-full border border-slate-700">
                            {status === 'Idle' && <Activity className="w-4 h-4 text-blue-400" />}
                            {status === 'Listening...' && <Mic className="w-4 h-4 text-green-400 animate-pulse" />}
                            {status === 'Processing...' && <Server className="w-4 h-4 text-yellow-400 animate-spin-slow" />}
                            {status === 'Speaking...' && <MessageSquare className="w-4 h-4 text-white animate-bounce" />}
                            <span className="text-sm font-medium">{status}</span>
                        </div>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 hover:border-slate-500"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 flex gap-6 overflow-hidden">

                    {/* Chat History Panel */}
                    <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-indigo-400" />
                            <h2 className="font-semibold text-lg">Conversation History</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {history.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                                    <Mic className="w-12 h-12 opacity-50" />
                                    <p>Hold the PTT button on ESP32 to start speaking...</p>
                                </div>
                            ) : (
                                history.map((chat, idx) => (
                                    <div key={idx} className="space-y-4">
                                        {/* User Bubble */}
                                        <div className="flex justify-end">
                                            <div className="max-w-[80%] bg-blue-600/90 hover:bg-blue-500 transition-colors px-5 py-3 rounded-2xl rounded-tr-sm shadow-md">
                                                <p className="text-white text-[15px] leading-relaxed">{chat.user_text}</p>
                                                <span className="text-xs text-blue-200 mt-2 block w-full text-right opacity-80">You • {new Date(chat.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                        {/* AI Bubble */}
                                        <div className="flex justify-start items-end gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 flex items-center justify-center border border-white/10">
                                                <Cpu className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="max-w-[80%] bg-slate-700/80 hover:bg-slate-700 transition-colors px-5 py-3 rounded-2xl rounded-tl-sm shadow-md border border-white/5">
                                                <p className="text-slate-100 text-[15px] leading-relaxed">{chat.ai_text}</p>
                                                <span className="text-xs text-slate-400 mt-2 block w-full text-left">Agent • OpenAI</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Side Settings Panel (conditionally rendered or right-pane) */}
                    {showSettings && (
                        <div className="w-80 glass-panel rounded-2xl flex flex-col animation-slide-in">
                            <div className="p-4 border-b border-white/10 bg-black/20">
                                <h2 className="font-semibold text-lg">Configuration</h2>
                            </div>
                            <form onSubmit={saveSettings} className="p-6 space-y-6 flex-1 overflow-y-auto">

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Voice Persona</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(v => (
                                            <button
                                                type="button"
                                                key={v}
                                                onClick={() => setSettings({ ...settings, voice: v })}
                                                className={`capitalize px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none ${settings.voice === v
                                                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                                                    }`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">System Prompt</label>
                                    <textarea
                                        value={settings.system_prompt}
                                        onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                                        className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                        placeholder="Tell the AI how to behave..."
                                    />
                                    <p className="text-xs text-slate-500">Defines the fundamental behavior, tone, and format of the assistant's responses.</p>
                                </div>

                                <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Save Configuration
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default App;
