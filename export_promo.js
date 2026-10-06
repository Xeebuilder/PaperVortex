const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const PROJECT_DIR = __dirname;
const PORT = 9988;

// Static file server
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

// Synthesize Studio-Quality Audio from Recorded Animation Events
async function renderAudioFromEvents(browser, events, totalDuration, outputPath) {
  console.log(`[Audio] Synthesizing audio from ${events.length} synchronized events (ad duration: ${totalDuration.toFixed(2)}s)...`);
  const page = await browser.newPage();
  
  const wavBase64 = await page.evaluate(async (events, totalDuration) => {
    const sampleRate = 48000;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * (totalDuration + 0.8)), sampleRate);
    
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
      if (t < 0) t = 0;
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
    
    function playOutroPad(t, duration = 3.8) {
      if (t < 0) t = 0;
      playSynthChord(t, [174.61, 207.65, 261.63, 311.13, 392.0], duration);
    }
    
    // Schedule all captured events
    for (const evt of events) {
      const t = evt.t;
      switch (evt.fn) {
        case '808':
          play808(t, evt.intensity);
          break;
        case 'clap':
          playClap(t);
          break;
        case 'hat':
          playSingleHat(t, evt.accented);
          break;
        case 'openHat':
          playOpenHat(t);
          break;
        case 'bass':
          playBassTone(t, evt.freq);
          break;
        case 'chord':
          playSynthChord(t, evt.chord, evt.dur);
          break;
        case 'scratch':
          playRecordScratch(t);
          break;
        case 'chime':
          playComedyChime(t);
          break;
        case 'whoosh':
          playWhooshRiser(t);
          break;
        case 'outroPad':
          playOutroPad(t, evt.dur || 3.8);
          break;
      }
    }
    
    const rendered = await offlineCtx.startRendering();
    const length = rendered.length;
    const ch0 = rendered.getChannelData(0);
    const ch1 = rendered.getChannelData(1);
    
    // 16-bit WAV PCM encoding
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
  }, events, totalDuration);
  
  await page.close();
  fs.writeFileSync(outputPath, Buffer.from(wavBase64, 'base64'));
  console.log(`[Audio] Audio rendered to ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

// Record video frames and encode to MP4 with Frame-Perfect Lock
async function exportVideo({ width, height, outputFilename, isVertical = false }) {
  console.log(`\n========================================`);
  console.log(`[Video] Recording & Exporting ${outputFilename} (${width}x${height})...`);
  console.log(`========================================`);
  
  const tempDir = path.join('/tmp', `promo_frames_${width}x${height}`);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

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
  
  // Set up instrumentation and layout
  await page.evaluate((isVertical) => {
    // Hide UI controls
    const controls = document.querySelector('.controls');
    if (controls) controls.style.display = 'none';

    // Optimize layout and spacing for vertical mode
    if (isVertical) {
      const brandTag = document.querySelector('.brand-tag');
      if (brandTag) {
        brandTag.style.top = '60px';
        brandTag.style.left = '40px';
        brandTag.style.fontSize = '20px';
      }
      const waBubble = document.getElementById('waBubble');
      if (waBubble) {
        waBubble.style.fontSize = '32px';
        waBubble.style.maxWidth = '90%';
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

    // ==========================================
    // AUDIO EVENT CAPTURE INSTRUMENTATION
    // ==========================================
    window.audioEnabled = true;
    window.audioCtx = { currentTime: 0, state: 'running', resume: () => {} };

    window.__audioEvents = [];
    window.__slide0Painted = false;
    window.__startTime = 0;
    window.__isComplete = false;

    function recordEvt(fn, params = {}) {
      if (!window.__isComplete) {
        // If slide 0 hasn't painted yet, this event belongs to t=0.000 (intro chord)
        const AUDIO_CALIBRATION_OFFSET = 0.085;
        const t = Math.max(0, ((performance.now() - window.__startTime) / 1000) + AUDIO_CALIBRATION_OFFSET);
        window.__audioEvents.push({ fn, ...params, t });
      }
    }

    window.play808 = function(intensity = 1.0) {
      recordEvt('808', { intensity });
    };

    window.playClap = function() {
      recordEvt('clap');
    };

    window.playSingleHat = function(t, accented) {
      recordEvt('hat', { accented });
    };

    window.playOpenHat = function() {
      recordEvt('openHat');
    };

    window.playBassTone = function(t, freq) {
      recordEvt('bass', { freq });
    };

    window.playSynthChord = function(chord, dur = 0.5) {
      recordEvt('chord', { chord, dur });
    };

    window.playRecordScratch = function() {
      recordEvt('scratch');
    };

    window.playComedyChime = function() {
      recordEvt('chime');
    };

    window.playWhooshRiser = function() {
      recordEvt('whoosh');
    };

    window.playOutroPad = function(duration = 3.8) {
      recordEvt('outroPad', { dur: duration });
    };

    // Intercept nextFrame: start timer once Slide 0 actually paints
    const origNextFrame = window.nextFrame;
    window.nextFrame = function() {
      origNextFrame();
      if (!window.__slide0Painted) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.__slide0Painted = true;
            window.__startTime = performance.now();
          });
        });
      }
    };
  }, isVertical);

  // Set up CDP screencast
  const client = await page.target().createCDPSession();
  const frames = [];
  let frameIndex = 0;
  let firstFrameTimestamp = null;
  
  client.on('Page.screencastFrame', async ({ sessionId, data, metadata }) => {
    // Only capture frames AFTER Slide 0 is painted on screen
    const isPainted = await page.evaluate(() => window.__slide0Painted);
    if (!isPainted) {
      try {
        await client.send('Page.screencastFrameAck', { sessionId });
      } catch (e) {}
      return;
    }

    if (firstFrameTimestamp === null) {
      firstFrameTimestamp = metadata.timestamp;
    }

    const relTime = metadata.timestamp - firstFrameTimestamp;
    const filename = `frame_${String(frameIndex++).padStart(6, '0')}.jpg`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    frames.push({
      path: filepath,
      relTime: relTime
    });

    try {
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  console.log(`[Recording] Starting screencast session at ${width}x${height}...`);
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 100, everyNthFrame: 1 });
  
  // Trigger playback
  await page.evaluate(() => {
    togglePlay();
  });

  const expectedDurationSec = 31.2;
  const startWallClock = Date.now();
  
  while ((Date.now() - startWallClock) / 1000 < expectedDurationSec) {
    await new Promise(r => setTimeout(r, 200));
  }
  
  await client.send('Page.stopScreencast');
  
  // Extract audio events recorded directly from animation triggers
  const recordedAudioEvents = await page.evaluate(() => {
    window.__isComplete = true;
    return window.__audioEvents;
  });

  console.log(`[Recording] Captured ${frames.length} video frames and ${recordedAudioEvents.length} audio events.`);
  
  // Render pristine audio matching the EXACT recorded timestamps
  const audioPath = path.join(tempDir, 'audio_synced.wav');
  await renderAudioFromEvents(browser, recordedAudioEvents, expectedDurationSec, audioPath);
  
  await browser.close();
  
  // Generate ffconcat demuxer file with relative durations
  const concatPath = path.join(tempDir, 'concat.txt');
  let concatContent = 'ffconcat version 1.0\n';
  
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    let duration = 0.016667;
    if (i < frames.length - 1) {
      const delta = frames[i + 1].relTime - f.relTime;
      if (delta > 0 && delta < 0.5) {
        duration = delta;
      }
    }
    concatContent += `file '${f.path}'\nduration ${duration.toFixed(6)}\n`;
  }
  if (frames.length > 0) {
    concatContent += `file '${frames[frames.length - 1].path}'\n`;
  }
  fs.writeFileSync(concatPath, concatContent);

  // Encode with FFmpeg (Master Quality Profile)
  const targetOutput = path.join(PROJECT_DIR, outputFilename);
  console.log(`[FFmpeg] Encoding MASTER-QUALITY MP4 -> ${targetOutput}...`);
  
  const ffmpegCmd = [
    'ffmpeg', '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', `"${concatPath}"`,
    '-i', `"${audioPath}"`,
    '-c:v', 'libx264',
    '-tune', 'animation',
    '-preset', 'veryslow',
    '-crf', '10',
    '-b:v', '18M',
    '-maxrate', '25M',
    '-bufsize', '35M',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-pix_fmt', 'yuv420p',
    '-r', '60',
    '-fps_mode', 'cfr',
    '-c:a', 'aac',
    '-b:a', '320k',
    '-ar', '48000',
    '-shortest',
    '-movflags', '+faststart',
    `"${targetOutput}"`
  ].join(' ');

  execSync(ffmpegCmd, { stdio: 'inherit' });

  // Clean temporary frames and audio
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

    console.log('All exports completed successfully with frame-perfect audio sync!');
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Fatal error during export:', err);
  process.exit(1);
});
