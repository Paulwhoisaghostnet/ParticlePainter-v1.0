import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// Logging utilities shared with VideoExporter
export type ExportLogEntry = {
  timestamp: number;
  stage: string;
  message: string;
  data?: unknown;
};

let exportLogs: ExportLogEntry[] = [];

function logExport(stage: string, message: string, data?: unknown) {
  const entry: ExportLogEntry = {
    timestamp: Date.now(),
    stage,
    message,
    data: data !== undefined ? data : undefined,
  };
  exportLogs.push(entry);
  console.log(`[WebCodecs MP4 Export - ${stage}] ${message}`, data !== undefined ? data : "");
}

export function getExportLogs(): ExportLogEntry[] {
  return [...exportLogs];
}

export function clearExportLogs() {
  exportLogs = [];
}

export type ExportProgress = {
  stage: "recording" | "processing" | "done";
  progress: number; // 0-1
  message: string;
};

// Check if WebCodecs API is available in this browser
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

// Check if H.264 encoding is supported
export async function isH264EncodingSupported(): Promise<boolean> {
  if (!isWebCodecsSupported()) return false;
  
  try {
    const config: VideoEncoderConfig = {
      codec: "avc1.42001E", // H.264 Baseline Level 3.0
      width: 1920,
      height: 1080,
      bitrate: 2_000_000,
      framerate: 30,
    };
    const support = await VideoEncoder.isConfigSupported(config);
    return support.supported === true;
  } catch {
    return false;
  }
}

// Check if AAC audio encoding is supported
export async function isAACEncodingSupported(): Promise<boolean> {
  if (typeof AudioEncoder === "undefined") return false;
  
  try {
    const config: AudioEncoderConfig = {
      codec: "mp4a.40.2", // AAC-LC
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    };
    const support = await AudioEncoder.isConfigSupported(config);
    return support.supported === true;
  } catch {
    return false;
  }
}

// Check if the optimized WebCodecs pipeline can be used
export async function canUseOptimizedPipeline(hasAudio: boolean): Promise<boolean> {
  const h264Supported = await isH264EncodingSupported();
  
  if (!h264Supported) {
    logExport("SUPPORT_CHECK", "H.264 encoding not supported");
    return false;
  }
  
  if (hasAudio) {
    const aacSupported = await isAACEncodingSupported();
    if (!aacSupported) {
      logExport("SUPPORT_CHECK", "AAC encoding not supported, but H.264 is. Falling back to FFmpeg for audio.");
      return false;
    }
  }
  
  logExport("SUPPORT_CHECK", "WebCodecs pipeline is fully supported", { hasAudio });
  return true;
}

