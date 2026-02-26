/**
 * MediaViewer — renders real media outputs: image galleries, audio players, video players.
 * Used inside the Outputs tab for nodes that produce actual media files.
 */

import { useState } from 'react';
import { parseMediaOutput } from '../lib/mediaApi';

function ImageGallery({ media }) {
  const [lightbox, setLightbox] = useState(null);
  const { urls, prompts } = media;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {urls.map((url, i) => (
          <div key={i} className="relative group cursor-pointer" onClick={() => setLightbox(i)}>
            <img
              src={url}
              alt={`Scene ${i + 1}`}
              className="w-full rounded-lg border border-gray-700 object-cover aspect-square"
              loading="lazy"
            />
            <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
              <span className="text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
            </div>
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
              Scene {i + 1}
            </div>
          </div>
        ))}
      </div>
      {prompts?.length > 0 && (
        <div className="mt-2 space-y-1">
          {prompts.map((p, i) => (
            <p key={i} className="text-[10px] text-gray-500 leading-relaxed">
              <span className="text-gray-600 font-semibold">S{i + 1}:</span> {p}
            </p>
          ))}
        </div>
      )}
      <a
        href={urls[0]}
        download={`scene-1.png`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-pink-950/30 border border-pink-800/40 text-pink-300 rounded-lg hover:bg-pink-950/60 transition-colors"
      >
        ↓ Download Images ({urls.length})
      </a>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] mx-4" onClick={e => e.stopPropagation()}>
            <img src={urls[lightbox]} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => setLightbox(Math.max(0, lightbox - 1))}
                disabled={lightbox === 0}
                className="text-white text-sm px-3 py-1 bg-white/10 rounded disabled:opacity-30"
              >← Prev</button>
              <span className="text-white text-xs">{lightbox + 1} / {urls.length}</span>
              <button
                onClick={() => setLightbox(Math.min(urls.length - 1, lightbox + 1))}
                disabled={lightbox === urls.length - 1}
                className="text-white text-sm px-3 py-1 bg-white/10 rounded disabled:opacity-30"
              >Next →</button>
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 text-white text-xl bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({ media }) {
  const { url, duration, preview } = media;
  const mins = Math.floor((duration || 0) / 60);
  const secs = ((duration || 0) % 60).toString().padStart(2, '0');

  return (
    <div>
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎙️</span>
          <div>
            <p className="text-sm font-semibold text-gray-100">Audio Narration</p>
            {duration > 0 && <p className="text-xs text-gray-500">{mins}:{secs} • MP3</p>}
          </div>
        </div>
        {/* Native HTML5 audio player */}
        <audio controls className="w-full" style={{ filter: 'invert(1) hue-rotate(180deg)' }}>
          <source src={url} type="audio/mpeg" />
          Your browser does not support audio playback.
        </audio>
      </div>
      {preview && (
        <p className="text-[10px] text-gray-600 leading-relaxed italic">"{preview}…"</p>
      )}
      <a
        href={url}
        download="narration.mp3"
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-violet-950/30 border border-violet-800/40 text-violet-300 rounded-lg hover:bg-violet-950/60 transition-colors"
      >
        ↓ Download Audio (.mp3)
      </a>
    </div>
  );
}

function VideoPlayer({ media }) {
  const { url, mimeType, duration, scenes, hasAudio, audioUrl } = media;
  const mins = Math.floor((duration || 0) / 60);
  const secs = ((duration || 0) % 60).toString().padStart(2, '0');

  return (
    <div>
      <div className="bg-black rounded-xl overflow-hidden border border-gray-700 mb-3 relative">
        {/* Native HTML5 video player */}
        <video
          controls
          className="w-full max-h-[500px] object-contain"
          style={{ background: '#000' }}
        >
          <source src={url} type={mimeType || 'video/webm'} />
          Your browser does not support video playback.
        </video>
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
          {scenes} scenes · {mins}:{secs}
        </div>
      </div>

      {!hasAudio && audioUrl && (
        <div className="mb-3 p-3 rounded-lg bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-300">
          ⚠️ Audio is a separate track (browser limitation). Play both together below or edit in any video editor.
          <br/>
          <audio controls className="w-full mt-2">
            <source src={audioUrl} type="audio/mpeg" />
          </audio>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mt-2">
        <a
          href={url}
          download={`video-${Date.now()}.webm`}
          className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-red-950/30 border border-red-800/40 text-red-300 rounded-lg hover:bg-red-950/60 transition-colors font-semibold"
        >
          ↓ Download Video (.webm)
        </a>
        <p className="self-center text-[10px] text-gray-600">
          Open in VLC, iMovie, or upload directly to YouTube
        </p>
      </div>
    </div>
  );
}

export default function MediaViewer({ output }) {
  const media = parseMediaOutput(output);
  if (!media) return null;

  if (media.type === 'images') return <ImageGallery media={media} />;
  if (media.type === 'audio') return <AudioPlayer media={media} />;
  if (media.type === 'video') return <VideoPlayer media={media} />;

  return <pre className="text-xs text-gray-400">{output}</pre>;
}
