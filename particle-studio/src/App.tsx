import { useEffect, useRef } from "react";
import GIF from "gif.js";
import * as Tone from "tone";
import { useStudioStore } from "./state/store";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { ExportBar } from "./components/ExportBar";
import { ParticleEngine } from "./engine/ParticleEngine";
import { getAudioEngine } from "./components/AudioControls";
import { exportMP4, downloadBlob, abortCurrentExport, getExportLogs } from "./engine/VideoExporter";

const LOCKED_SIZE = 2048;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitialized = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const gifWorkerUrl = useRef<string>(new URL("gif.js/dist/gif.worker.js", import.meta.url).toString());

  // Mark as initialized after first render cycle completes
  useEffect(() => {
    // Use setTimeout to ensure this runs after all initial effects
    const timer = setTimeout(() => {
      isInitialized.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const layers = useStudioStore((s) => s.layers);
  const global = useStudioStore((s) => s.global);
  const setIsRecording = useStudioStore((s) => s.setIsRecording);
  const setIsGifExporting = useStudioStore((s) => s.setIsGifExporting);

  const engineRef = useRef<ParticleEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ParticleEngine(canvas);
    engineRef.current = engine;

    engine.resize(LOCKED_SIZE, LOCKED_SIZE);

    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === " ") {
        useStudioStore.getState().togglePause();
      }
      if (e.key.toLowerCase() === "r") {
        useStudioStore.getState().requestResetAll();
      }
      if (e.key.toLowerCase() === "s") {
        useStudioStore.getState().requestScreenshot();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    let raf = 0;
    const tick = () => {
      engine.setGlobal(global);
      engine.setLayers(layers);
      
      // Get audio analysis and pass to engine
      const audioEngine = getAudioEngine();
      if (audioEngine.isPlaying()) {
        const audioData = audioEngine.getAnalysis();
        engine.setAudioData(audioData);
      } else {
        engine.setAudioData(null);
      }
      
      engine.step();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [global, layers]);

  // one-way “commands” from UI -> engine
  const resetNonce = useStudioStore((s) => s.resetNonce);
  const screenshotNonce = useStudioStore((s) => s.screenshotNonce);

  useEffect(() => {
    // Skip until initialized
    if (!isInitialized.current) return;
    engineRef.current?.resetAll();
  }, [resetNonce]);

  useEffect(() => {
    // Skip until initialized to avoid auto-download on load
    if (!isInitialized.current) return;
    const engine = engineRef.current;
    if (!engine) return;
    const url = engine.screenshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `particle-studio-${Date.now()}.png`;
    a.click();
  }, [screenshotNonce]);

  // Recording
  const startRecordingNonce = useStudioStore((s) => s.startRecordingNonce);
  const stopRecordingNonce = useStudioStore((s) => s.stopRecordingNonce);
  const lastStartNonceRef = useRef(0);
  const lastStopNonceRef = useRef(0);

  useEffect(() => {
    // Skip if not initialized or if nonce hasn't actually changed (initial mount)
    if (!isInitialized.current) return;
    if (startRecordingNonce === 0 || startRecordingNonce === lastStartNonceRef.current) return;
    lastStartNonceRef.current = startRecordingNonce;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { recordingFps, webmDuration, recordingResetOnStart } =
      useStudioStore.getState().global;
    const fps = recordingFps ?? 30;
    const durationSeconds = webmDuration ?? 0;
    const resetOnStart = Boolean(recordingResetOnStart);
    
    // Higher bitrate for higher FPS
    const bitrate = fps === 60 ? 16000000 : fps === 30 ? 10000000 : 8000000;

    try {
      if (resetOnStart) {
        engineRef.current?.resetAll();
      }
      
      const canvasStream = canvas.captureStream(fps);
      const tracks = [...canvasStream.getTracks()];
      
      // Try to capture audio from Tone.js context
      try {
        const audioCtx = Tone.context.rawContext;
        if (audioCtx && audioCtx instanceof AudioContext) {
          const dest = audioCtx.createMediaStreamDestination();
          // Connect Tone.js destination to our capture destination
          Tone.getDestination().connect(dest);
          const audioTracks = dest.stream.getAudioTracks();
          tracks.push(...audioTracks);
        }
      } catch (audioErr) {
        console.warn("Could not capture audio:", audioErr);
      }
      
      const combinedStream = new MediaStream(tracks);
      
      // Try VP9+opus first for audio, fall back
      const codecsToTry = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      
      let mimeType = "video/webm";
      for (const codec of codecsToTry) {
        if (MediaRecorder.isTypeSupported(codec)) {
          mimeType = codec;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: bitrate
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `particle-studio-${Date.now()}-${fps}fps.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        if (recordingTimeoutRef.current) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
      };

      mediaRecorder.start(100); // collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      if (durationSeconds > 0) {
        if (recordingTimeoutRef.current) {
          window.clearTimeout(recordingTimeoutRef.current);
        }
        recordingTimeoutRef.current = window.setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        }, durationSeconds * 1000);
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
      setIsRecording(false);
    }
  }, [startRecordingNonce, setIsRecording]);

  useEffect(() => {
    // Skip if not initialized or if nonce hasn't actually changed
    if (!isInitialized.current) return;
    if (stopRecordingNonce === 0 || stopRecordingNonce === lastStopNonceRef.current) return;
    lastStopNonceRef.current = stopRecordingNonce;
    
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, [stopRecordingNonce]);

  // GIF export (fixed frame timing)
  const exportGifNonce = useStudioStore((s) => s.exportGifNonce);

  useEffect(() => {
    if (!isInitialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { recordingFps, gifDuration } = useStudioStore.getState().global;
    const fps = recordingFps ?? 30;
    const duration = gifDuration ?? 3;
    // Use precise frame duration without rounding to maintain accurate timing
    const frameDurationMs = 1000 / fps;
    const totalFrames = Math.max(1, Math.round(fps * duration));

    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: gifWorkerUrl.current,
      width: offscreen.width,
      height: offscreen.height,
      repeat: 0
    });

    const waitForNextFrameTime = (targetTime: number) =>
      new Promise<void>((resolve) => {
        const tick = () => {
          if (performance.now() >= targetTime) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    let cancelled = false;
    setIsGifExporting(true);

    (async () => {
      try {
        let nextTime = performance.now();
        for (let i = 0; i < totalFrames; i += 1) {
          await waitForNextFrameTime(nextTime);
          if (cancelled) return;
          nextTime += frameDurationMs;

          offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
          offCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);

          gif.addFrame(offCtx, { copy: true, delay: frameDurationMs });
        }

        gif.on("finished", (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `particle-studio-${Date.now()}-${fps}fps.gif`;
          a.click();
          URL.revokeObjectURL(url);
          setIsGifExporting(false);
        });

        gif.on("abort", () => {
          setIsGifExporting(false);
        });

        gif.render();
      } catch (err) {
        console.error("Failed to export GIF:", err);
        setIsGifExporting(false);
      }
    })();

    return () => {
      cancelled = true;
      gif.abort();
    };
  }, [exportGifNonce, setIsGifExporting]);

  // MP4 export with audio
  const exportMp4Nonce = useStudioStore((s) => s.exportMp4Nonce);
  const setIsMp4Exporting = useStudioStore((s) => s.setIsMp4Exporting);
  const lastMp4NonceRef = useRef(0);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (exportMp4Nonce === 0 || exportMp4Nonce === lastMp4NonceRef.current) return;
    lastMp4NonceRef.current = exportMp4Nonce;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { recordingFps, mp4Duration, audioUrl, recordingResetOnStart } =
      useStudioStore.getState().global;
    const fps = recordingFps ?? 30;

    // Determine duration: -1 means match audio length
    let durationMs: number;
    if (mp4Duration === -1) {
      // Get actual audio duration from the audio engine
      const audioEngine = getAudioEngine();
      const audioDurationSec = audioEngine.getDuration();
      if (audioDurationSec > 0) {
        durationMs = audioDurationSec * 1000;
      } else {
        // Fallback if audio not loaded
        durationMs = 60000;
        console.warn("Audio duration not available, using 60s default");
      }
    } else {
      durationMs = (mp4Duration ?? 15) * 1000;
    }

    if (recordingResetOnStart) {
      engineRef.current?.resetAll();
    }
    
    // Reset and restart audio to sync with recording if audio is loaded
    if (mp4Duration === -1 && audioUrl) {
      const audioEngine = getAudioEngine();
      audioEngine.restart();
    }

    setIsMp4Exporting(true);
    console.log("=== Starting MP4 Export ===");
    console.log(`Duration: ${durationMs}ms, FPS: ${fps}, Has Audio: ${!!audioUrl}`);

    exportMP4(canvas, audioUrl ?? null, durationMs, fps, (progress) => {
      console.log(`MP4 Export: ${progress.message} (${Math.round(progress.progress * 100)}%)`);
    })
      .then((blob) => {
        console.log("=== MP4 Export Successful ===");
        console.log(`Output size: ${blob.size} bytes`);
        downloadBlob(blob, `particle-studio-${Date.now()}-${fps}fps.mp4`);
        setIsMp4Exporting(false);
      })
      .catch((err) => {
        console.error("=== MP4 Export Failed ===");
        console.error("Error:", err);
        
        // Get and display export logs for debugging
        const logs = getExportLogs();
        console.error("Export logs:", logs);
        
        // Show user-friendly error message
        const errorMessage = err instanceof Error ? err.message : String(err);
        alert(`MP4 Export Failed!\n\n${errorMessage}\n\nCheck browser console for detailed export logs.`);
        
        setIsMp4Exporting(false);
      });
  }, [exportMp4Nonce, setIsMp4Exporting]);

  return (
    <div className="app">
      {/* Left Panel - Physics/Motion */}
      <LeftPanel />

      {/* Center - Canvas */}
      <div className="canvasArea">
        <div className="canvasWrap">
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Export Bar - Below Canvas */}
      <ExportBar />

      {/* Right Panel - Render/Appearance */}
      <RightPanel />
    </div>
  );
}