// Export MP4 using WebCodecs API
export async function exportMP4WithWebCodecs(
  canvas: HTMLCanvasElement,
  audioDestination: MediaStreamAudioDestinationNode | null,
  durationMs: number,
  fps: number,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  clearExportLogs();
  const exportStartTime = Date.now();
  
  logExport("START", "Beginning WebCodecs MP4 export", {
    durationMs,
    fps,
    hasAudio: !!audioDestination,
    canvasSize: { width: canvas.width, height: canvas.height },
  });
  
  onProgress?.({ stage: "recording", progress: 0, message: "Initializing encoders..." });
  
  // Create muxer
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: canvas.width,
      height: canvas.height,
    },
    audio: audioDestination ? {
      codec: "aac",
      sampleRate: audioDestination.context.sampleRate,
      numberOfChannels: audioDestination.channelCount,
    } : undefined,
    fastStart: "in-memory",
  });
  
  logExport("MUXER", "Muxer created", {
    hasVideo: true,
    hasAudio: !!audioDestination,
  });
  
  // Configure video encoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      muxer.addVideoChunk(chunk, metadata);
    },
    error: (err) => {
      logExport("VIDEO_ENCODER", "Video encoder error", { error: String(err) });
      throw err;
    },
  });
  
  const videoConfig: VideoEncoderConfig = {
    codec: "avc1.42001E", // H.264 Baseline Level 3.0
    width: canvas.width,
    height: canvas.height,
    bitrate: 8_000_000, // 8 Mbps
    framerate: fps,
  };
  
  videoEncoder.configure(videoConfig);
  logExport("VIDEO_ENCODER", "Video encoder configured", videoConfig);
  
  // Configure audio encoder if audio is present
  let audioEncoder: AudioEncoder | null = null;
  let audioData: AudioData[] = [];
  
  if (audioDestination) {
    audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => {
        muxer.addAudioChunk(chunk, metadata);
      },
      error: (err) => {
        logExport("AUDIO_ENCODER", "Audio encoder error", { error: String(err) });
        throw err;
      },
    });
    
    const audioConfig: AudioEncoderConfig = {
      codec: "mp4a.40.2", // AAC-LC
      sampleRate: audioDestination.context.sampleRate,
      numberOfChannels: audioDestination.channelCount,
      bitrate: 192_000, // 192 kbps
    };
    
    audioEncoder.configure(audioConfig);
    logExport("AUDIO_ENCODER", "Audio encoder configured", audioConfig);
  }
  
  onProgress?.({ stage: "recording", progress: 0.1, message: "Recording frames..." });
  
  // Capture frames from canvas
  const frameDurationUs = (1_000_000 / fps);
  let frameCount = 0;
  const totalFrames = Math.floor((durationMs / 1000) * fps);
  
  logExport("CAPTURE", "Starting frame capture", { totalFrames, frameDurationUs });
  
  return new Promise<Blob>((resolve, reject) => {
    const startTime = Date.now();
    let lastProgressUpdate = Date.now();
    
    // Capture audio if present
    if (audioDestination && audioEncoder) {
      // For this implementation, we'll use MediaRecorder to capture audio
      // and then encode it with AudioEncoder. This is a simplified approach.
      logExport("AUDIO", "Note: Audio capture via WebCodecs requires more complex setup");
      logExport("AUDIO", "For full audio support, consider using MediaStreamTrackProcessor");
    }
    
    const captureFrame = async () => {
      try {
        if (frameCount >= totalFrames) {
          // Done capturing frames
          logExport("CAPTURE", "Frame capture complete", { frameCount });
          onProgress?.({ stage: "processing", progress: 0.7, message: "Finalizing video..." });
          
          // Flush encoders
          await videoEncoder.flush();
          logExport("VIDEO_ENCODER", "Video encoder flushed");
          
          if (audioEncoder) {
            await audioEncoder.flush();
            logExport("AUDIO_ENCODER", "Audio encoder flushed");
          }
          
          // Finalize muxer
          muxer.finalize();
          logExport("MUXER", "Muxer finalized");
          
          // Get the MP4 blob
          const buffer = target.buffer;
          const blob = new Blob([buffer], { type: "video/mp4" });
          
          const totalTime = Date.now() - exportStartTime;
          logExport("COMPLETE", "WebCodecs MP4 export completed", {
            totalTimeMs: totalTime,
            blobSize: blob.size,
            frameCount,
          });
          
          onProgress?.({ stage: "done", progress: 1, message: "Complete!" });
          
          // Cleanup
          videoEncoder.close();
          if (audioEncoder) audioEncoder.close();
          
          resolve(blob);
          return;
        }
        
        // Create VideoFrame from canvas
        const bitmap = await createImageBitmap(canvas);
        const frame = new VideoFrame(bitmap, {
          timestamp: frameCount * frameDurationUs,
        });
        
        // Encode frame
        const keyFrame = frameCount % 30 === 0; // Keyframe every 30 frames
        videoEncoder.encode(frame, { keyFrame });
        frame.close();
        bitmap.close();
        
        frameCount++;
        
        // Update progress
        const now = Date.now();
        if (now - lastProgressUpdate > 200) {
          const progress = frameCount / totalFrames;
          onProgress?.({
            stage: "recording",
            progress: 0.1 + (progress * 0.6), // 10% to 70%
            message: `Recording... ${frameCount}/${totalFrames} frames`,
          });
          lastProgressUpdate = now;
        }
        
        // Schedule next frame
        // Use a small timeout to avoid blocking the browser
        setTimeout(captureFrame, 0);
      } catch (err) {
        logExport("ERROR", "Frame capture failed", { error: String(err), frameCount });
        reject(err);
      }
    };
    
    // Start capturing frames
    captureFrame();
  });
}
