import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoaded = false;

// Export logging utility for detailed debugging
export type ExportLogEntry = {
  timestamp: number;
  stage: string;
  message: string;
  data?: unknown;
};

let exportLogs: ExportLogEntry[] = [];
let currentExportAborted = false;

function logExport(stage: string, message: string, data?: unknown) {
  const entry: ExportLogEntry = {
    timestamp: Date.now(),
    stage,
    message,
    data: data !== undefined ? data : undefined,
  };
  exportLogs.push(entry);
  console.log(`[MP4 Export - ${stage}] ${message}`, data !== undefined ? data : "");
}

export function getExportLogs(): ExportLogEntry[] {
  return [...exportLogs];
}

export function clearExportLogs() {
  exportLogs = [];
}

export function abortCurrentExport() {
  logExport("ABORT", "Export abort requested by user");
  currentExportAborted = true;
}

export function isExportAborted(): boolean {
  return currentExportAborted;
}

// Timeout wrapper for async operations
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logExport("TIMEOUT", `Operation "${operationName}" timed out after ${timeoutMs}ms`);
      reject(new Error(`Timeout: ${operationName} took longer than ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

// Initialize FFmpeg lazily
async function getFFmpeg(): Promise<FFmpeg> {
  logExport("INIT", "getFFmpeg() called", { ffmpegLoaded, ffmpegLoading });
  
  if (ffmpegLoaded && ffmpeg) {
    logExport("INIT", "FFmpeg already loaded, returning cached instance");
    return ffmpeg;
  }
  
  if (ffmpegLoading) {
    logExport("INIT", "FFmpeg is currently loading, waiting...");
    // Wait for existing load with timeout
    const startWait = Date.now();
    while (ffmpegLoading) {
      await new Promise((r) => setTimeout(r, 100));
      if (Date.now() - startWait > 60000) {
        logExport("INIT", "Timeout waiting for existing FFmpeg load");
        throw new Error("Timeout waiting for FFmpeg to load");
      }
    }
    if (ffmpeg) {
      logExport("INIT", "FFmpeg loaded by another call, returning instance");
      return ffmpeg;
    }
  }

  ffmpegLoading = true;
  logExport("INIT", "Starting FFmpeg initialization");
  
  try {
    ffmpeg = new FFmpeg();
    logExport("INIT", "FFmpeg instance created");

    // Set up logging for FFmpeg
    ffmpeg.on("log", ({ message }) => {
      logExport("FFMPEG_LOG", message);
    });

    // Load FFmpeg core from CDN with timeout
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    logExport("INIT", "Fetching FFmpeg core from CDN", { baseURL });
    
    const coreURL = await withTimeout(
      toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      30000,
      "Fetch ffmpeg-core.js"
    );
    logExport("INIT", "FFmpeg core.js fetched successfully");
    
    const wasmURL = await withTimeout(
      toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      60000,
      "Fetch ffmpeg-core.wasm"
    );
    logExport("INIT", "FFmpeg core.wasm fetched successfully");
    
    logExport("INIT", "Loading FFmpeg with core and wasm URLs");
    await withTimeout(
      ffmpeg.load({ coreURL, wasmURL }),
      60000,
      "FFmpeg load"
    );

    ffmpegLoaded = true;
    logExport("INIT", "FFmpeg loaded successfully");
    return ffmpeg;
  } catch (err) {
    logExport("INIT", "FFmpeg initialization failed", { error: String(err) });
    ffmpeg = null;
    ffmpegLoaded = false;
    throw err;
  } finally {
    ffmpegLoading = false;
  }
}

export type ExportProgress = {
  stage: "recording" | "processing" | "done";
  progress: number; // 0-1
  message: string;
};

// Record canvas to WebM with audio from audio context
export async function recordWebM(
  canvas: HTMLCanvasElement,
  audioDestination: MediaStreamAudioDestinationNode | null,
  durationMs: number | null, // null = manual stop
  fps: number,
  onProgress?: (p: ExportProgress) => void,
  stopSignal?: { stop: boolean }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvasStream = canvas.captureStream(fps);
    
    // Combine video and audio streams
    const tracks = [...canvasStream.getTracks()];
    if (audioDestination) {
      const audioTracks = audioDestination.stream.getAudioTracks();
      tracks.push(...audioTracks);
    }
    
    const combinedStream = new MediaStream(tracks);
    
    // Try codecs in order of preference
    const codecs = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
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
      videoBitsPerSecond: 8_000_000,
    });
    
    const chunks: Blob[] = [];
    
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
    
    recorder.onerror = (e) => {
      reject(new Error("Recording failed"));
    };
    
    recorder.start(100); // Collect data every 100ms
    
    const startTime = Date.now();
    
    // Progress tracking
    const progressInterval = setInterval(() => {
      if (durationMs) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        onProgress?.({
          stage: "recording",
          progress,
          message: `Recording... ${Math.floor(elapsed / 1000)}s / ${Math.floor(durationMs / 1000)}s`,
        });
      } else {
        const elapsed = Date.now() - startTime;
        onProgress?.({
          stage: "recording",
          progress: 0.5,
          message: `Recording... ${Math.floor(elapsed / 1000)}s`,
        });
      }
      
      // Check for stop signal
      if (stopSignal?.stop) {
        clearInterval(progressInterval);
        recorder.stop();
      }
    }, 200);
    
    // Auto-stop after duration
    if (durationMs) {
      setTimeout(() => {
        clearInterval(progressInterval);
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, durationMs);
    }
  });
}

// Export MP4 with audio using FFmpeg
// Timeout for FFmpeg operations (5 minutes for long videos)
const FFMPEG_OPERATION_TIMEOUT_MS = 5 * 60 * 1000;

export async function exportMP4(
  canvas: HTMLCanvasElement,
  audioUrl: string | null,
  durationMs: number,
  fps: number,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  // Clear previous logs and reset abort flag
  clearExportLogs();
  currentExportAborted = false;
  
  const exportStartTime = Date.now();
  logExport("START", "Beginning MP4 export", { 
    durationMs, 
    fps, 
    hasAudio: !!audioUrl,
    canvasSize: { width: canvas.width, height: canvas.height }
  });
  
  onProgress?.({ stage: "recording", progress: 0, message: "Recording video..." });
  
  // First record to WebM (video only)
  logExport("RECORD", "Starting WebM recording phase");
  const recordStartTime = Date.now();
  
  let webmBlob: Blob;
  try {
    webmBlob = await recordWebM(canvas, null, durationMs, fps, (p) => {
      if (p.stage === "recording") {
        onProgress?.({
          stage: "recording",
          progress: p.progress * 0.5, // Recording is first 50%
          message: p.message,
        });
      }
    });
    logExport("RECORD", "WebM recording complete", { 
      blobSize: webmBlob.size,
      durationTaken: Date.now() - recordStartTime
    });
  } catch (err) {
    logExport("RECORD", "WebM recording failed", { error: String(err) });
    throw err;
  }
  
  // Check if aborted
  if (currentExportAborted) {
    logExport("ABORT", "Export aborted after recording phase");
    throw new Error("Export aborted by user");
  }
  
  onProgress?.({ stage: "processing", progress: 0.5, message: "Loading FFmpeg..." });
  logExport("FFMPEG", "Loading FFmpeg...");
  
  let ff: FFmpeg;
  try {
    ff = await getFFmpeg();
    logExport("FFMPEG", "FFmpeg loaded successfully");
  } catch (err) {
    logExport("FFMPEG", "Failed to load FFmpeg", { error: String(err) });
    throw err;
  }
  
  onProgress?.({ stage: "processing", progress: 0.55, message: "Processing video..." });
  
  // Set up progress monitoring
  let lastProgressUpdate = Date.now();
  let lastProgressValue = 0;
  
  const progressHandler = ({ progress }: { progress: number }) => {
    lastProgressUpdate = Date.now();
    lastProgressValue = progress;
    // progress is 0-1, map it to the processing phase (0.55 - 0.95)
    const mappedProgress = 0.55 + (progress * 0.4);
    logExport("FFMPEG_PROGRESS", `Processing: ${Math.round(progress * 100)}%`);
    onProgress?.({ 
      stage: "processing", 
      progress: mappedProgress, 
      message: `Processing video... ${Math.round(progress * 100)}%`
    });
  };
  
  ff.on("progress", progressHandler);
  
  // Progress stall detection - check if FFmpeg is making progress
  let progressCheckInterval: ReturnType<typeof setInterval> | null = null;
  const progressStallTimeoutMs = 120000; // 2 minutes without progress = stalled
  
  const startProgressMonitoring = () => {
    progressCheckInterval = setInterval(() => {
      const timeSinceLastProgress = Date.now() - lastProgressUpdate;
      if (timeSinceLastProgress > progressStallTimeoutMs) {
        logExport("STALL", "FFmpeg progress stalled", {
          timeSinceLastProgress,
          lastProgressValue,
        });
        // Note: We can't easily abort FFmpeg, but we log the stall
      }
    }, 10000); // Check every 10 seconds
  };
  
  const stopProgressMonitoring = () => {
    if (progressCheckInterval) {
      clearInterval(progressCheckInterval);
      progressCheckInterval = null;
    }
  };
  
  try {
    // Write video to FFmpeg virtual filesystem
    logExport("FFMPEG", "Reading WebM blob to ArrayBuffer");
    const videoArrayBuffer = await webmBlob.arrayBuffer();
    const videoData = new Uint8Array(videoArrayBuffer);
    logExport("FFMPEG", "Writing input.webm to virtual filesystem", { size: videoData.length });
    
    await withTimeout(
      ff.writeFile("input.webm", videoData),
      30000,
      "Write input.webm"
    );
    logExport("FFMPEG", "input.webm written successfully");
    
    // Check if aborted
    if (currentExportAborted) {
      logExport("ABORT", "Export aborted before FFmpeg conversion");
      throw new Error("Export aborted by user");
    }
    
    // If we have audio, fetch and write it
    if (audioUrl) {
      onProgress?.({ stage: "processing", progress: 0.6, message: "Processing audio..." });
      logExport("AUDIO", "Fetching audio file", { audioUrl });
      
      const audioData = await withTimeout(
        fetchFile(audioUrl),
        60000,
        "Fetch audio file"
      );
      logExport("AUDIO", "Audio file fetched", { size: audioData.byteLength });
      
      await withTimeout(
        ff.writeFile("audio.mp3", audioData),
        30000,
        "Write audio.mp3"
      );
      logExport("AUDIO", "audio.mp3 written to virtual filesystem");
      
      onProgress?.({ stage: "processing", progress: 0.7, message: "Muxing audio and video..." });
      logExport("FFMPEG", "Starting FFmpeg mux command (video + audio -> MP4)");
      
      // Start progress monitoring
      startProgressMonitoring();
      lastProgressUpdate = Date.now();
      
      // Mux video + audio into MP4
      const ffmpegArgs = [
        "-i", "input.webm",
        "-i", "audio.mp3",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        "output.mp4",
      ];
      logExport("FFMPEG", "FFmpeg command", { args: ffmpegArgs });
      
      try {
        await withTimeout(
          ff.exec(ffmpegArgs),
          FFMPEG_OPERATION_TIMEOUT_MS,
          "FFmpeg mux video+audio"
        );
        logExport("FFMPEG", "FFmpeg mux command completed successfully");
      } catch (err) {
        logExport("FFMPEG", "FFmpeg muxing failed", { error: String(err) });
        stopProgressMonitoring();
        throw new Error(`Failed to mux audio and video: ${err}`);
      }
      stopProgressMonitoring();
    } else {
      onProgress?.({ stage: "processing", progress: 0.7, message: "Converting to MP4..." });
      logExport("FFMPEG", "Starting FFmpeg convert command (video only -> MP4)");
      
      // Start progress monitoring
      startProgressMonitoring();
      lastProgressUpdate = Date.now();
      
      // Just convert video to MP4
      const ffmpegArgs = [
        "-i", "input.webm",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-an",
        "-movflags", "+faststart",
        "output.mp4",
      ];
      logExport("FFMPEG", "FFmpeg command", { args: ffmpegArgs });
      
      try {
        await withTimeout(
          ff.exec(ffmpegArgs),
          FFMPEG_OPERATION_TIMEOUT_MS,
          "FFmpeg convert to MP4"
        );
        logExport("FFMPEG", "FFmpeg convert command completed successfully");
      } catch (err) {
        logExport("FFMPEG", "FFmpeg conversion failed", { error: String(err) });
        stopProgressMonitoring();
        throw new Error(`Failed to convert video to MP4: ${err}`);
      }
      stopProgressMonitoring();
    }
    
    onProgress?.({ stage: "processing", progress: 0.95, message: "Finalizing..." });
    logExport("FINALIZE", "Reading output.mp4 from virtual filesystem");
    
    // Read the output
    let output;
    try {
      output = await withTimeout(
        ff.readFile("output.mp4"),
        30000,
        "Read output.mp4"
      );
      logExport("FINALIZE", "output.mp4 read successfully", { 
        outputType: typeof output,
        outputSize: typeof output === "string" ? output.length : output.byteLength
      });
    } catch (err) {
      logExport("FINALIZE", "Failed to read output.mp4", { error: String(err) });
      throw new Error(`Failed to read output file: ${err}`);
    }
    
    // Cleanup
    logExport("CLEANUP", "Cleaning up virtual filesystem");
    try {
      await ff.deleteFile("input.webm");
      logExport("CLEANUP", "Deleted input.webm");
    } catch (err) {
      logExport("CLEANUP", "Failed to delete input.webm (non-fatal)", { error: String(err) });
    }
    
    if (audioUrl) {
      try {
        await ff.deleteFile("audio.mp3");
        logExport("CLEANUP", "Deleted audio.mp3");
      } catch (err) {
        logExport("CLEANUP", "Failed to delete audio.mp3 (non-fatal)", { error: String(err) });
      }
    }
    
    try {
      await ff.deleteFile("output.mp4");
      logExport("CLEANUP", "Deleted output.mp4");
    } catch (err) {
      logExport("CLEANUP", "Failed to delete output.mp4 (non-fatal)", { error: String(err) });
    }
    
    const totalTime = Date.now() - exportStartTime;
    logExport("COMPLETE", "MP4 export completed successfully", { totalTimeMs: totalTime });
    onProgress?.({ stage: "done", progress: 1, message: "Complete!" });
    
    // Convert FileData to Blob - output can be Uint8Array or string
    if (typeof output === "string") {
      logExport("FINALIZE", "Converting string output to Blob");
      // If it's a string, encode it
      return new Blob([new TextEncoder().encode(output)], { type: "video/mp4" });
    }
    // It's a Uint8Array - create a new copy to ensure clean ArrayBuffer
    logExport("FINALIZE", "Converting Uint8Array output to Blob");
    const arrayBuffer = new Uint8Array(output).buffer;
    return new Blob([arrayBuffer], { type: "video/mp4" });
  } catch (err) {
    const totalTime = Date.now() - exportStartTime;
    logExport("ERROR", "MP4 export failed", { 
      error: String(err), 
      totalTimeMs: totalTime,
      exportLogs: exportLogs.length
    });
    
    // Print full export log summary for debugging
    console.error("=== MP4 EXPORT FAILURE LOG ===");
    exportLogs.forEach((log) => {
      console.error(`[${log.stage}] ${log.message}`, log.data || "");
    });
    console.error("=== END EXPORT LOG ===");
    
    throw err;
  } finally {
    // Clean up progress listener
    ff.off("progress", progressHandler);
    stopProgressMonitoring();
  }
}

// Download a blob as a file
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
