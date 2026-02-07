import { useEffect, useRef } from "react";
import GIF from "gif.js";
import * as Tone from "tone";
import { useStudioStore } from "./state/store";
import { getResolutionDimensions } from "./state/store";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { ExportBar } from "./components/ExportBar";
import { ParticleEngine } from "./engine/ParticleEngine";
import { getAudioEngine } from "./components/AudioControls";
import { exportMP4, downloadBlob, getExportLogs } from "./engine/VideoExporter";
import { getFrameBuffer } from "./engine/FrameBuffer";
import { WelcomePopup } from "./components/WelcomePopup";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitialized = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioWasPlayingRef = useRef<boolean>(false);
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
  const setExportProgress = useStudioStore((s) => s.setExportProgress);

  const engineRef = useRef<ParticleEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ParticleEngine(canvas);
    engineRef.current = engine;

    // Set initial resolution from global state
    const resolution = getResolutionDimensions(useStudioStore.getState().global);
    engine.resize(resolution.width, resolution.height);

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
      if (e.key.toLowerCase() === "h") {
        const { showWelcome } = useStudioStore.getState().global;
        useStudioStore.getState().setGlobal({ showWelcome: !showWelcome });
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update canvas resolution when resolution settings change
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    
    const resolution = getResolutionDimensions(global);
    engine.resize(resolution.width, resolution.height);
  }, [global.resolutionPreset, global.customWidth, global.customHeight]);

  // Update frame buffer config when settings change
  useEffect(() => {
    const frameBuffer = getFrameBuffer();
    frameBuffer.updateConfig({
      enabled: global.bufferEnabled,
      durationSeconds: global.bufferDuration,
      fps: global.bufferFps,
    });
  }, [global.bufferEnabled, global.bufferDuration, global.bufferFps]);

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
      
      // Capture frame to rolling buffer if enabled (after render completes)
      const canvas = canvasRef.current;
      if (canvas && global.bufferEnabled && !global.paused) {
        const frameBuffer = getFrameBuffer();
        frameBuffer.captureFrame(canvas);
      }
      
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

    // Wrap in async IIFE to allow await for audio track initialization
    (async () => {
      try {
        if (resetOnStart) {
          engineRef.current?.resetAll();
        }
        
        const canvasStream = canvas.captureStream(fps);
        const tracks = [...canvasStream.getTracks()];
        
        console.log("[WebM Recording] Starting WebM recording setup");
        
        // Clear any previous audio destination
        if (audioDestinationRef.current) {
          try {
            Tone.getDestination().disconnect(audioDestinationRef.current);
            audioDestinationRef.current = null;
          } catch (err) {
            // Ignore disconnect errors
          }
        }
        
        // Reset audio playback state tracking
        audioWasPlayingRef.current = false;
        
        // Try to capture audio from Tone.js if audio is loaded
        try {
          const audioEngine = getAudioEngine();
          
          if (audioEngine.isLoaded()) {
            const audioCtx = Tone.context.rawContext as AudioContext;
            
            // Duck typing: Check if it has the method we need instead of instanceof
            // Tone.js rawContext doesn't pass instanceof checks even though it's an AudioContext
            if (audioCtx && typeof audioCtx.createMediaStreamDestination === 'function') {
              // Start audio playback BEFORE creating MediaStreamDestination
              // The audio graph must be actively producing audio for tracks to appear
              audioWasPlayingRef.current = audioEngine.isPlaying();
              if (!audioWasPlayingRef.current) {
                console.log("[WebM Recording] Starting audio playback for recording");
                audioEngine.play();
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              const audioDestination = audioCtx.createMediaStreamDestination();
              audioDestinationRef.current = audioDestination;
              
              // Connect Player directly for audio capture
              const player = (audioEngine as any).player as Tone.Player | null;
              if (player) {
                player.connect(audioDestination as any);
                console.log("[WebM Recording] Connected audio player to recording stream");
              }
              
              // Workaround: Create a silent test oscillator to ensure MediaStreamDestination creates tracks
              // This is needed because Tone.js nodes don't always trigger track creation
              const testOsc = audioCtx.createOscillator();
              const testGain = audioCtx.createGain();
              testGain.gain.value = 0.0001; // Nearly silent
              testOsc.connect(testGain);
              testGain.connect(audioDestination);
              testOsc.start();
              
              // Wait for audio tracks to appear
              await new Promise(resolve => setTimeout(resolve, 200));
              
              let audioTracks = audioDestination.stream.getAudioTracks();
              let attempts = 0;
              while (audioTracks.length === 0 && attempts < 5) {
                await new Promise(resolve => setTimeout(resolve, 100));
                audioTracks = audioDestination.stream.getAudioTracks();
                attempts++;
              }
              
              if (audioTracks.length > 0) {
                tracks.push(...audioTracks);
                console.log("[WebM Recording] Audio captured successfully -", audioTracks.length, "track(s)");
              } else {
                console.warn("[WebM Recording] No audio tracks found after retries");
              }
            }
          } else {
            console.warn("[WebM Recording] Audio not loaded - WebM will have no audio");
          }
        } catch (audioErr) {
          console.error("[WebM Recording] Audio capture error:", audioErr);
        }
        
        const combinedStream = new MediaStream(tracks);
        console.log("[WebM Recording] Combined stream - Video tracks:", combinedStream.getVideoTracks().length, "Audio tracks:", combinedStream.getAudioTracks().length);
        
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
            console.log("[WebM Recording] Selected codec:", mimeType);
            break;
          }
        }
        
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: bitrate,
          audioBitsPerSecond: 192000, // Explicitly set audio bitrate
        });

        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          // Clean up audio destination connection if it was created
          if (audioDestinationRef.current) {
            try {
              Tone.getDestination().disconnect(audioDestinationRef.current);
              
              // Restore original audio playback state
              const audioEngine = getAudioEngine();
              if (!audioWasPlayingRef.current && audioEngine.isPlaying()) {
                audioEngine.pause();
              }
              
              audioDestinationRef.current = null;
            } catch (err) {
              console.warn("Error disconnecting audio destination:", err);
            }
          }
          
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `particle-studio-${Date.now()}-${fps}fps.webm`;
          a.click();
          URL.revokeObjectURL(url);
          setIsRecording(false);
          if (recordingTimeoutRef.current) {
            clearInterval(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
          }
          setExportProgress(1, "Done!");
          // Reset progress after a short delay
          setTimeout(() => setExportProgress(0, ""), 2000);
        };

        const setExportProgress = useStudioStore.getState().setExportProgress;
        setExportProgress(0, "Recording...");

        mediaRecorder.start(100); // collect data every 100ms
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        
        // Start progress tracking if duration is set
        if (durationSeconds > 0) {
          const startTime = Date.now();
          const durationMs = durationSeconds * 1000;
          
          // Clear any existing interval
          if (recordingTimeoutRef.current) {
            clearInterval(recordingTimeoutRef.current);
          }
           
          // Use an interval to update progress
          const progressInterval = setInterval(() => {
             const elapsed = Date.now() - startTime;
             const progress = Math.min(1, elapsed / durationMs);
             setExportProgress(progress, `Recording... ${Math.round(elapsed / 1000)}s / ${durationSeconds}s`);
             
             if (elapsed >= durationMs) {
                clearInterval(progressInterval);
                if (mediaRecorder.state === "recording") {
                   mediaRecorder.stop();
                }
             }
          }, 100);
          
          // Store interval ID in ref (casting to any/number to avoid type issues)
          recordingTimeoutRef.current = progressInterval as any;
        } else {
             // Manual stop: still update progress message but no %
             setExportProgress(0, "Recording...");
        }
      } catch (err) {
        console.error("Failed to start recording:", err);
        setIsRecording(false);
      }
    })(); // Close async IIFE
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
      clearInterval(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, [stopRecordingNonce]);

  // GIF export (fixed frame timing)
  const exportGifNonce = useStudioStore((s) => s.exportGifNonce);

  useEffect(() => {
    if (!isInitialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { recordingFps, gifDuration, recordingResetOnStart } = useStudioStore.getState().global;
    const fps = recordingFps ?? 30;
    const duration = gifDuration ?? 3;
    const resetOnStart = Boolean(recordingResetOnStart);
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
    setExportProgress(0, "Initializing...");

    (async () => {
      try {
        // Reset particles to time=0 if requested for proper loop export
        if (resetOnStart) {
          engineRef.current?.resetAll();
        }
        
        let nextTime = performance.now();
        for (let i = 0; i < totalFrames; i += 1) {
          await waitForNextFrameTime(nextTime);
          if (cancelled) return;
          nextTime += frameDurationMs;

          offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
          offCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);

          gif.addFrame(offCtx, { copy: true, delay: frameDurationMs });
          
          // Update progress (capturing matches first 50%) - throttled to every 5 frames
          if (i % 5 === 0 || i === totalFrames - 1) {
            setExportProgress((i / totalFrames) * 0.5, `Capturing frame ${i + 1}/${totalFrames}`);
          }
        }
        
        setExportProgress(0.5, "Rendering GIF...");

        gif.on("finished", (blob: Blob) => {
          setExportProgress(1, "Done!");
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

        // Add progress listener for rendering phase (remaining 50%)
        gif.on("progress", (p: number) => {
          setExportProgress(0.5 + (p * 0.5), `Rendering ${Math.round(p * 100)}%`);
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
    setExportProgress(0, "Initializing MP4...");
    console.log("=== Starting MP4 Export ===");
    console.log(`Duration: ${durationMs}ms, FPS: ${fps}, Has Audio: ${!!audioUrl}`);

    exportMP4(canvas, audioUrl ?? null, durationMs, fps, (progress) => {
      console.log(`MP4 Export: ${progress.message} (${Math.round(progress.progress * 100)}%)`);
      setExportProgress(progress.progress, progress.message);
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
      {/* Welcome popup on first load */}
      <WelcomePopup />
      
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