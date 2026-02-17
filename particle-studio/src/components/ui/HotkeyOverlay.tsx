import { useEffect } from "react";
import { useStudioStore } from "../../state/store";
import { KeyboardKey } from "./KeyboardKey";

export function HotkeyOverlay() {
  const global = useStudioStore((s) => s.global);
  const toggleHotkeys = useStudioStore((s) => s.toggleHotkeys);
  
  // Listen for global '?' key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on '?' (Shift+/) or '/'
      if (e.key === "?" || e.key === "/") {
        // Prevent default only if we're not in an input
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          toggleHotkeys();
        }
      }
      
      // Close on Escape if open
      if (e.key === "Escape" && global.showHotkeys) {
        toggleHotkeys();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [global.showHotkeys, toggleHotkeys]);

  if (!global.showHotkeys) return null;

  return (
    <div 
      className="modalOverlay" 
      onClick={toggleHotkeys}
      style={{ zIndex: 2000 }} // Ensure it's on top of everything
    >
      <div 
        className="modal" 
        style={{ width: 600, maxWidth: "90vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panelHeader">
          <div className="brand">
            <h1>Keyboard Shortcuts</h1>
          </div>
          <button 
            className="closeBtn" 
            onClick={toggleHotkeys}
            style={{ 
              border: "none", 
              background: "none", 
              fontSize: 16, 
              color: "var(--muted)",
              cursor: "pointer" 
            }}
          >
            ✕
          </button>
        </div>

        <div className="panelBody" style={{ padding: "20px 24px" }}>
          
          <div className="section">
            <h3 className="sectionTitle">General</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              <div className="row" style={{ margin: 0 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <KeyboardKey label="?" />
                </div>
                <span className="value">Toggle this overlay</span>
              </div>
              
              <div className="row" style={{ margin: 0 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <KeyboardKey label="Space" />
                </div>
                <span className="value">Pause / Resume</span>
              </div>

              <div className="row" style={{ margin: 0 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <KeyboardKey label="R" />
                </div>
                <span className="value">Reset Simulation</span>
              </div>

              <div className="row" style={{ margin: 0 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <KeyboardKey label="H" />
                </div>
                <span className="value">Show Welcome Popup</span>
              </div>
            </div>
          </div>

          <div className="hr" />

          <div className="section">
            <h3 className="sectionTitle">Layers</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              <div className="row" style={{ margin: 0 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <KeyboardKey label="Del" />
                  <span className="value" style={{ fontSize: 10, opacity: 0.5, alignSelf: "center" }}>or</span>
                  <KeyboardKey label="Backspace" />
                </div>
                <span className="value">Delete selected layer</span>
              </div>
            </div>
          </div>

        </div>
        
        <div className="panelHeader" style={{ borderTop: "1px solid var(--stroke)", borderBottom: "none", justifyContent: "center", padding: "12px" }}>
          <span className="small" style={{ opacity: 0.5 }}>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
