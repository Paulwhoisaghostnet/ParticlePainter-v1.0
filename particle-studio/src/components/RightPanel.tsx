import { useMemo, useState, useCallback } from "react";
import { useStudioStore } from "../state/store";
import type { ParticleShape, ColorMode, ColorScheme, ResolutionPreset } from "../state/types";
import { SliderRow } from "./ui/SliderRow";
import { SwitchRow } from "./ui/SwitchRow";
import { AudioControls } from "./AudioControls";
import { AudioMappingEditor } from "./AudioMappingEditor";
import type { AudioAnalysisData } from "../engine/AudioEngine";

const shapeOptions: { value: ParticleShape; label: string }[] = [
  { value: "dot", label: "● Dot" },
  { value: "star", label: "★ Star" },
  { value: "dash", label: "— Dash" },
  { value: "tilde", label: "∼ Tilde" },
  { value: "square", label: "■ Square" },
  { value: "diamond", label: "◆ Diamond" },
  { value: "ring", label: "○ Ring" },
  { value: "cross", label: "✚ Cross" }
];

const colorModes: { value: ColorMode; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "gradient", label: "Gradient" },
  { value: "scheme", label: "Scheme" },
  { value: "range", label: "Range" }
];

const colorSchemes: { value: ColorScheme; label: string; colors: string[] }[] = [
  { value: "warm", label: "Warm", colors: ["#ff6b35", "#f7931e", "#ffd23f"] },
  { value: "cool", label: "Cool", colors: ["#3a86ff", "#8338ec", "#06d6a0"] },
  { value: "earth", label: "Earth", colors: ["#8d6346", "#bc8034", "#d4a373"] },
  { value: "neon", label: "Neon", colors: ["#ff00ff", "#00ffff", "#ffff00"] },
  { value: "mono", label: "Mono", colors: ["#ffffff", "#888888", "#333333"] }
];

const movementPatternOptions: { value: string; label: string }[] = [
  { value: "still", label: "Still" },
  { value: "linear", label: "Linear" },
  { value: "spiral", label: "Spiral" },
  { value: "orbit", label: "Orbit" },
  { value: "radialOut", label: "Radial Out" },
  { value: "radialIn", label: "Radial In" },
  { value: "wave", label: "Wave" },
  { value: "figure8", label: "Figure 8" },
  { value: "brownian", label: "Brownian" },
  { value: "followCurl", label: "Follow Curl" },
  { value: "vortex", label: "Vortex" }
];

const maskModeOptions: { value: string; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "visibility", label: "Visibility" },
  { value: "collision", label: "Collision" },
  { value: "accumulate", label: "Accumulate" }
];

