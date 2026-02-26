/**
 * mediaApi.js — Real media generation using DALL-E 3, OpenAI TTS, and browser Canvas.
 *
 * Outputs are stored as JSON strings with a __media__ sentinel:
 *   images: { __media__: true, type: 'images', urls: [...], prompts: [...] }
 *   audio:  { __media__: true, type: 'audio',  url: 'blob:...', duration: 15 }
 *   video:  { __media__: true, type: 'video',  url: 'blob:...', mimeType: 'video/webm', duration: 30 }
 */

import { getSettings } from './settings.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isMediaOutput(output) {
  if (typeof output !== 'string') return false;
  try { return JSON.parse(output).__media__ === true; }
  catch { return false; }
}

export function parseMediaOutput(output) {
  try { return JSON.parse(output); }
  catch { return null; }
}

export function encodeMediaOutput(obj) {
  return JSON.stringify({ __media__: true, ...obj });
}

/**
 * Extract individual scene prompts from a block of text.
 * Handles numbered lists, "Scene N:" headers, bullet points, and plain sentences.
 */
export function extractScenePrompts(text) {
  if (!text?.trim()) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. "Scene N:" or "Shot N:" headers
  const sceneHeaders = lines.filter(l => /^(scene|shot|frame|panel|image)\s*\d+[:\-]/i.test(l));
  if (sceneHeaders.length >= 2) return sceneHeaders.slice(0, 6).map(l => l.replace(/^(scene|shot|frame|panel|image)\s*\d+[:\-]\s*/i, '').trim());

  // 2. Numbered list items
  const numbered = lines.filter(l => /^\d+[.)]\s/.test(l));
  if (numbered.length >= 2) return numbered.slice(0, 6).map(l => l.replace(/^\d+[.)]\s*/, '').trim());

  // 3. Bullet / dash list
  const bulleted = lines.filter(l => /^[-•*]\s/.test(l));
  if (bulleted.length >= 2) return bulleted.slice(0, 6).map(l => l.replace(/^[-•*]\s*/, '').trim());

  // 4. Long sentences as scenes
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  return sentences.slice(0, 5);
}

// ─── Image Generation (DALL-E 3) ─────────────────────────────────────────────

/**
 * Generate images from prompts text using DALL-E 3.
 * @param {string} promptsText  Raw text containing scene/image prompts
 * @param {Function} onProgress  (msg: string) => void
 * @returns {string}  Serialized MediaOutput for images
 */
export async function generateImages(promptsText, onProgress) {
  const settings = getSettings();
  const apiKey = settings.openaiKey?.trim();
  if (!apiKey) throw new Error('OpenAI API key required for image generation. Add it in ⚙️ Settings → OpenAI.');

  const rawPrompts = extractScenePrompts(promptsText);
  if (rawPrompts.length === 0) throw new Error('No scene prompts found in upstream text. Make sure an image_prompt or storyboard node feeds into this node.');

  const urls = [];
  const usedPrompts = [];

  for (let i = 0; i < Math.min(rawPrompts.length, 5); i++) {
    const prompt = rawPrompts[i];
    onProgress?.(`🎨 Generating image ${i + 1}/${Math.min(rawPrompts.length, 5)}…`);

    const res = await fetch('/api/proxy/openai/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard' }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`DALL-E 3 (image ${i + 1}): ${err.slice(0, 200) || res.statusText}`);
    }

    const data = await res.json();
    const url = data.data?.[0]?.url;
    if (url) { urls.push(url); usedPrompts.push(prompt); }
  }

  if (urls.length === 0) throw new Error('DALL-E 3 returned no images.');
  return encodeMediaOutput({ type: 'images', urls, prompts: usedPrompts });
}

// ─── Audio Generation (OpenAI TTS) ───────────────────────────────────────────

/**
 * Generate spoken narration from a video script using OpenAI TTS.
 * @param {string} scriptText  Full script text
 * @param {Function} onProgress
 * @returns {string}  Serialized MediaOutput for audio
 */
