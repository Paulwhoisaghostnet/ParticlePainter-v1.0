import { useStudioStore } from "../state/store";

export function WelcomePopup() {
  const global = useStudioStore((s) => s.global);
  const setGlobal = useStudioStore((s) => s.setGlobal);

  if (!global.showWelcome) return null;

  const handleClose = () => {
    setGlobal({ showWelcome: false });
  };

  const handleOpenManual = () => {
    // Open the manual in a new tab pointing to the GitHub blob
    window.open("https://github.com/Paulwhoisaghostnet/ParticlePainter-v1.0/blob/main/particle-studio/USER_MANUAL.md", "_blank");
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="panelHeader">
          <div className="brand">
            <h1>Particle Studio</h1>
            <span>Welcome</span>
          </div>
          <button className="closeBtn" onClick={handleClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--muted)' }}>✕</button>
        </div>

        <div className="panelBody">
          <div className="section">
            <h3 className="sectionTitle">Getting Started</h3>
            <ul style={{ paddingLeft: 20, margin: "0 0 16px 0", fontSize: "13px", color: "var(--text)" }}>
              <li style={{ marginBottom: 8 }}>
                <strong>Add a Layer</strong> - Click the "+ Add" button in the left panel to create your first particle layer
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Choose Particle Type</strong> - Select from Sand, Dust, Sparks, Ink, Crumbs, or Liquid
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Adjust Parameters</strong> - Use the left panel for physics and forces, right panel for appearance
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Add a Mask</strong> - Create a "Mask" layer and upload an image to define boundaries
              </li>
            </ul>
          </div>

          <div className="section">
            <h3 className="sectionTitle">Exports</h3>
            <ul style={{ paddingLeft: 20, margin: "0 0 16px 0", fontSize: "13px", color: "var(--text)" }}>
              <li style={{ marginBottom: 6 }}>
                <strong>Screenshot</strong> - Save a single frame as PNG
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>GIF</strong> - Create short animated loops
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Video (WebM/MP4)</strong> - Record longer sessions with audio
              </li>
            </ul>
          </div>

          <div className="section">
            <h3 className="sectionTitle">Tips</h3>
            <ul style={{ paddingLeft: 20, margin: "0 0 16px 0", fontSize: "13px", color: "var(--text)" }}>
              <li style={{ marginBottom: 6 }}>
                Use <strong>Movement Patterns</strong> like Wave, Spiral, Vortex, Evade, or Clusters for dynamic effects
              </li>
              <li style={{ marginBottom: 6 }}>
                Enable <strong>Show Mask</strong> to visualize mask boundaries in red
              </li>
              <li style={{ marginBottom: 6 }}>
                Add multiple <strong>Attraction Points</strong> for complex particle behaviors
              </li>
              <li style={{ marginBottom: 6 }}>
                Adjust <strong>Jitter</strong> parameters (size, color, brightness, scale) for natural variation
              </li>
            </ul>
          </div>

          <div className="section">
            <h3 className="sectionTitle">Keyboard Shortcuts</h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", alignItems: "center" }}>
              <span className="kbd">Space</span>
              <span className="value">Pause / Resume</span>
              
              <span className="kbd">R</span>
              <span className="value">Reset Simulation</span>
              
              <span className="kbd">H</span>
              <span className="value">Show this Help</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <button
              className="btn"
              onClick={handleOpenManual}
            >
              📖 Read Manual
            </button>
            <button className="btn btnPrimary" onClick={handleClose}>
              🚀 Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
