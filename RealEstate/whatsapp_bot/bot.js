import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import { exec } from 'child_process';
import pino from 'pino';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_INSTRUCTIONS = `Eres el Asistente de Inteligencia Artificial oficial de Carlos Uzcategui, asesor inmobiliario de United Realty Group en Miami, Florida.
Estás hablando directamente por WhatsApp con clientes e inversionistas interesados en propiedades en el Sur de la Florida.

CONOCIMIENTO CLAVE:
- Brickell: Es el centro financiero, 98% condominios y torres de lujo. Si preguntan por CASAS en Brickell, aclara amablemente que en Brickell predominan las torres de lujo, pero que casas unifamiliares con patio están justo al lado en The Roads, Shenandoah o Coconut Grove (a 5 minutos).
- Doral: Casas familiares, townhouses, comunidades cerradas y colegios A+.
- Miami Beach / Sunny Isles: Frente al océano, estilo resort.
- Rentas cortas / Airbnb: Alta rentabilidad (8-11% ROI) en proyectos específicos de Downtown/Brickell con licencia hotelera que permiten rentar por noche.
- Financiamiento para extranjeros: Bancos de Florida financian hasta 65-70% con pasaporte, carta bancaria e ingresos de su país de origen.
- Monedas / Pagos: Transferencias bancarias internacionales en USD o estructuras legales respaldadas.

REGLAS DE ATENCIÓN POR WHATSAPP:
1. Responde de forma cálida, profesional y muy humana en español (puedes usar emojis con moderación).
2. Mantén las respuestas breves y directas (máximo 2 párrafos pequeños), como se escribe en WhatsApp.
3. Intenta descubrir su objetivo (¿vivir o invertir?), su zona preferida y su rango de presupuesto.
4. Si el cliente quiere agendar o ver el catálogo de propiedades, indícale que Carlos Uzcategui se comunicará directamente con él o que le enviaremos la selección por este mismo chat.`;

// In-memory conversation history per contact
const chatHistories = new Map();

async function askGemini(senderJid, userMessage) {
  try {
    let history = chatHistories.get(senderJid) || [];
    history.push({ role: 'user', parts: [{ text: userMessage }] });

    // Keep last 6 turns
    if (history.length > 6) history = history.slice(-6);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
        contents: history,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250
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
    return "¡Hola! Gracias por comunicarte con el equipo de Carlos Uzcategui en Miami. ¿Estás buscando comprar para vivir o invertir para renta?";
  }
}

async function startBot() {
  console.log('\n🚀 Iniciando Asistente AI de WhatsApp para Carlos Uzcategui...');

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // We print manually with qrcode-terminal for better formatting
    logger: pino({ level: 'silent' }),
    browser: ['Carlos Uzcategui AI', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n======================================================');
      console.log('📲 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:');
      console.log('1. Abre WhatsApp en tu teléfono');
      console.log('2. Ve a Configuración -> Dispositivos Vinculados');
      console.log('3. Toca "Vincular un dispositivo" y escanea la imagen que se abrió en tu pantalla:');
      console.log('======================================================\n');
      qrcodeTerminal.generate(qr, { small: true });

      QRCode.toFile('qr.png', qr, { width: 450, margin: 2 }, (err) => {
        if (!err) {
          exec('open qr.png');
          console.log('🖼️ Código QR abierto en tu pantalla (qr.png)');
        }
      });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        console.log('⚠️ Sesión cerrada por WhatsApp. Limpiando credenciales para generar nuevo QR...');
        import('fs').then(fs => {
          fs.rmSync('./auth_info', { recursive: true, force: true });
          setTimeout(startBot, 1000);
        });
      } else {
        console.log(`⚠️ Conexión pausada (status: ${statusCode}). Reconectando en 2 segundos...`);
        setTimeout(startBot, 2000);
      }
    } else if (connection === 'open') {
      console.log('\n✅ ¡WHATSAPP VINCULADO CON ÉXITO!');
      console.log('🤖 El bot de Carlos Uzcategui con Gemini 3.5 Flash está ACTIVO y respondiendo mensajes en tiempo real.\n');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignore messages from bot itself, status broadcasts, or empty messages
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.key.remoteJid.endsWith('@g.us')) continue; // Ignore group chats for now

      const text = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text ||
                   msg.message?.imageMessage?.caption;

      if (!text) continue;

      const sender = msg.key.remoteJid;
      console.log(`📩 Mensaje recibido de ${sender.replace('@s.whatsapp.net', '')}: "${text}"`);

      // Send typing presence
      await sock.sendPresenceUpdate('composing', sender);

      // Get reply from Gemini
      const reply = await askGemini(sender, text);

      // Pause for natural feel (1 second)
      await new Promise(r => setTimeout(r, 1000));

      // Send reply
      await sock.sendMessage(sender, { text: reply }, { quoted: msg });
      console.log(`🤖 Respuesta enviada: "${reply.slice(0, 60)}..."\n`);
    }
  });
}

startBot();
