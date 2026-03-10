require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Set up multer for handling file uploads (audio files from ESP32 in memory)
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Functions to interact with OpenAI ---

async function getSetting(key) {
    return new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
            if (err) reject(err);
            resolve(row ? row.value : null);
        });
    });
}

// 1. ESP32 sends Audio -> Whisper -> Returns Text
app.post('/api/stt', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        console.log('Received audio of size:', req.file.size);

        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: 'audio.wav', contentType: 'audio/wav' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'vi');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        const text = response.data.text;
        console.log('Transcribed Text:', text);

        res.json({ text: text });
    } catch (error) {
        console.error('STT Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Speech to text failed' });
    }
});

// 2. ESP32 sends Text -> GPT -> TTS -> Returns MP3 Audio
app.post('/api/chat_tts', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text input is required' });
    }

    try {
        const systemPrompt = await getSetting('system_prompt');
        const voice = await getSetting('voice');

        console.log('User says:', text);

        // A. Call Chat Completions
        const chatResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
        });

        const aiText = chatResponse.data.choices[0].message.content;
        console.log('AI Reply:', aiText);

        // Log to database asynchronously
        db.run('INSERT INTO conversations (user_text, ai_text) VALUES (?, ?)', [text, aiText]);

        // B. Call TTS
        const ttsResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: 'tts-1',
            input: aiText,
            voice: voice,
            response_format: 'mp3'
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            responseType: 'arraybuffer' // Crucial for receiving binary data
        });

        console.log('Streaming MP3 back to ESP32...');

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': ttsResponse.data.length
        });

        // C. Send back raw binary MP3 to the ESP32
        res.send(ttsResponse.data);

    } catch (error) {
        console.error('Chat/TTS Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Chat completion or TTS failed' });
    }
});

// --- Frontend REST APIs ---

// Get conversation history
app.get('/api/history', (req, res) => {
    db.all('SELECT * FROM conversations ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Update settings
app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    if (!key || !value) return res.status(400).json({ error: 'Missing key or value' });

    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Get settings
app.get('/api/settings', (req, res) => {
    db.all('SELECT * FROM settings', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${port}`);
});
