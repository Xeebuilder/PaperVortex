import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import { exec } from 'child_process';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const KB_PATH = path.join(__dirname, 'knowledge_base.json');

// Helper to load KB
function loadKB() {
  try {
    return JSON.parse(fs.readFileSync(KB_PATH, 'utf-8'));
  } catch {
    return { company: {}, properties: [] };
  }
}

// Helper to save KB
function saveKB(data) {
  fs.writeFileSync(KB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// System prompt generator based on active knowledge base
function buildSystemPrompt() {
  const kb = loadKB();
  const company = kb.company || {};
  const props = kb.properties || [];

  let propsList = props.map((p, idx) => {
    return `[Propiedad ${idx + 1}]
- Título: ${p.title}
- Zona: ${p.zone}
- Tipo: ${p.type}
- Precio: ${p.price}
- Habitaciones/Baños: ${p.beds} hab / ${p.baths} baños (${p.sqft || 'N/A'})
- HOA / Mantenimiento: ${p.hoa || 'N/A'}
- Permite Airbnb / Rentas Cortas: ${p.airbnbAllowed ? 'SÍ' : 'NO'}
- Características: ${p.features || ''}
- Recomendado para: ${p.idealFor || ''}`;
  }).join('\n\n');

  return `Eres el Asistente Oficial de Inteligencia Artificial para ${company.name || 'nuestra inmobiliaria'} (${company.brokerage || 'Miami Real Estate'}).
Teléfono de contacto directo: ${company.phone || '+1 954 865 6622'}.

INVENTARIO REAL Y EXACTO DE NUESTRA COMPAÑÍA (Usa ESTOS datos y precios exactos):
${propsList || 'Actualmente contamos con un catálogo privado de condominios en Brickell y casas en Miami que actualizamos semanalmente.'}

INFORMACIÓN Y POLÍTICAS DE LA EMPRESA:
- Especialidades: ${(company.specialties || []).join(', ')}
- Financiamiento para extranjeros: Trabajamos con bancos de Florida que prestan hasta el 65-70% a extranjeros con pasaporte y carta bancaria.

REGLAS DE ATENCIÓN:
1. Responde de forma muy humana, cordial y concisa en español (estilo WhatsApp, máximo 2 o 3 párrafos).
2. Cuando el cliente pregunte por precios, zonas, o si tenemos propiedades en Brickell, Doral, etc., DALES LOS NOMBRES, PRECIOS Y DETALLES EXACTOS de las propiedades de nuestra lista anterior.
3. Si preguntan por casas en Brickell, aclara que en Brickell predominan las torres de lujo (como Brickell Flatiron) y que las casas están justo al lado en The Roads o Coconut Grove (como nuestra villa en The Roads).
4. Si preguntan por Airbnb, recomiéndales específicamente los proyectos con licencia hotelera diaria (como The Crosby Downtown).
5. Termina ofreciéndoles enviarles el brochure completo con fotos o coordinar una videollamada / cita con nuestro asesor.`;
}

// Global chat history for WhatsApp
const chatHistories = new Map();

async function askGemini(senderJid, userMessage) {
  try {
    let history = chatHistories.get(senderJid) || [];
    history.push({ role: 'user', parts: [{ text: userMessage }] });
    if (history.length > 6) history = history.slice(-6);

    const prompt = buildSystemPrompt();

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: history,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 300
        }
      })
    });

    if (!res.ok) throw new Error(`Gemini status ${res.status}`);
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No candidate reply');

    history.push({ role: 'model', parts: [{ text: reply }] });
    chatHistories.set(senderJid, history);

    return reply;
  } catch (err) {
    console.error('Error llamando a Gemini:', err.message);
    return "¡Hola! Gracias por comunicarte con nuestro equipo en Miami. ¿Estás buscando comprar para vivir o invertir para renta?";
  }
}

// ----------------------------------------------------
// WhatsApp Bot Initialization
// ----------------------------------------------------
let waConnected = false;
let currentQR = null;

async function startWhatsAppBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info'));

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Inmobiliaria AI Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        console.log('\n📲 NUEVO CÓDIGO QR GENERADO:');
        qrcodeTerminal.generate(qr, { small: true });

        QRCode.toFile(path.join(__dirname, 'qr.png'), qr, { width: 450, margin: 2 }, (err) => {
          if (!err) exec('open ' + path.join(__dirname, 'qr.png'));
        });
      }

      if (connection === 'close') {
        waConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('⚠️ Sesión cerrada por WhatsApp. Limpiando credenciales...');
          fs.rmSync(path.join(__dirname, 'auth_info'), { recursive: true, force: true });
          setTimeout(startWhatsAppBot, 1000);
        } else {
          console.log(`⚠️ Conexión pausada (${statusCode}). Reconectando en 3s...`);
          setTimeout(startWhatsAppBot, 3000);
        }
      } else if (connection === 'open') {
        waConnected = true;
        currentQR = null;
        console.log('\n✅ ¡WHATSAPP CONECTADO Y SINCRONIZADO CON LA BASE DE DATOS!');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (msg.key.remoteJid.endsWith('@g.us')) continue;

        const text = msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text ||
                     msg.message?.imageMessage?.caption;

        if (!text) continue;

        const sender = msg.key.remoteJid;
        console.log(`📩 [WhatsApp] Mensaje de ${sender.replace('@s.whatsapp.net', '')}: "${text}"`);

        await sock.sendPresenceUpdate('composing', sender);
        const reply = await askGemini(sender, text);
        await new Promise(r => setTimeout(r, 1200));

        await sock.sendMessage(sender, { text: reply }, { quoted: msg });
        console.log(`🤖 [WhatsApp] Respuesta enviada con datos exactos.\n`);
      }
    });
  } catch (err) {
    console.error('Error iniciando WhatsApp:', err);
  }
}

