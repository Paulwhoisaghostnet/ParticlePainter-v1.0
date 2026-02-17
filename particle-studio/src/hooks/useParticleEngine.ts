import { useEffect, useRef, useState, MutableRefObject } from 'react';
import { ParticleEngine } from '../engine/ParticleEngine';
import { useStudioStore, getResolutionDimensions } from '../state/store';
import { getFrameBuffer } from '../engine/FrameBuffer';
import { getAudioEngine } from '../components/AudioControls';

export function useParticleEngine(canvasRef: MutableRefObject<HTMLCanvasElement | null>) {
  const engineRef = useRef<ParticleEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Store subscriptions
  const layers = useStudioStore((s) => s.layers);
  const global = useStudioStore((s) => s.global);
  const resetNonce = useStudioStore((s) => s.resetNonce);
  const screenshotNonce = useStudioStore((s) => s.screenshotNonce);

  // Initialize Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ParticleEngine(canvas);
    engineRef.current = engine;

    // Set initial resolution
    const resolution = getResolutionDimensions(useStudioStore.getState().global);
    engine.resize(resolution.width, resolution.height);

    // Initial render delay
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);

    return () => {
      clearTimeout(timer);
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // Only run once on mount

  // Handle Resolution Changes with Debounce
  useEffect(() => {
    if (!engineRef.current) return;

    // Debounce resize to prevent resource thrashing during rapid updates (e.g. typing or dragging inputs)
    const timer = setTimeout(() => {
      if (!engineRef.current) return;
      const resolution = getResolutionDimensions(global);
      engineRef.current.resize(resolution.width, resolution.height);
    }, 200);

    return () => clearTimeout(timer);
  }, [global.resolutionPreset, global.customWidth, global.customHeight]);

  // Handle Frame Buffer Config
  useEffect(() => {
    const frameBuffer = getFrameBuffer();
    frameBuffer.updateConfig({
      enabled: global.bufferEnabled,
      durationSeconds: global.bufferDuration,
      fps: global.bufferFps,
    });
  }, [global.bufferEnabled, global.bufferDuration, global.bufferFps]);

  // Main Render Loop
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    let raf = 0;
    const tick = () => {
      engine.setGlobal(global);
      engine.setLayers(layers);

      // Audio Data
      const audioEngine = getAudioEngine();
      if (audioEngine.isPlaying()) {
        engine.setAudioData(audioEngine.getAnalysis());
      } else {
        engine.setAudioData(null);
      }

      engine.step();

      // Rolling Buffer Capture
      if (canvasRef.current && global.bufferEnabled && !global.paused) {
        getFrameBuffer().captureFrame(canvasRef.current);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [global, layers]);

  // Track nonces to prevent auto-execution on init
  const lastResetNonceRef = useRef(resetNonce);
  const lastScreenshotNonceRef = useRef(screenshotNonce);

  // Handle Reset Command
  useEffect(() => {
    if (!isInitialized) return;
    if (resetNonce === 0 || resetNonce === lastResetNonceRef.current) return;
    lastResetNonceRef.current = resetNonce;
    
    engineRef.current?.resetAll();
  }, [resetNonce, isInitialized]);

  // Handle Screenshot Command
  useEffect(() => {
    if (!isInitialized || !engineRef.current) return;
    if (screenshotNonce === 0 || screenshotNonce === lastScreenshotNonceRef.current) return;
    lastScreenshotNonceRef.current = screenshotNonce;

    const url = engineRef.current.screenshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `particle-studio-${Date.now()}.png`;
    a.click();
  }, [screenshotNonce, isInitialized]);

  // Keyboard Shortcuts
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      if (key === " ") useStudioStore.getState().togglePause();
      if (key === "r") useStudioStore.getState().requestResetAll();
      if (key === "s") useStudioStore.getState().requestScreenshot();
      if (key === "h") {
        const { showWelcome } = useStudioStore.getState().global;
        useStudioStore.getState().setGlobal({ showWelcome: !showWelcome });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { engineRef, isInitialized };
}