export async function generateAudio(scriptText, onProgress) {
  const settings = getSettings();
  const apiKey = settings.openaiKey?.trim();
  if (!apiKey) throw new Error('OpenAI API key required for TTS audio. Add it in ⚙️ Settings → OpenAI.');

  onProgress?.('🎙️ Generating audio narration…');

  // Strip markdown formatting, keep it clean for TTS
  const text = scriptText
    .replace(/```[\s\S]*?```/g, '') // remove code blocks
    .replace(/#{1,6}\s/g, '')        // remove headings
    .replace(/[*_`]/g, '')           // remove markdown emphasis
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .trim()
    .slice(0, 4000);

  if (!text) throw new Error('No narration text found.');

  const res = await fetch('/api/proxy/openai/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy', response_format: 'mp3' }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenAI TTS: ${err.slice(0, 200) || res.statusText}`);
  }

  const blob = await res.blob();
  const audioUrl = URL.createObjectURL(blob);

  // Get duration
  const duration = await new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => resolve(0));
    setTimeout(() => resolve(0), 5000);
  });

  return encodeMediaOutput({ type: 'audio', url: audioUrl, duration: Math.round(duration), preview: text.slice(0, 120) });
}

// ─── Video Composition (Canvas + MediaRecorder) ───────────────────────────────

/**
 * Fetch a URL and return a local blob URL (avoids CORS canvas taint).
 */
async function toBlobUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Compose a real video from images and audio using the browser Canvas + MediaRecorder API.
 * Produces a downloadable .webm video.
 *
 * @param {string[]} imageUrls  Direct image URLs (will be proxied via blob)
 * @param {string} audioUrl  Blob URL for audio file
 * @param {Function} onProgress
 * @returns {string}  Serialized MediaOutput for video
 */
export async function composeVideo(imageUrls, audioUrl, onProgress) {
  if (!imageUrls?.length) throw new Error('No images to compose into video.');

  // YouTube Shorts format: 9:16 vertical
  const W = 1080, H = 1920;

  onProgress?.('📦 Fetching images for composition…');
  const blobUrls = await Promise.all(imageUrls.map(u => toBlobUrl(u).catch(() => u)));
  const images = await Promise.all(blobUrls.map(u => loadImage(u)));

  // Determine duration
  let audioDuration = images.length * 4; // default 4s per slide
  if (audioUrl) {
    audioDuration = await new Promise((resolve) => {
      const a = new Audio(audioUrl);
      a.addEventListener('loadedmetadata', () => resolve(a.duration));
      a.addEventListener('error', () => resolve(images.length * 4));
      setTimeout(() => resolve(images.length * 4), 3000);
    });
  }

  const secPerSlide = Math.max(3, audioDuration / images.length);
  const totalDuration = secPerSlide * images.length;

  onProgress?.(`🎬 Composing ${images.length} scenes × ${secPerSlide.toFixed(1)}s each = ${totalDuration.toFixed(0)}s video…`);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Capture canvas stream at 30fps
  const stream = canvas.captureStream(30);

  // Mix in audio via Web Audio API → MediaStream
  let audioContext;
  let hasAudio = false;
  if (audioUrl) {
    try {
      audioContext = new AudioContext();
      const audioData = await fetch(audioUrl).then(r => r.arrayBuffer());
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const src = audioContext.createBufferSource();
      src.buffer = audioBuffer;
      const dest = audioContext.createMediaStreamDestination();
      src.connect(dest);
      src.start(0);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      hasAudio = true;
    } catch (e) {
      onProgress?.('⚠️ Audio mixing limited in this browser — download audio separately.');
    }
  }

  // Pick best supported codec
  const mimeType = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      audioContext?.close();
      resolve(encodeMediaOutput({
        type: 'video',
        url: URL.createObjectURL(blob),
        mimeType,
        duration: Math.round(totalDuration),
        scenes: images.length,
        hasAudio,
        audioUrl: audioUrl || null,
      }));
    };
    recorder.onerror = reject;

    recorder.start(200);

    let slide = 0;
    const drawSlide = () => {
      if (slide >= images.length) {
        setTimeout(() => recorder.stop(), 300);
        return;
      }
      onProgress?.(`🎞️ Rendering scene ${slide + 1}/${images.length}…`);

      const img = images[slide];
      // Black background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      // Scale image to fill vertical (cover)
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
      ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);

      // Gradient overlay at bottom for text legibility
      const grad = ctx.createLinearGradient(0, H * 0.7, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.7, W, H * 0.3);

      // Scene counter
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${slide + 1}/${images.length}`, W - 48, H - 80);

      slide++;
      setTimeout(drawSlide, secPerSlide * 1000);
    };

    drawSlide();
  });
}
