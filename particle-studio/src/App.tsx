import { useRef } from "react";
import { StudioPanel } from "./components/StudioPanel";
import { ExportBar } from "./components/ExportBar";
import { WelcomePopup } from "./components/WelcomePopup";
import { HotkeyOverlay } from "./components/ui/HotkeyOverlay";
import { useParticleEngine } from "./hooks/useParticleEngine";
import { useRecorder } from "./hooks/useRecorder";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Initialize Engine
  const { engineRef, isInitialized } = useParticleEngine(canvasRef);

  // Initialize Recorder
  useRecorder(canvasRef, engineRef, isInitialized);

  return (
    <div className="app">
      {/* Welcome popup on first load */}
      <WelcomePopup />
      <HotkeyOverlay />
      
      {/* Center - Canvas Area */}
      <div className="canvasArea">
        <div className="canvasWrap">
          <canvas ref={canvasRef} />
        </div>
        {/* Export Bar - Below Canvas */}
        <ExportBar />
      </div>

      {/* Right - Unified Studio Panel */}
      <StudioPanel />
    </div>
  );
}