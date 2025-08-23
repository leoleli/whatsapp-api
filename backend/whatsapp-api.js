
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// TOKEN DE ACESSO (ajuste para seu uso)
const VALID_TOKENS = ['ce72d1f374c8f0311f17d9765e246c24']; // Troque para seu token

// Middleware de proteção
function verifyToken(req, res, next) {
    const token = req.headers['x-access-token'] || req.body.token;
    if (!token || !VALID_TOKENS.includes(token)) {
        return res.status(401).json({ error: 'Token inválido ou ausente' });
    }
    next();
}

// Endpoint de validação de token (login)
app.post('/api/validate-token', (req, res) => {
    const { token } = req.body;
    if (VALID_TOKENS.includes(token)) {
        res.json({ valid: true });
    } else {
        res.json({ valid: false });
    }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    authTimeoutMs: 60000,
    qrMaxRetries: 0,
});

let qrCode = null;
let isReady = false;
let webhookUrl = null;
let lastMessages = [];

client.on('qr', (qr) => {
    console.log("Evento: qr gerado");
    qrcode.toDataURL(qr, (err, url) => {
        qrCode = url;
        isReady = false;
    });
});

client.on('ready', () => {
    console.log("Evento: ready - WhatsApp conectado!");
    isReady = true;
    qrCode = null;
});

client.on('authenticated', () => {
    console.log("Evento: authenticated - WhatsApp autenticado!");
});

client.on('disconnected', (reason) => {
    console.log("Evento: disconnected - WhatsApp desconectado!", reason);
    isReady = false;
    client.initialize();
});

client.on('message', async (msg) => {
    lastMessages.push({
        from: msg.from,
        body: msg.body,
        timestamp: Date.now()
    });
    if (webhookUrl) {
        try {
            await axios.post(webhookUrl, { from: msg.from, body: msg.body });
        } catch (e) {}
    }
});

client.initialize();

app.get('/api/qr', (req, res) => {
    if (qrCode) res.json({ qr: qrCode, status: 'scan' });
    else if (isReady) res.json({ status: 'authenticated' });
    else res.json({ status: 'loading' });
});

app.get('/api/status', (req, res) => {
    res.json({ isReady, qrCode });
});

// Endpoints protegidos pelo token
app.post('/api/reconnect', verifyToken, (req, res) => {
    client.initialize();
    res.json({ status: 'reconnecting' });
});

app.post('/api/message', verifyToken, async (req, res) => {
    const { number, message } = req.body;
    if (!isReady) return res.status(400).json({ error: 'WhatsApp não está pronto' });
    try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ status: 'Mensagem enviada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/media', verifyToken, async (req, res) => {
    const { number, caption, mediaUrl } = req.body;
    if (!isReady) return res.status(400).json({ error: 'WhatsApp não está pronto' });
    try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const mimeType = response.headers['content-type'];
        const base64 = Buffer.from(response.data).toString('base64');
        const media = new MessageMedia(mimeType, base64, 'media');
        await client.sendMessage(chatId, media, { caption });
        res.json({ status: 'Mídia enviada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/webhook', verifyToken, (req, res) => {
    webhookUrl = req.body.url;
    res.json({ status: 'Webhook registrado' });
});

app.get('/api/messages', verifyToken, (req, res) => {
    res.json(lastMessages.slice(-20));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`API WhatsApp rodando na porta ${PORT}`);
});