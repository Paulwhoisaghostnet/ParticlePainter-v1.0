import { useEffect, useRef, MutableRefObject } from "react";
import GIF from "gif.js";
import * as Tone from "tone";
import { useStudioStore } from "../state/store";
import { getAudioEngine } from "../components/AudioControls";
import { exportMP4, downloadBlob, getExportLogs } from "../engine/VideoExporter";
import { ParticleEngine } from "../engine/ParticleEngine";

export function useRecorder(
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  engineRef: MutableRefObject<ParticleEngine | null>,
  isInitialized: boolean
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioWasPlayingRef = useRef<boolean>(false);
  const gifWorkerUrl = useRef<string>(
    new URL("gif.js/dist/gif.worker.js", import.meta.url).toString()
  );

  // Store actions & state
  const setIsRecording = useStudioStore((s) => s.setIsRecording);
  const setIsGifExporting = useStudioStore((s) => s.setIsGifExporting);
  const setIsMp4Exporting = useStudioStore((s) => s.setIsMp4Exporting);
  const setExportProgress = useStudioStore((s) => s.setExportProgress);

  const startRecordingNonce = useStudioStore((s) => s.startRecordingNonce);
  const stopRecordingNonce = useStudioStore((s) => s.stopRecordingNonce);
  const exportGifNonce = useStudioStore((s) => s.exportGifNonce);
  const exportMp4Nonce = useStudioStore((s) => s.exportMp4Nonce);

  // Ref trackers for nonces
  const lastStartNonceRef = useRef(startRecordingNonce);
  const lastStopNonceRef = useRef(stopRecordingNonce);
  const lastMp4NonceRef = useRef(exportMp4Nonce);
  const lastGifNonceRef = useRef(exportGifNonce);

  // --- WebM Recording ---
  useEffect(() => {
    if (!isInitialized) return;
    if (
      startRecordingNonce === 0 ||
      startRecordingNonce === lastStartNonceRef.current
    )
      return;
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

    (async () => {
      try {
        const { loopMode } = useStudioStore.getState().global;
        if (resetOnStart && !loopMode) {
          engineRef.current?.resetAll();
        }

        const canvasStream = canvas.captureStream(fps);
        const tracks = [...canvasStream.getTracks()];

        console.log("[WebM Recording] Starting WebM recording setup");

        if (audioDestinationRef.current) {
          try {
            Tone.getDestination().disconnect(audioDestinationRef.current);
            audioDestinationRef.current = null;
          } catch (err) {
            // Ignore disconnect errors
          }
        }

        audioWasPlayingRef.current = false;

        try {
          const audioEngine = getAudioEngine();
          if (audioEngine.isLoaded()) {
            const audioCtx = Tone.context.rawContext as AudioContext;
            if (
              audioCtx &&
              typeof audioCtx.createMediaStreamDestination === "function"
            ) {
              audioWasPlayingRef.current = audioEngine.isPlaying();
              if (!audioWasPlayingRef.current) {
                console.log(
                  "[WebM Recording] Starting audio playback for recording"
                );
                audioEngine.play();
                await new Promise((resolve) => setTimeout(resolve, 100));
              }

              const audioDestination = audioCtx.createMediaStreamDestination();
              audioDestinationRef.current = audioDestination;

              const player = (audioEngine as any).player as Tone.Player | null;
              if (player) {
                player.connect(audioDestination as any);
                console.log(
                  "[WebM Recording] Connected audio player to recording stream"
                );
              }

              const testOsc = audioCtx.createOscillator();
              const testGain = audioCtx.createGain();
              testGain.gain.value = 0.0001;
              testOsc.connect(testGain);
              testGain.connect(audioDestination);
              testOsc.start();

              await new Promise((resolve) => setTimeout(resolve, 200));

              let audioTracks = audioDestination.stream.getAudioTracks();
              let attempts = 0;
              while (audioTracks.length === 0 && attempts < 5) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                audioTracks = audioDestination.stream.getAudioTracks();
                attempts++;
              }

              if (audioTracks.length > 0) {
                tracks.push(...audioTracks);
                console.log(
                  "[WebM Recording] Audio captured successfully -",
                  audioTracks.length,
                  "track(s)"
                );
              } else {
                console.warn(
                  "[WebM Recording] No audio tracks found after retries"
                );
              }
            }
          } else {
            console.warn(
              "[WebM Recording] Audio not loaded - WebM will have no audio"
            );
          }
        } catch (audioErr) {
          console.error("[WebM Recording] Audio capture error:", audioErr);
        }

        const combinedStream = new MediaStream(tracks);
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
          audioBitsPerSecond: 192000,
        });

        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (audioDestinationRef.current) {
            try {
              Tone.getDestination().disconnect(audioDestinationRef.current);
              const audioEngine = getAudioEngine();
              if (!audioWasPlayingRef.current && audioEngine.isPlaying()) {
                audioEngine.pause();
              }
              audioDestinationRef.current = null;
            } catch (err) {
              console.warn("Error disconnecting audio destination:", err);
            }
          }

          const blob = new Blob(recordedChunksRef.current, {
            type: "video/webm",
          });
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
          setTimeout(() => setExportProgress(0, ""), 2000);
        };

        setExportProgress(0, "Recording...");
        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);

        if (durationSeconds > 0) {
          const startTime = Date.now();
          const durationMs = durationSeconds * 1000;

          if (recordingTimeoutRef.current) {
            clearInterval(recordingTimeoutRef.current);
          }

          const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / durationMs);
            setExportProgress(
              progress,
              `Recording... ${Math.round(elapsed / 1000)}s / ${durationSeconds}s`
            );

            if (elapsed >= durationMs) {
              clearInterval(progressInterval);
              if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
              }
            }
          }, 100);
          recordingTimeoutRef.current = progressInterval as any;
        } else {
          setExportProgress(0, "Recording...");
        }
      } catch (err) {
        console.error("Failed to start recording:", err);
        setIsRecording(false);
      }
    })();
  }, [startRecordingNonce, setIsRecording, isInitialized, engineRef]);

  useEffect(() => {
    if (!isInitialized) return;
    if (
      stopRecordingNonce === 0 ||
      stopRecordingNonce === lastStopNonceRef.current
    )
      return;
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
  }, [stopRecordingNonce, isInitialized]);

  // --- GIF Export ---
  useEffect(() => {
    if (!isInitialized) return;
    if (exportGifNonce === 0 || exportGifNonce === lastGifNonceRef.current)
      return;
    lastGifNonceRef.current = exportGifNonce;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { recordingFps, gifDuration, recordingResetOnStart } =
      useStudioStore.getState().global;
    const fps = recordingFps ?? 30;
    const duration = gifDuration ?? 3;
    const resetOnStart = Boolean(recordingResetOnStart);
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
      repeat: 0,
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
        const { loopMode } = useStudioStore.getState().global;
        if (resetOnStart && !loopMode) {
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

          if (i % 5 === 0 || i === totalFrames - 1) {
            setExportProgress(
              (i / totalFrames) * 0.5,
              `Capturing frame ${i + 1}/${totalFrames}`
            );
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

        gif.on("progress", (p: number) => {
          setExportProgress(
            0.5 + p * 0.5,
            `Rendering ${Math.round(p * 100)}%`
          );
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
  }, [exportGifNonce, setIsGifExporting, isInitialized, engineRef]);

  // --- MP4 Export ---
  useEffect(() => {
    if (!isInitialized) return;
    if (exportMp4Nonce === 0 || exportMp4Nonce === lastMp4NonceRef.current)
      return;
    lastMp4NonceRef.current = exportMp4Nonce;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { recordingFps, mp4Duration, audioUrl, recordingResetOnStart } =
      useStudioStore.getState().global;
    const fps = recordingFps ?? 30;

    let durationMs: number;
    if (mp4Duration === -1) {
      const audioEngine = getAudioEngine();
      const audioDurationSec = audioEngine.getDuration();
      if (audioDurationSec > 0) {
        durationMs = audioDurationSec * 1000;
      } else {
        durationMs = 60000;
        console.warn("Audio duration not available, using 60s default");
      }
    } else {
      durationMs = (mp4Duration ?? 15) * 1000;
    }

    const { loopMode } = useStudioStore.getState().global;
    if (recordingResetOnStart && !loopMode) {
      engineRef.current?.resetAll();
    }

    if (mp4Duration === -1 && audioUrl) {
      const audioEngine = getAudioEngine();
      audioEngine.restart();
    }

    setIsMp4Exporting(true);
    setExportProgress(0, "Initializing MP4...");
    console.log("=== Starting MP4 Export ===");

    exportMP4(canvas, audioUrl ?? null, durationMs, fps, (progress) => {
      console.log(
        `MP4 Export: ${progress.message} (${Math.round(
          progress.progress * 100
        )}%)`
      );
      setExportProgress(progress.progress, progress.message);
    })
      .then((blob) => {
        console.log("=== MP4 Export Successful ===");
        downloadBlob(blob, `particle-studio-${Date.now()}-${fps}fps.mp4`);
        setIsMp4Exporting(false);
      })
      .catch((err) => {
        console.error("=== MP4 Export Failed ===");
        const logs = getExportLogs();
        console.error("Export logs:", logs);
        const errorMessage = err instanceof Error ? err.message : String(err);
        alert(
          `MP4 Export Failed!\n\n${errorMessage}\n\nCheck browser console for detailed export logs.`
        );
        setIsMp4Exporting(false);
      });
  }, [exportMp4Nonce, setIsMp4Exporting, isInitialized, engineRef]);
}