// Collapsible section component for saving UI space
function CollapsibleSection({ 
  title, 
  defaultOpen = true, 
  children 
}: { 
  title: string; 
  defaultOpen?: boolean; 
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <h3 
        className="sectionTitle" 
        style={{ cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between" }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
        <span style={{ fontSize: "0.8em", opacity: 0.7 }}>{isOpen ? "▼" : "▶"}</span>
      </h3>
      {isOpen && children}
    </div>
  );
}

export function RightPanel() {
  const layers = useStudioStore((s) => s.layers);
  const selectedLayerId = useStudioStore((s) => s.selectedLayerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const global = useStudioStore((s) => s.global);
  const setGlobal = useStudioStore((s) => s.setGlobal);
  
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisData | null>(null);
  
  const handleAudioAnalysis = useCallback((data: AudioAnalysisData) => {
    setAudioAnalysis(data);
  }, []);

  const layer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId),
    [layers, selectedLayerId]
  );

  return (
    <div className="panel rightPanel">
      <div className="panelHeader">
        <h2 className="panelTitle">Render / Appearance</h2>
        <span className="badge">{global.monochrome ? "Mono" : "RGB"}</span>
      </div>

      <div className="panelBody">
        {/* Resolution settings - FIRST GLOBAL PARAMETER */}
        <div className="section">
          <h3 className="sectionTitle">Resolution</h3>
          <div className="row">
            <span className="rowLabel">Preset</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["512x512", "1080x1080", "2048x2048", "custom"] as ResolutionPreset[]).map((preset) => (
                <button
                  key={preset}
                  className={`btn btnSm ${global.resolutionPreset === preset ? "btnPrimary" : ""}`}
                  onClick={() => setGlobal({ resolutionPreset: preset })}
                >
                  {preset === "custom" ? "Custom" : preset}
                </button>
              ))}
            </div>
          </div>

          {global.resolutionPreset === "custom" && (
            <>
              <div className="row">
                <span className="rowLabel">Width</span>
                <input
                  type="number"
                  className="input inputSm"
                  style={{ width: 100 }}
                  value={global.customWidth}
                  min={256}
                  max={4096}
                  step={1}
                  onChange={(e) => setGlobal({ customWidth: parseInt(e.target.value, 10) || 256 })}
                />
              </div>
              <div className="row">
                <span className="rowLabel">Height</span>
                <input
                  type="number"
                  className="input inputSm"
                  style={{ width: 100 }}
                  value={global.customHeight}
                  min={256}
                  max={4096}
                  step={1}
                  onChange={(e) => setGlobal({ customHeight: parseInt(e.target.value, 10) || 256 })}
                />
              </div>
            </>
          )}

          <div className="small" style={{ marginTop: 8, opacity: 0.7 }}>
            Canvas/output resolution for all exports. Higher = more memory.
          </div>
        </div>

        <div className="hr" />

        {/* Global section */}
        <div className="section">
          <h3 className="sectionTitle">Global</h3>
          <SliderRow
            label="Time scale"
            value={global.timeScale}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => setGlobal({ timeScale: v })}
          />
          <SliderRow
            label="Exposure"
            value={global.exposure}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => setGlobal({ exposure: v })}
          />
          <SliderRow
            label="Threshold"
            value={global.threshold}
            min={0}
            max={1}
            step={0.001}
            onChange={(v) => setGlobal({ threshold: v })}
          />
          <SliderRow
            label="Threshold soft"
            value={global.thresholdSoft}
            min={0}
            max={0.35}
            step={0.001}
            onChange={(v) => setGlobal({ thresholdSoft: v })}
          />
          <SliderRow
            label="Threshold gain"
            value={global.thresholdGain}
            min={0}
            max={3}
            step={0.01}
            onChange={(v) => setGlobal({ thresholdGain: v })}
          />
          <SliderRow
            label="Clear rate"
            value={global.clearRate}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setGlobal({ clearRate: v })}
          />
        </div>

        <div className="hr" />

        {/* Visual effects */}
        <div className="section">
          <h3 className="sectionTitle">Visual</h3>
          <SwitchRow
            label="Monochrome"
            checked={global.monochrome}
            onCheckedChange={(b) => setGlobal({ monochrome: b })}
          />
          <SwitchRow
            label="Invert"
            checked={global.invert}
            onCheckedChange={(b) => setGlobal({ invert: b })}
          />
        </div>

        <div className="hr" />

        {/* Audio reactivity */}
        <AudioControls onAnalysisUpdate={handleAudioAnalysis} />

        {layer && (
          <>
            <div className="hr" />

            {/* Particle appearance */}
            <CollapsibleSection title="Particle" defaultOpen={true}>
              <div className="row">
                <span className="rowLabel">Shape</span>
                <select
                  className="select inputSm"
                  style={{ width: 140 }}
                  value={layer.shape ?? "dot"}
                  onChange={(e) => {
                    const newShape = e.target.value as ParticleShape;
                    
                    // TEMPORARY LOGGING: Track shape change flow
                    console.log("=== PARTICLE SHAPE CHANGE START ===");
                    console.log("Previous shape:", layer.shape);
                    console.log("New shape selected:", newShape);
                    console.log("Layer ID:", layer.id);
                    console.log("Layer name:", layer.name);
                    console.log("Layer type (particle type):", layer.type);
                    
                    // Simple shape update - shape parameter directly controls rendering
                    // glyphPalette is always synced to match the shape parameter
                    const update = { 
                      shape: newShape,
                      glyphPalette: [{ shape: newShape, weight: 1.0 }]
                    };
                    
                    console.log("Update payload:", JSON.stringify(update, null, 2));
                    console.log("Calling setLayer with update...");
                    
                    setLayer(layer.id, update);
                    
                    // Verify the update after a tick
                    setTimeout(() => {
                      const currentLayers = useStudioStore.getState().layers;
                      const updatedLayer = currentLayers.find(l => l.id === layer.id);
                      console.log("=== POST-UPDATE VERIFICATION ===");
                      console.log("Updated layer shape:", updatedLayer?.shape);
                      console.log("Updated glyphPalette:", JSON.stringify(updatedLayer?.glyphPalette));
                      console.log("=== PARTICLE SHAPE CHANGE END ===");
                    }, 0);
                  }}
                >
                  {shapeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <SliderRow
                label="Point size"
                value={layer.pointSize}
                min={0.5}
                max={64}
                step={0.5}
                onChange={(v) => setLayer(layer.id, { pointSize: v })}
              />
              <SliderRow
                label="Size min offset"
                value={layer.pointSizeMin ?? 0}
                min={-6}
                max={0}
                step={0.1}
                onChange={(v) => setLayer(layer.id, { pointSizeMin: v })}
              />
              <SliderRow
                label="Size max offset"
                value={layer.pointSizeMax ?? 0}
                min={0}
                max={6}
                step={0.1}
                onChange={(v) => setLayer(layer.id, { pointSizeMax: v })}
              />
              <SliderRow
                label="Size jitter"
                value={layer.sizeJitter ?? 0}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { sizeJitter: v })}
              />
              <SliderRow
                label="Trail stretch"
                value={layer.trailLength ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { trailLength: v })}
              />
              <SliderRow
                label="Brightness"
                value={layer.brightness}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { brightness: v })}
              />
              <SliderRow
                label="Brightness jitter"
                value={layer.brightnessJitter ?? 0}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { brightnessJitter: v })}
              />
              <SliderRow
                label="Dither"
                value={layer.dither}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { dither: v })}
              />
              <SliderRow
                label="Rotation jitter"
                value={layer.glyphRotationJitter ?? 0}
                min={0}
                max={360}
                step={1}
                onChange={(v) => setLayer(layer.id, { glyphRotationJitter: v })}
              />
              <SliderRow
                label="Scale jitter"
                value={layer.glyphScaleJitter ?? 0}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { glyphScaleJitter: v })}
              />
              <SliderRow
                label="Color jitter"
                value={layer.colorJitter ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { colorJitter: v })}
              />
            </CollapsibleSection>

            <div className="hr" />

            {/* Physics & Movement */}
            <CollapsibleSection title="Physics & Movement" defaultOpen={false}>
              <div className="row">
                <span className="rowLabel">Pattern</span>
                <select
                  value={layer.movementConfig?.pattern ?? "still"}
                  onChange={(e) =>
                    setLayer(layer.id, {
                       movementConfig: {
                         ...layer.movementConfig,
                         pattern: e.target.value as any
                       }
                    })
                  }
                >
                  {movementPatternOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <SliderRow
                label="Speed"
                value={layer.speed ?? 1.0}
                min={0}
                max={5}
                step={0.1}
                onChange={(v) => setLayer(layer.id, { speed: v })}
              />

              <SliderRow
                label="Gravity"
                value={layer.gravity ?? 0}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { gravity: v })}
              />
              
              <SliderRow
                label="Wind Angle"
                value={layer.windAngle ?? 0}
                min={0}
                max={360}
                step={1}
                onChange={(v) => setLayer(layer.id, { windAngle: v })}
              />

              <SliderRow
                label="Wind Strength"
                value={layer.windStrength ?? 0}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { windStrength: v })}
              />
              
              <SliderRow
                label="Drag"
                value={layer.drag ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { drag: v })}
              />
              
               <SliderRow
                label="Curl Noise"
                value={layer.curl ?? 0}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { curl: v })}
              />
            </CollapsibleSection>

            <div className="hr" />
            
            {/* Mask Interaction */}
            <CollapsibleSection title="Mask Interaction" defaultOpen={false}>
               <div className="row">
                <span className="rowLabel">Mode</span>
                <select
                  value={layer.maskMode ?? "ignore"}
                  onChange={(e) => setLayer(layer.id, { maskMode: e.target.value as any })}
                >
                  {maskModeOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="small" style={{ marginBottom: 8, opacity: 0.7 }}>
                {layer.maskMode === "ignore" && "Particles ignore the mask entirely."}
                {layer.maskMode === "visibility" && "Particles are hidden outside the mask."}
                {layer.maskMode === "collision" && "Particles bounce off mask boundaries."}
                {layer.maskMode === "accumulate" && "Particles stick to mask boundaries."}
              </div>
              
              {layer.maskMode === "collision" && (
                 <SliderRow
                    label="Bounce"
                    value={layer.boundaryBounce ?? 0.5}
                    min={0}
                    max={1.5}
                    step={0.01}
                    onChange={(v) => setLayer(layer.id, { boundaryBounce: v })}
                 />
              )}
            </CollapsibleSection>
            
            <div className="hr" />

            {/* Color section */}
            <CollapsibleSection title="Color" defaultOpen={false}>
              <div className="row">
                <span className="rowLabel">Mode</span>
                <div className="segmented" style={{ width: 200 }}>
                  {colorModes.map((m) => (
                    <button
                      key={m.value}
                      className={layer.colorMode === m.value ? "active" : ""}
                      onClick={() => setLayer(layer.id, { colorMode: m.value })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {layer.colorMode === "single" && (
                <div className="row">
                  <span className="rowLabel">Color</span>
                  <input
                    type="color"
                    className="colorInput"
                    value={layer.color}
                    onChange={(e) => setLayer(layer.id, { color: e.target.value })}
                  />
                </div>
              )}

              {layer.colorMode === "gradient" && (
                <>
                  <div className="row">
                    <span className="rowLabel">Primary</span>
                    <input
                      type="color"
                      className="colorInput"
                      value={layer.color}
                      onChange={(e) => setLayer(layer.id, { color: e.target.value })}
                    />
                  </div>
                  <div className="row">
                    <span className="rowLabel">Secondary</span>
                    <input
                      type="color"
                      className="colorInput"
                      value={layer.colorSecondary ?? "#888888"}
                      onChange={(e) =>
                        setLayer(layer.id, { colorSecondary: e.target.value })
                      }
                    />
                  </div>
                  <div className="row">
                    <span className="rowLabel">Tertiary</span>
                    <input
                      type="color"
                      className="colorInput"
                      value={layer.colorTertiary ?? "#444444"}
                      onChange={(e) =>
                        setLayer(layer.id, { colorTertiary: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {layer.colorMode === "scheme" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {colorSchemes.map((scheme) => (
                    <button
                      key={scheme.value}
                      className={`btn btnSm ${
                        layer.colorScheme === scheme.value ? "btnPrimary" : ""
                      }`}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => setLayer(layer.id, { colorScheme: scheme.value })}
                    >
                      <span
                        style={{
                          display: "flex",
                          gap: 2
                        }}
                      >
                        {scheme.colors.map((c, i) => (
                          <span
                            key={i}
                            style={{
                              width: 10,
                              height: 10,
                              background: c,
                              borderRadius: 2
                            }}
                          />
                        ))}
                      </span>
                      {scheme.label}
                    </button>
                  ))}
                </div>
              )}

              {layer.colorMode === "range" && (
                <>
                  <div className="small" style={{ marginBottom: 8 }}>
                    Random color within HSL range
                  </div>
                  <div className="row">
                    <span className="rowLabel">Start</span>
                    <input
                      type="color"
                      className="colorInput"
                      value={layer.colorRangeStart ?? "#ff0000"}
                      onChange={(e) =>
                        setLayer(layer.id, { colorRangeStart: e.target.value })
                      }
                    />
                  </div>
                  <div className="row">
                    <span className="rowLabel">End</span>
                    <input
                      type="color"
                      className="colorInput"
                      value={layer.colorRangeEnd ?? "#0000ff"}
                      onChange={(e) =>
                        setLayer(layer.id, { colorRangeEnd: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
            </CollapsibleSection>

            <div className="hr" />

            {/* ============ MATERIAL SYSTEM ============ */}
            <CollapsibleSection title="Material System" defaultOpen={false}>
              {/* Depth Field */}
              <SwitchRow
                label="Depth Field (2.5D)"
                checked={layer.depthEnabled}
                onCheckedChange={(v) => setLayer(layer.id, { depthEnabled: v })}
              />
              {layer.depthEnabled && (
                <>
                  <SliderRow
                    label="Depth blur"
                    value={layer.depthBlur}
                    min={0}
                    max={10}
                    step={0.5}
                    onChange={(v) => setLayer(layer.id, { depthBlur: v })}
                  />
                  <SliderRow
                    label="Depth curve"
                    value={layer.depthCurve}
                    min={0.1}
                    max={3}
                    step={0.1}
                    onChange={(v) => setLayer(layer.id, { depthCurve: v })}
                  />
                  <SliderRow
                    label="Depth scale"
                    value={layer.depthScale}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setLayer(layer.id, { depthScale: v })}
                  />
                  <SwitchRow
                    label="Invert depth"
                    checked={layer.depthInvert}
                    onCheckedChange={(v) => setLayer(layer.id, { depthInvert: v })}
                  />
                </>
              )}
            </CollapsibleSection>

            <div className="hr" />

            {/* Ground Plane */}
            <CollapsibleSection title="Ground Plane" defaultOpen={false}>
              <SwitchRow
                label="Enable ground plane"
                checked={layer.groundPlaneEnabled}
                onCheckedChange={(v) => setLayer(layer.id, { groundPlaneEnabled: v })}
              />
              {layer.groundPlaneEnabled && (
                <>
                  <SliderRow
                    label="Tilt angle"
                    value={layer.groundPlaneTilt}
                    min={0}
                    max={90}
                    step={1}
                    onChange={(v) => setLayer(layer.id, { groundPlaneTilt: v })}
                  />
                  <SliderRow
                    label="Y position"
                    value={layer.groundPlaneY}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setLayer(layer.id, { groundPlaneY: v })}
                  />
                </>
              )}
            </CollapsibleSection>

            <div className="hr" />

            {/* Surface Fields */}
            <CollapsibleSection title="Surface Fields" defaultOpen={false}>
              <SwitchRow
                label="Enable surface fields"
                checked={layer.surfaceFieldsEnabled}
                onCheckedChange={(v) => setLayer(layer.id, { surfaceFieldsEnabled: v })}
              />
              {layer.surfaceFieldsEnabled && (
                <>
                  <SwitchRow
                    label="Smear field"
                    checked={layer.smearFieldEnabled}
                    onCheckedChange={(v) => setLayer(layer.id, { smearFieldEnabled: v })}
                  />
                  {layer.smearFieldEnabled && (
                    <SliderRow
                      label="Smear decay"
                      value={layer.smearDecayRate}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setLayer(layer.id, { smearDecayRate: v })}
                    />
                  )}
                  <SwitchRow
                    label="Ripple field"
                    checked={layer.rippleFieldEnabled}
                    onCheckedChange={(v) => setLayer(layer.id, { rippleFieldEnabled: v })}
                  />
                  {layer.rippleFieldEnabled && (
                    <>
                      <SliderRow
                        label="Ripple damping"
                        value={layer.rippleDamping}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => setLayer(layer.id, { rippleDamping: v })}
                      />
                      <SliderRow
                        label="Ripple speed"
                        value={layer.rippleSpeed}
                        min={0.1}
                        max={3}
                        step={0.1}
                        onChange={(v) => setLayer(layer.id, { rippleSpeed: v })}
                      />
                    </>
                  )}
                  <SwitchRow
                    label="Dent field"
                    checked={layer.dentFieldEnabled}
                    onCheckedChange={(v) => setLayer(layer.id, { dentFieldEnabled: v })}
                  />
                  {layer.dentFieldEnabled && (
                    <SliderRow
                      label="Dent recovery"
                      value={layer.dentRecoveryRate}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setLayer(layer.id, { dentRecoveryRate: v })}
                    />
                  )}
                </>
              )}
            </CollapsibleSection>

            <div className="hr" />

            {/* Material Mode */}
            <CollapsibleSection title="Material Mode" defaultOpen={false}>
              <div className="row">
                <span className="rowLabel">Mode</span>
                <div className="segmented" style={{ width: 200 }}>
                  {[
                    { value: "binary" as const, label: "Binary" },
                    { value: "palette" as const, label: "Palette" },
                    { value: "rgbParams" as const, label: "RGB" }
                  ].map((m) => (
                    <button
                      key={m.value}
                      className={layer.materialMode === m.value ? "active" : ""}
                      onClick={() => setLayer(layer.id, { materialMode: m.value })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                {layer.materialMode === "binary" && "Standard collision - mask controls boundaries"}
                {layer.materialMode === "palette" && "Color regions map to material presets"}
                {layer.materialMode === "rgbParams" && "RGB channels control stick/ripple/pass-through"}
              </div>
            </CollapsibleSection>

            <div className="hr" />

            {/* Audio mapping for this layer */}
            <AudioMappingEditor />
          </>
        )}

        <div className="hr" />

        <div className="small">
          Tips: Use a high-contrast mask (black = inside). For persistent trails, use low clear rate (0.1-0.3 preserves most frames). For sharp visuals, keep clear rate high (0.8-1.0) and raise curl + dither.
        </div>
      </div>
    </div>
  );
}