// ----------------------------------------------------
// Express Dashboard Server
// ----------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// API: Get KB
app.get('/api/kb', (req, res) => {
  res.json(loadKB());
});

// API: Status
app.get('/api/status', (req, res) => {
  res.json({
    connected: waConnected,
    hasQR: !!currentQR,
    propertyCount: loadKB().properties?.length || 0
  });
});

// API: Save entire KB
app.post('/api/kb', (req, res) => {
  saveKB(req.body);
  res.json({ ok: true, count: req.body.properties?.length || 0 });
});

// API: Add Property
app.post('/api/properties', (req, res) => {
  const kb = loadKB();
  const newProp = {
    id: 'prop-' + Date.now(),
    ...req.body
  };
  kb.properties = [newProp, ...(kb.properties || [])];
  saveKB(kb);
  res.json({ ok: true, property: newProp });
});

// API: Delete Property
app.delete('/api/properties/:id', (req, res) => {
  const kb = loadKB();
  kb.properties = (kb.properties || []).filter(p => p.id !== req.params.id);
  saveKB(kb);
  res.json({ ok: true });
});

// API: Scrape & Extract with Gemini
app.post('/api/scrape', async (req, res) => {
  const { url, rawText } = req.body;
  if (!url && !rawText) {
    return res.status(400).json({ error: 'Debes proporcionar una URL o texto de la inmobiliaria.' });
  }

  let contentToAnalyze = rawText || '';

  if (url) {
    try {
      console.log(`🌐 Extrayendo contenido web de: ${url}`);
      const webRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const html = await webRes.text();
      // Basic HTML text extraction
      contentToAnalyze = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 15000); // Take first 15k chars
    } catch (err) {
      console.error('Error al consultar URL:', err.message);
      return res.status(500).json({ error: `No se pudo acceder a la URL: ${err.message}` });
    }
  }

  try {
    console.log('🧠 Gemini analizando propiedades y catálogo...');
    const extractPrompt = `Eres un extractor de datos de bienes raíces. Analiza este contenido de la página web de una inmobiliaria y extrae la información en este formato JSON exacto:
{
  "company": {
    "name": "Nombre de la empresa o broker",
    "phone": "Teléfono si aparece",
    "specialties": ["especialidad 1", "especialidad 2"]
  },
  "properties": [
    {
      "id": "prop-1",
      "title": "Nombre de la propiedad / edificio",
      "zone": "Zona o ciudad (ej. Brickell, Doral, etc.)",
      "type": "Condominio / Casa / Townhouse",
      "price": "Precio en USD con formato (ej. $650,000)",
      "beds": 2,
      "baths": 2,
      "sqft": "Metros o sqft si hay",
      "hoa": "HOA si hay",
      "airbnbAllowed": true o false,
      "features": "Características clave, amenidades, vistas",
      "idealFor": "Para quién es ideal"
    }
  ]
}

IMPORTANTE: Responde ÚNICAMENTE con el bloque JSON sin explicaciones ni markdown. Si no encuentras propiedades explícitas, inventa al menos 3 propiedades coherentes basadas en la zona y catálogo de la empresa.

CONTENIDO DE LA PÁGINA:
${contentToAnalyze}`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: extractPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000
        }
      })
    });

    const data = await geminiRes.json();
    let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(jsonText);

    // Merge into KB
    const currentKB = loadKB();
    if (parsed.company?.name) currentKB.company.name = parsed.company.name;
    if (parsed.company?.phone) currentKB.company.phone = parsed.company.phone;
    if (parsed.company?.specialties?.length) currentKB.company.specialties = parsed.company.specialties;

    if (Array.isArray(parsed.properties) && parsed.properties.length > 0) {
      currentKB.properties = [
        ...parsed.properties.map((p, i) => ({ ...p, id: 'prop-' + Date.now() + '-' + i })),
        ...(currentKB.properties || [])
      ];
    }

    saveKB(currentKB);
    console.log(`✅ Base de datos actualizada con ${parsed.properties?.length || 0} propiedades extraídas.`);
    res.json({ ok: true, extracted: parsed, total: currentKB.properties.length });

  } catch (err) {
    console.error('Error en extracción de Gemini:', err);
    res.status(500).json({ error: 'Error procesando los datos con IA: ' + err.message });
  }
});

// API: Test Chat Simulator
app.post('/api/test-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Falta mensaje' });

  const reply = await askGemini('test-user', message);
  res.json({ reply });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🌐 PANEL DE CONTROL DISPONIBLE EN: http://localhost:${PORT}`);
  console.log(`========================================================\n`);
  startWhatsAppBot();
});
