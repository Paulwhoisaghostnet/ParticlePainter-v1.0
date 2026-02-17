import { useRef, useState } from "react";
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

  const [showDrawer, setShowDrawer] = useState(false);

  // Close drawer when clicking outside (on canvas)
  const handleCanvasClick = () => {
    if (showDrawer) setShowDrawer(false);
  };

  return (
    <div className="app">
      {/* Welcome popup on first load */}
      <WelcomePopup />
      <HotkeyOverlay />
      
      {/* Mobile Header / Toggle */}
      <div className="mobileHeader">
        <div className="brand">
          <h1>Particle Painter</h1>
        </div>
        <button 
          className="btn btnIcon" 
          onClick={() => setShowDrawer(!showDrawer)}
        >
          {showDrawer ? "✕" : "☰"}
        </button>
      </div>
      
      {/* Center - Canvas Area */}
      <div className="canvasArea" onClick={handleCanvasClick}>
        <div className="canvasWrap">
          <canvas ref={canvasRef} />
        </div>
        {/* Export Bar - Below Canvas */}
        <ExportBar />
      </div>

      {/* Right - Unified Studio Panel */}
      <StudioPanel 
        className={showDrawer ? "open" : ""} 
        onClose={() => setShowDrawer(false)}
      />
    </div>
  );
}