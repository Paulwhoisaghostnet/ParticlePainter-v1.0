/**
 * Quick Export from Frame Buffer
 * 
 * Creates instant GIF/WebM exports from the rolling frame buffer
 * without requiring a new recording session.
 */

import GIF from "gif.js";
import type { BufferedFrame } from "./FrameBuffer";
import { getFrameBuffer } from "./FrameBuffer";

export type QuickExportProgress = {
  stage: "preparing" | "encoding" | "done" | "error";
  progress: number; // 0-1
  message: string;
};

/**
 * Export buffered frames to GIF
 */
export async function quickExportGif(
  frames: BufferedFrame[],
  onProgress?: (p: QuickExportProgress) => void,
  workerScriptUrl?: string
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error("No frames in buffer to export");
  }

  onProgress?.({ stage: "preparing", progress: 0, message: "Preparing frames..." });

  const buffer = getFrameBuffer();
  const { width, height } = buffer.getResolution();

  // Calculate frame delay based on timestamps
  let avgDelay = 1000 / 24; // Default 24fps
  if (frames.length >= 2) {
    const totalDuration = frames[frames.length - 1].timestamp - frames[0].timestamp;
    avgDelay = totalDuration / (frames.length - 1);
  }

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width,
      height,
      repeat: 0,
      workerScript: workerScriptUrl,
    });

    // Create a temp canvas for rendering frames
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Could not create canvas context"));
      return;
    }

    // Add all frames to GIF
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      ctx.putImageData(frame.imageData, 0, 0);
      
      // Calculate delay to next frame (or use average for last frame)
      let delay = avgDelay;
      if (i < frames.length - 1) {
        delay = frames[i + 1].timestamp - frame.timestamp;
      }
      
      gif.addFrame(ctx, { copy: true, delay: Math.max(10, delay) });
      
      onProgress?.({
        stage: "preparing",
        progress: (i + 1) / frames.length * 0.5,
        message: `Adding frame ${i + 1}/${frames.length}...`,
      });
    }

    gif.on("progress", (p: number) => {
      onProgress?.({
        stage: "encoding",
        progress: 0.5 + p * 0.5,
        message: `Encoding GIF... ${Math.round(p * 100)}%`,
      });
    });

    gif.on("finished", (blob: Blob) => {
      onProgress?.({ stage: "done", progress: 1, message: "Complete!" });
      resolve(blob);
    });

    gif.on("abort", () => {
      reject(new Error("GIF encoding aborted"));
    });

    onProgress?.({ stage: "encoding", progress: 0.5, message: "Encoding GIF..." });
    gif.render();
  });
}

/**
 * Export buffered frames to WebM using canvas-based approach
 * Note: This is a simpler approach than FFmpeg for quick exports
 */
export async function quickExportWebM(
  frames: BufferedFrame[],
  options?: {
    onProgress?: (p: QuickExportProgress) => void;
    audioStream?: MediaStream | null;
  }
): Promise<Blob> {
  const { onProgress, audioStream } = options || {};
  if (frames.length === 0) {
    throw new Error("No frames in buffer to export");
  }

  onProgress?.({ stage: "preparing", progress: 0, message: "Preparing video..." });

  const buffer = getFrameBuffer();
  const { width, height } = buffer.getResolution();

  // Calculate total duration and fps
  let duration = 5000; // Default 5 seconds
  let fps = 24;
  if (frames.length >= 2) {
    duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
    fps = Math.round((frames.length - 1) / (duration / 1000));
  }

  // Create a canvas for rendering
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  // Use MediaRecorder with canvas stream
  const canvasStream = canvas.captureStream(fps);
  
  // Combine video and audio tracks
  const tracks = [...canvasStream.getTracks()];
  const audioTracks = audioStream?.getAudioTracks() || [];
  const hasAudio = audioTracks.length > 0;
  
  if (hasAudio) {
    tracks.push(...audioTracks);
  }
  
  const combinedStream = new MediaStream(tracks);
  
  // Find supported codec - try with opus audio codec first if audio is present
  const codecs = hasAudio 
    ? [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ]
    : [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
  let mimeType = "video/webm";
  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      mimeType = codec;
      break;
    }
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      onProgress?.({ stage: "done", progress: 1, message: "Complete!" });
      resolve(blob);
    };

    recorder.onerror = (event) => {
      reject(new Error(`MediaRecorder error: ${event.type}`));
    };

    recorder.start();

    // Render frames at appropriate intervals
    let frameIndex = 0;

    const renderNextFrame = () => {
      if (frameIndex >= frames.length) {
        recorder.stop();
        return;
      }

      const frame = frames[frameIndex];
      
      // Clear the canvas before drawing each frame
      // The frames already have the clearRate effect baked in from the main render
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(frame.imageData, 0, 0);

      onProgress?.({
        stage: "encoding",
        progress: frameIndex / frames.length,
        message: `Encoding frame ${frameIndex + 1}/${frames.length}...`,
      });

      frameIndex++;

      // Calculate delay to next frame
      if (frameIndex < frames.length) {
        const currentTimestamp = frames[frameIndex - 1].timestamp;
        const nextTimestamp = frames[frameIndex].timestamp;
        const delay = nextTimestamp - currentTimestamp;
        setTimeout(renderNextFrame, Math.max(1, delay));
      } else {
        // Wait a bit for last frame to be captured, then stop
        setTimeout(() => recorder.stop(), 100);
      }
    };

    onProgress?.({ stage: "encoding", progress: 0, message: "Starting encoding..." });
    renderNextFrame();
  });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
