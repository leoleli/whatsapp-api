
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// --- State Management ---
const state = {
    qrCode: null,
    isReady: false,
    webhookUrl: null,
    lastMessages: [],
};

// --- WhatsApp Client Initialization ---
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
        ],
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    authTimeoutMs: 60000,
    qrMaxRetries: 0,
});

// --- WhatsApp Event Handlers ---
function setupWhatsAppEvents() {
    client.on('qr', (qr) => {
        console.log("Evento: qr gerado");
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error("Erro ao gerar QR code:", err);
                return;
            }
            state.qrCode = url;
            state.isReady = false;
        });
    });

    client.on('ready', () => {
        console.log("Evento: ready - WhatsApp conectado!");
        state.isReady = true;
        state.qrCode = null;
    });

    client.on('authenticated', () => {
        console.log("Evento: authenticated - WhatsApp autenticado!");
    });

    client.on('disconnected', (reason) => {
        console.log("Evento: disconnected - WhatsApp desconectado!", reason);
        state.isReady = false;
        // Tenta reinicializar o cliente
        client.initialize().catch(err => console.error("Erro ao reinicializar o cliente:", err));
    });

    client.on('message', async (msg) => {
        const messageData = {
            from: msg.from,
            body: msg.body,
            timestamp: Date.now()
        };
        state.lastMessages.unshift(messageData); // Adiciona no início para manter as mais recentes
        if (state.lastMessages.length > 50) { // Limita o número de mensagens armazenadas
            state.lastMessages.pop();
        }

        if (state.webhookUrl) {
            try {
                await axios.post(state.webhookUrl, messageData);
            } catch (e) {
                console.error("Erro ao enviar webhook:", e.message);
            }
        }
    });
}

// --- Express App Setup ---
const app = express();
app.use(bodyParser.json({ limit: '50mb' })); // Aumenta o limite para envio de mídia
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// --- Security Middleware ---
const VALID_TOKENS = process.env.VALID_TOKENS ? process.env.VALID_TOKENS.split(',') : [];

function verifyToken(req, res, next) {
    const token = req.headers['x-access-token'] || req.body.token;
    if (!token || !VALID_TOKENS.includes(token)) {
        console.warn(`Tentativa de acesso com token inválido: ${token}`);
        return res.status(401).json({ error: 'Token inválido ou ausente' });
    }
    next();
}

// --- API Routes ---
function setupRoutes() {
    // Public routes
    app.get('/api/status', (req, res) => {
        res.json({
            isReady: state.isReady,
            qrCode: state.qrCode,
            status: state.isReady ? 'authenticated' : (state.qrCode ? 'scan' : 'loading')
        });
    });

    app.get('/api/qr', (req, res) => {
        if (state.qrCode) {
            res.json({ qr: state.qrCode, status: 'scan' });
        } else if (state.isReady) {
            res.json({ status: 'authenticated' });
        } else {
            res.json({ status: 'loading' });
        }
    });

    app.post('/api/validate-token', (req, res) => {
        const { token } = req.body;
        res.json({ valid: VALID_TOKENS.includes(token) });
    });

    // Protected routes
    const protectedRoutes = express.Router();
    protectedRoutes.use(verifyToken);

    protectedRoutes.post('/reconnect', (req, res) => {
        console.log("Recebida solicitação para reconectar...");
        client.initialize().catch(err => console.error("Erro ao tentar reconectar manualmente:", err));
        res.json({ status: 'reconnecting' });
    });

    protectedRoutes.post('/message', async (req, res) => {
        const { number, message } = req.body;
        if (!state.isReady) return res.status(400).json({ error: 'WhatsApp não está pronto' });
        if (!number || !message) return res.status(400).json({ error: 'Número e mensagem são obrigatórios' });

        try {
            const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
            await client.sendMessage(chatId, message);
            res.json({ status: 'Mensagem enviada com sucesso' });
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            res.status(500).json({ error: 'Falha ao enviar mensagem', details: error.message });
        }
    });

    protectedRoutes.post('/media', async (req, res) => {
        const { number, caption, mediaUrl } = req.body;
        if (!state.isReady) return res.status(400).json({ error: 'WhatsApp não está pronto' });
        if (!number || !mediaUrl) return res.status(400).json({ error: 'Número e URL da mídia são obrigatórios' });

        try {
            const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
            const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
            await client.sendMessage(chatId, media, { caption });
            res.json({ status: 'Mídia enviada com sucesso' });
        } catch (error) {
            console.error("Erro ao enviar mídia:", error);
            res.status(500).json({ error: 'Falha ao enviar mídia', details: error.message });
        }
    });

    protectedRoutes.post('/webhook', (req, res) => {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL do webhook é obrigatória" });
        state.webhookUrl = url;
        console.log(`Webhook registrado para: ${url}`);
        res.json({ status: 'Webhook registrado com sucesso' });
    });

    protectedRoutes.get('/messages', (req, res) => {
        res.json(state.lastMessages);
    });

    app.use('/api', protectedRoutes);
}


// --- Server Start ---
function startServer() {
    setupWhatsAppEvents();
    setupRoutes();

    client.initialize().catch(err => {
        console.error("Erro fatal ao inicializar o cliente do WhatsApp:", err);
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`API WhatsApp rodando na porta ${PORT}`);
    });
}

startServer();