const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const puppeteer = require('puppeteer');

const PROJECT_DIR = __dirname;
const PORT = 9988;

// Helper: static file server
function createServer() {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/apple_promo_video.html';
    const filePath = path.join(PROJECT_DIR, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

// Generate Pristine 48kHz WAV Audio
async function generateAudio(outputPath, lang = 'es') {
  console.log(`[Audio] Generating studio audio for lang=${lang}...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const wavBase64 = await page.evaluate(async (lang) => {
    const sampleRate = 48000;
    const totalDuration = 29.5;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate);
    
    // Compressor
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-14, 0);
    comp.knee.setValueAtTime(20, 0);
    comp.ratio.setValueAtTime(12, 0);
    comp.attack.setValueAtTime(0.002, 0);
    comp.release.setValueAtTime(0.2, 0);
    
    // Master Gain
    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.75, 0);
    masterGain.connect(comp);
    comp.connect(offlineCtx.destination);
    
    // Noise buffer
    const noiseLen = sampleRate * 2;
    const noiseBuffer = offlineCtx.createBuffer(1, noiseLen, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
    
    function play808(t, intensity = 1.0) {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(165, t);
      osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.42);
      gain.gain.setValueAtTime(0.95 * intensity, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.48);
    }
    
    function playClap(t) {
      const noise = offlineCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1700, t);
      filter.Q.setValueAtTime(2, t);
      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 0.19);
    }
    
    function playSingleHat(t, accented = false) {
      const noise = offlineCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, t);
      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(accented ? 0.32 : 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 0.06);
    }
    
    function playOpenHat(t) {
      const noise = offlineCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6500, t);
      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 0.18);
    }
    
    function playBassTone(t, freq) {
      const osc = offlineCtx.createOscillator();
      const filter = offlineCtx.createBiquadFilter();
      const gain = offlineCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, t);
      filter.frequency.exponentialRampToValueAtTime(110, t + 0.16);
      filter.Q.setValueAtTime(4, t);
      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.19);
    }
    
    function playSynthChord(t, chordFreqs, duration = 0.5) {
      chordFreqs.forEach(freq => {
        const osc = offlineCtx.createOscillator();
        const filter = offlineCtx.createBiquadFilter();
        const gain = offlineCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1900, t);
        filter.frequency.exponentialRampToValueAtTime(320, t + duration);
        filter.Q.setValueAtTime(2.5, t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + duration + 0.05);
      });
    }
    
    function playRecordScratch(t) {
      const noise = offlineCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.28);
      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 0.31);
      
      const osc = offlineCtx.createOscillator();
      const oscGain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.28);
      oscGain.gain.setValueAtTime(0.45, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.29);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    }
    
    function playComedyChime(t) {
      const notes = [1046.5, 1318.5, 1567.98];
      notes.forEach((freq, idx) => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);
        gain.gain.setValueAtTime(0.28, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.65);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.7);
      });
    }
    
    function playWhooshRiser(t) {
      const noise = offlineCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(140, t);
      filter.frequency.exponentialRampToValueAtTime(3800, t + 1.05);
      filter.frequency.exponentialRampToValueAtTime(100, t + 1.22);
      filter.Q.setValueAtTime(3.6, t);
      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.linearRampToValueAtTime(0.9, t + 1.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 1.26);
      
      const osc = offlineCtx.createOscillator();
      const oscGain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(52, t);
      osc.frequency.linearRampToValueAtTime(220, t + 1.05);
      osc.frequency.exponentialRampToValueAtTime(35, t + 1.22);
      oscGain.gain.setValueAtTime(0.02, t);
      oscGain.gain.linearRampToValueAtTime(0.95, t + 1.05);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 1.26);
    }
    
    function playOutroPad(t) {
      playSynthChord(t, [174.61, 207.65, 261.63, 311.13, 392.0], 2.2);
    }
    
    const chordFm = [174.61, 207.65, 261.63];
    const chordDb = [138.59, 174.61, 207.65];
    const chordBbm = [116.54, 138.59, 174.61];
    const bassRhythm = [
      43.65, 0, 43.65, 0,
      51.91, 0, 43.65, 58.27,
      43.65, 0, 43.65, 0,
      65.41, 0, 58.27, 51.91
    ];
    
    // Act 1: El Problema
    playSynthChord(0.000, chordFm, 0.9);
    play808(1.100, 0.85); playSynthChord(1.100, chordFm, 0.45);
    play808(2.300, 0.85); playSynthChord(2.300, chordFm, 0.45);
    play808(3.500, 0.75);
    play808(4.600, 0.85); playSynthChord(4.600, chordFm, 0.45);
    play808(5.650, 0.85); playSynthChord(5.650, chordFm, 0.45);
    playSynthChord(6.850, chordDb, 0.5);
    playRecordScratch(7.950); playComedyChime(7.950 + 0.250);
    playSynthChord(9.900, chordBbm, 0.8);
    playSynthChord(11.000, chordBbm, 0.8);
    playSynthChord(12.100, chordBbm, 0.8);
    playSynthChord(13.250, chordBbm, 0.8);
    playWhooshRiser(14.550);
    
    // Act 2: Beat Synchronizer (100 BPM = 150ms step)
    const beatStart = 15.800;
    const stepMs = 0.150;
    for (let rStep = 0; rStep < 72; rStep++) {
      const t = beatStart + rStep * stepMs;
      const s = rStep % 16;
      if (rStep === 56) playComedyChime(t); // Joke wink
      if (s === 0 || s === 8) play808(t, 1.0);
      else if (s === 10) play808(t, 0.65);
      if (s === 4 || s === 12) playClap(t);
      playSingleHat(t, s % 2 === 0);
      if (s === 6 || s === 14) playOpenHat(t);
      const note = bassRhythm[s];
      if (note > 0) playBassTone(t, note);
      if (s === 0 || s === 8) playSynthChord(t, s === 0 ? chordFm : chordDb, 0.42);
    }
    
    // Outro Pad + Sub Drop
    const outroTime = beatStart + 72 * stepMs;
    play808(outroTime, 1.4);
    playOutroPad(outroTime);
    
    const rendered = await offlineCtx.startRendering();
    const length = rendered.length;
    const ch0 = rendered.getChannelData(0);
    const ch1 = rendered.getChannelData(1);
    
    const buffer = new ArrayBuffer(44 + length * 4);
    const view = new DataView(buffer);
    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + length * 4, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, length * 4, true);
    
    let offset = 44;
    for (let i = 0; i < length; i++) {
      let s0 = Math.max(-1, Math.min(1, ch0[i]));
      let s1 = Math.max(-1, Math.min(1, ch1[i]));
      view.setInt16(offset, s0 < 0 ? s0 * 0x8000 : s0 * 0x7FFF, true);
      view.setInt16(offset + 2, s1 < 0 ? s1 * 0x8000 : s1 * 0x7FFF, true);
      offset += 4;
    }
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }, lang);
  
  await browser.close();
  fs.writeFileSync(outputPath, Buffer.from(wavBase64, 'base64'));
  console.log(`[Audio] Audio rendered to ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

// Record video frames and encode to MP4
async function exportVideo({ width, height, outputFilename, isVertical = false }) {
  console.log(`\n========================================`);
  console.log(`[Video] Exporting ${outputFilename} (${width}x${height})...`);
  console.log(`========================================`);
  
  const tempDir = path.join('/tmp', `promo_frames_${width}x${height}`);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  
  const audioPath = path.join('/tmp', 'apple_promo_audio.wav');
  if (!fs.existsSync(audioPath)) {
    await generateAudio(audioPath, 'es');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-font-antialiasing',
      '--font-render-hinting=max'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/apple_promo_video.html`, { waitUntil: 'networkidle0' });
  
  // Prepare page layout for clean export
  await page.evaluate((isVertical) => {
    // Hide UI controls
    const controls = document.querySelector('.controls');
    if (controls) controls.style.display = 'none';

    // Optimize typography and spacing for vertical mode if needed
    if (isVertical) {
      const brandTag = document.querySelector('.brand-tag');
      if (brandTag) {
        brandTag.style.top = '60px';
        brandTag.style.left = '40px';
        brandTag.style.fontSize = '18px';
      }
      const textBox = document.getElementById('textBox');
      if (textBox) {
        textBox.style.fontSize = 'clamp(44px, 8vw, 84px)';
        textBox.style.padding = '0 20px';
      }
      const waBubble = document.getElementById('waBubble');
      if (waBubble) {
        waBubble.style.fontSize = '26px';
        waBubble.style.maxWidth = '92%';
      }
    }

    // Add continuous dirty-canvas helper to ensure solid 60 FPS compositor updates
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.opacity = '0.005';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let tick = 0;
    function pulse() {
      tick = (tick + 1) % 255;
      ctx.fillStyle = `rgb(${tick}, 0, 0)`;
      ctx.fillRect(0, 0, 4, 4);
      requestAnimationFrame(pulse);
    }
    requestAnimationFrame(pulse);
  }, isVertical);

  // Set up CDP screencast
  const client = await page.target().createCDPSession();
  const frames = [];
  let frameIndex = 0;
  
  client.on('Page.screencastFrame', async ({ sessionId, data, metadata }) => {
    const filename = `frame_${String(frameIndex++).padStart(6, '0')}.jpg`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    frames.push({
      path: filepath,
      timestamp: metadata.timestamp
    });
    try {
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  console.log(`[Recording] Starting screencast at ${width}x${height}...`);
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  
  // Start the animated ad playback
  await page.evaluate(() => {
    // Disable in-page audio processing to keep CPU 100% focused on 60fps visuals
    audioEnabled = false;
    togglePlay();
  });

  const recordingDurationSec = 29.5;
  const startWallClock = Date.now();
  
  // Wait until the promo finishes its full story
  while ((Date.now() - startWallClock) / 1000 < recordingDurationSec) {
    await new Promise(r => setTimeout(r, 200));
  }
  
  await client.send('Page.stopScreencast');
  await browser.close();
  
  console.log(`[Recording] Captured ${frames.length} frames (${(frames.length / recordingDurationSec).toFixed(1)} fps avg)`);
  
  // Generate ffconcat demuxer file with precise timestamps
  const concatPath = path.join(tempDir, 'concat.txt');
  let concatContent = 'ffconcat version 1.0\n';
  
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    let duration = 0.016667; // fallback ~60fps
    if (i < frames.length - 1) {
      const delta = frames[i + 1].timestamp - f.timestamp;
      if (delta > 0 && delta < 1.0) {
        duration = delta;
      }
    }
    concatContent += `file '${f.path}'\nduration ${duration.toFixed(6)}\n`;
  }
  // Repeat last frame for demuxer requirement
  if (frames.length > 0) {
    concatContent += `file '${frames[frames.length - 1].path}'\n`;
  }
  fs.writeFileSync(concatPath, concatContent);

  // Encode with FFmpeg
  const targetOutput = path.join(PROJECT_DIR, outputFilename);
  console.log(`[FFmpeg] Encoding high-profile MP4 -> ${targetOutput}...`);
  
  const ffmpegCmd = [
    'ffmpeg', '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', `"${concatPath}"`,
    '-i', `"${audioPath}"`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', '60',
    '-fps_mode', 'cfr',
    '-c:a', 'aac',
    '-b:a', '256k',
    '-ar', '48000',
    '-shortest',
    '-movflags', '+faststart',
    `"${targetOutput}"`
  ].join(' ');

  execSync(ffmpegCmd, { stdio: 'inherit' });

  // Clean temporary frames
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  const stat = fs.statSync(targetOutput);
  console.log(`[Success] Video created: ${targetOutput} (${(stat.size / 1024 / 1024).toFixed(2)} MB)\n`);
}

async function main() {
  const server = createServer();
  await new Promise(r => server.listen(PORT, r));
  console.log(`Server listening on port ${PORT}`);

  try {
    // 1. Landscape 1920x1080 (Desktop / YouTube / Web / Presentations)
    await exportVideo({
      width: 1920,
      height: 1080,
      outputFilename: 'apple_promo_video.mp4',
      isVertical: false
    });

    // 2. Vertical 1080x1920 (WhatsApp Status / Reels / TikTok / Direct Mobile sharing)
    await exportVideo({
      width: 1080,
      height: 1920,
      outputFilename: 'apple_promo_video_vertical.mp4',
      isVertical: true
    });

    console.log('All exports completed successfully!');
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Fatal error during export:', err);
  process.exit(1);
});
