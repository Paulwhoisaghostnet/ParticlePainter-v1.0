import { useState, useMemo, useRef } from "react";
import { useStudioStore } from "../state/store";
import type { LayerConfig, ParticleType } from "../state/types";
import { SliderRow } from "./ui/SliderRow";
import { SwitchRow } from "./ui/SwitchRow";
import { LayerTabs } from "./LayerTabs";
import { AddLayerModal } from "./AddLayerModal";
import { MaskEditor } from "./MaskEditor";
import { MaskEraser } from "./MaskEraser";
import { FlowPathEditor } from "./FlowPathEditor";
import { AttractionPointsEditor } from "./AttractionPointsEditor";
import { exportLayerSettings, importLayerSettings } from "../engine/LayerExporter";
import { KeyboardKey } from "./ui/KeyboardKey";

const typeOptions: { value: ParticleType; label: string; desc: string }[] = [
  { value: "sand", label: "Sand", desc: "Heavy, resists wind, clings to surfaces" },
  { value: "dust", label: "Dust", desc: "Very light, floats, blown by wind" },
  { value: "sparks", label: "Sparks", desc: "Light, rises, erratic motion" },
  { value: "ink", label: "Ink", desc: "Medium weight, follows flow field" },
  { value: "crumbs", label: "Crumbs", desc: "Variable size, breaks on collision" },
  { value: "liquid", label: "Liquid", desc: "Droplets with cohesion, pools" }
];

const MIN_PARTICLES = 50;
const MAX_PARTICLES = 20000;

export function LeftPanel() {
  const layers = useStudioStore((s) => s.layers);
  const selectedLayerId = useStudioStore((s) => s.selectedLayerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const global = useStudioStore((s) => s.global);
  const setGlobal = useStudioStore((s) => s.setGlobal);
  const requestResetAll = useStudioStore((s) => s.requestResetAll);
  const importLayer = useStudioStore((s) => s.importLayer);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const layer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId),
    [layers, selectedLayerId]
  );

  // Handle layer settings import
  const handleImportLayerSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const settings = await importLayerSettings(file);
      importLayer(settings);
    } catch (err) {
      alert(`Failed to import layer settings: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    // Reset the input so the same file can be imported again
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  return (
    <div className="panel leftPanel">
      <div className="panelHeader">
        <div className="brand">
          <h1>Particle Studio</h1>
          <span>GPU • layers • masks</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <KeyboardKey label="Space" size="sm" />
          <KeyboardKey label="?" size="sm" />
        </div>
      </div>

      <div className="panelBody">
        {/* Playback controls */}
        <div className="section">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={() => setGlobal({ paused: !global.paused })}
            >
              {global.paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button className="btn btnDanger" onClick={requestResetAll}>
              Reset
            </button>
          </div>
        </div>

        <div className="hr" />

        {/* Layer tabs */}
        <LayerTabs onAddClick={() => setAddModalOpen(true)} />

        {/* Layer settings header & import/export (always visible) */}
        <div className="section">
          <h3 className="sectionTitle">Layer Settings</h3>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              className="btn btnSm"
              style={{ flex: 1, opacity: layer ? 1 : 0.5, cursor: layer ? "pointer" : "not-allowed" }}
              onClick={() => layer && exportLayerSettings(layer)}
            >
              📤 Export Settings
            </button>
            <button
              className="btn btnSm"
              style={{ flex: 1 }}
              onClick={() => importInputRef.current?.click()}
              title="Import layer settings from JSON"
            >
              📥 Import Settings
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportLayerSettings}
            />
          </div>

          {layer && (
            <>
              <div className="row">
                <span className="rowLabel">Name</span>
                <input
                  type="text"
                  className="input inputSm"
                  style={{ width: 140 }}
                  value={layer.name}
                  onChange={(e) => setLayer(layer.id, { name: e.target.value })}
                />
              </div>

              <SwitchRow
                label="Enabled"
                checked={layer.enabled}
                onCheckedChange={(b) => setLayer(layer.id, { enabled: b })}
              />

              <div className="row">
                <span className="rowLabel">Type</span>
                <select
                  className="select inputSm"
                  style={{ width: 140 }}
                  value={layer.type}
                  onChange={(e) =>
                    setLayer(layer.id, { type: e.target.value as ParticleType })
                  }
                >
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="small" style={{ marginTop: -4, marginBottom: 8, opacity: 0.7 }}>
                {typeOptions.find((t) => t.value === layer.type)?.desc}
              </div>

              <div className="section">
                <div className="row">
                  <span className="rowLabel">Particle count</span>
                  <input
                    type="number"
                    className="input inputSm"
                    style={{ width: 80 }}
                    min={MIN_PARTICLES}
                    max={MAX_PARTICLES}
                    value={layer.particleCount}
                    onChange={(e) => {
                      const val = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Number(e.target.value) || MIN_PARTICLES));
                      setLayer(layer.id, { particleCount: val });
                    }}
                  />
                </div>
                <input
                  type="range"
                  style={{ width: "100%", marginTop: 4 }}
                  min={MIN_PARTICLES}
                  max={MAX_PARTICLES}
                  step={50}
                  value={layer.particleCount}
                  onChange={(e) => setLayer(layer.id, { particleCount: Number(e.target.value) })}
                />
                <div className="small" style={{ marginTop: 4, opacity: 0.7 }}>
                  {layer.particleCount.toLocaleString()} particles
                </div>
              </div>
            </>
          )}
        </div>

        {layer && (
          <>
            <div className="hr" />

            {/* Spawn */}
            <div className="section">
              <h3 className="sectionTitle">Spawn</h3>
              <SliderRow
                label="Spawn density"
                value={layer.spawnRate}
                min={0}
                max={1}
                step={0.001}
                onChange={(v) => setLayer(layer.id, { spawnRate: v })}
              />
              <SliderRow
                label="Spawn velocity"
                value={layer.spawnSpeed}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { spawnSpeed: v })}
              />
            </div>

            <div className="hr" />

            {/* Lifecycle */}
            <div className="section">
              <h3 className="sectionTitle">Lifecycle</h3>
              <div className="small" style={{ marginBottom: 8 }}>
                Control how particles accumulate and decay over time.
              </div>
              <SliderRow
                label="Accumulation rate"
                value={layer.accumulationRate ?? 0.3}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { accumulationRate: v })}
              />
              <SliderRow
                label="Accumulation time"
                value={layer.accumulationTime ?? 2}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(v) => setLayer(layer.id, { accumulationTime: v })}
              />
              <SliderRow
                label="Decay rate"
                value={layer.decayRate ?? 0.3}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { decayRate: v })}
              />
            </div>

            <div className="hr" />

            {/* Forces */}
            <div className="section">
              <h3 className="sectionTitle">Forces</h3>
              <SliderRow
                label="Gravity"
                value={layer.gravity}
                min={-0.5}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { gravity: v })}
              />
              <SliderRow
                label="Mass Jitter"
                value={layer.massJitter ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { massJitter: v })}
              />
              <SliderRow
                label="Velocity scale"
                value={layer.speed}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { speed: v })}
              />
              <SliderRow
                label="Drag"
                value={layer.drag}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { drag: v })}
              />
              <SliderRow
                label="Jitter"
                value={layer.jitter}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { jitter: v })}
              />
              <SliderRow
                label="Curl"
                value={layer.curl}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { curl: v })}
              />
            </div>

            <div className="hr" />

            {/* Wind */}
            <div className="section">
              <h3 className="sectionTitle">Wind</h3>
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="rowLabel">Direction</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button 
                    className={`btn btnSm ${layer.windAngle === 0 ? "active" : ""}`}
                    onClick={() => setLayer(layer.id, { windAngle: 0 })}
                    title="East (→)"
                  >→</button>
                  <button 
                    className={`btn btnSm ${layer.windAngle === 90 ? "active" : ""}`}
                    onClick={() => setLayer(layer.id, { windAngle: 90 })}
                    title="North (↑)"
                  >↑</button>
                  <button 
                    className={`btn btnSm ${layer.windAngle === 180 ? "active" : ""}`}
                    onClick={() => setLayer(layer.id, { windAngle: 180 })}
                    title="West (←)"
                  >←</button>
                  <button 
                    className={`btn btnSm ${layer.windAngle === 270 ? "active" : ""}`}
                    onClick={() => setLayer(layer.id, { windAngle: 270 })}
                    title="South (↓)"
                  >↓</button>
                </div>
              </div>
              <SliderRow
                label={`Angle (${layer.windAngle ?? 0}°)`}
                value={layer.windAngle ?? 0}
                min={0}
                max={360}
                step={1}
                onChange={(v) => setLayer(layer.id, { windAngle: v })}
              />
              <SliderRow
                label="Strength"
                value={layer.windStrength ?? 0}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { windStrength: v })}
              />
            </div>

            <div className="hr" />

            {/* Attract - Legacy single point (keep for backwards compatibility) */}
            <div className="section">
              <h3 className="sectionTitle">Attract (Legacy)</h3>
              <div className="small" style={{ marginBottom: 8, opacity: 0.7 }}>
                Single point attraction. Use Attraction Points below for advanced multi-point control.
              </div>
              <SliderRow
                label="Strength"
                value={layer.attract}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { attract: v })}
                tooltip="Attraction strength to the single legacy point"
              />
              <SliderRow
                label="Falloff"
                value={layer.attractFalloff ?? 1}
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => setLayer(layer.id, { attractFalloff: v })}
                tooltip="0 = constant force, 2 = inverse square falloff"
              />
              <SliderRow
                label="Point X"
                value={layer.attractPoint.x}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setLayer(layer.id, { attractPoint: { ...layer.attractPoint, x: v } })
                }
              />
              <SliderRow
                label="Point Y"
                value={layer.attractPoint.y}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setLayer(layer.id, { attractPoint: { ...layer.attractPoint, y: v } })
                }
              />
            </div>

            <div className="hr" />

            {/* Multiple Attraction Points */}
            <AttractionPointsEditor />

            <div className="hr" />

            {/* Spawn Region */}
            <div className="section">
              <h3 className="sectionTitle">Spawn Region</h3>
              <div className="row">
                <span className="rowLabel">Region</span>
                <select
                  className="select inputSm"
                  style={{ width: 140 }}
                  value={layer.spawnConfig?.region ?? "random"}
                  onChange={(e) =>
                    setLayer(layer.id, {
                      spawnConfig: { ...layer.spawnConfig, region: e.target.value as any }
                    })
                  }
                >
                  <option value="random">Random</option>
                  <option value="topEdge">Top Edge</option>
                  <option value="bottomEdge">Bottom Edge</option>
                  <option value="leftEdge">Left Edge</option>
                  <option value="rightEdge">Right Edge</option>
                  <option value="offCanvasTop">Off-Canvas Top (Rain)</option>
                  <option value="offCanvasBottom">Off-Canvas Bottom (Rise)</option>
                  <option value="offCanvasLeft">Off-Canvas Left</option>
                  <option value="offCanvasRight">Off-Canvas Right</option>
                  <option value="center">Center</option>
                  <option value="centerBurst">Center Burst</option>
                  <option value="mask">Within Mask</option>
                  <option value="maskEdge">Mask Edge</option>
                </select>
              </div>
              {(layer.spawnConfig?.region?.includes("offCanvas") || layer.spawnConfig?.region?.includes("Edge")) && (
                <>
                  <SliderRow
                    label="Edge Offset"
                    value={layer.spawnConfig?.edgeOffset ?? 0.05}
                    min={0}
                    max={0.5}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { spawnConfig: { ...layer.spawnConfig, edgeOffset: v } })
                    }
                  />
                  <SliderRow
                    label="Spread"
                    value={layer.spawnConfig?.edgeSpread ?? 1.0}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { spawnConfig: { ...layer.spawnConfig, edgeSpread: v } })
                    }
                  />
                </>
              )}
              {layer.spawnConfig?.region === "centerBurst" && (
                <SliderRow
                  label="Burst Speed"
                  value={layer.spawnConfig?.burstSpeed ?? 0.3}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) =>
                    setLayer(layer.id, { spawnConfig: { ...layer.spawnConfig, burstSpeed: v } })
                  }
                />
              )}
            </div>

            <div className="hr" />

            {/* Movement Pattern */}
            <div className="section">
              <h3 className="sectionTitle">Movement Pattern</h3>
              <div className="row">
                <span className="rowLabel">Pattern</span>
                <select
                  className="select inputSm"
                  style={{ width: 140 }}
                  value={layer.movementConfig?.pattern ?? "still"}
                  onChange={(e) =>
                    setLayer(layer.id, {
                      movementConfig: { ...layer.movementConfig, pattern: e.target.value as any }
                    })
                  }
                >
                  <option value="still">Still (forces only)</option>
                  <option value="linear">Linear</option>
                  <option value="spiral">Spiral</option>
                  <option value="orbit">Orbit</option>
                  <option value="radialOut">Radial Out</option>
                  <option value="radialIn">Radial In</option>
                  <option value="wave">Wave</option>
                  <option value="figure8">Figure 8</option>
                  <option value="brownian">Brownian</option>
                  <option value="followCurl">Follow Curl</option>
                  <option value="vortex">Vortex</option>
                  <option value="evade">Evade</option>
                  <option value="clusters">Clusters</option>
                </select>
              </div>
              {layer.movementConfig?.pattern !== "still" && (
                <SliderRow
                  label="Speed"
                  value={layer.movementConfig?.speed ?? 0.1}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) =>
                    setLayer(layer.id, { movementConfig: { ...layer.movementConfig, speed: v } })
                  }
                />
              )}
              {layer.movementConfig?.pattern === "linear" && (
                <SliderRow
                  label="Direction"
                  value={layer.movementConfig?.direction ?? 270}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) =>
                    setLayer(layer.id, { movementConfig: { ...layer.movementConfig, direction: v } })
                  }
                />
              )}
              {(layer.movementConfig?.pattern === "spiral" || layer.movementConfig?.pattern === "orbit" || 
                layer.movementConfig?.pattern === "vortex" || layer.movementConfig?.pattern === "radialOut" ||
                layer.movementConfig?.pattern === "radialIn") && (
                <>
                  <SliderRow
                    label="Center X"
                    value={layer.movementConfig?.centerPoint?.x ?? 0.5}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { 
                        movementConfig: { 
                          ...layer.movementConfig, 
                          centerPoint: { ...layer.movementConfig?.centerPoint, x: v, y: layer.movementConfig?.centerPoint?.y ?? 0.5 } 
                        } 
                      })
                    }
                  />
                  <SliderRow
                    label="Center Y"
                    value={layer.movementConfig?.centerPoint?.y ?? 0.5}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { 
                        movementConfig: { 
                          ...layer.movementConfig, 
                          centerPoint: { x: layer.movementConfig?.centerPoint?.x ?? 0.5, y: v } 
                        } 
                      })
                    }
                  />
                </>
              )}
              {layer.movementConfig?.pattern === "spiral" && (
                <SliderRow
                  label="Tightness"
                  value={layer.movementConfig?.spiralTightness ?? 0.3}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={(v) =>
                    setLayer(layer.id, { movementConfig: { ...layer.movementConfig, spiralTightness: v } })
                  }
                />
              )}
              {layer.movementConfig?.pattern === "orbit" && (
                <SliderRow
                  label="Radius"
                  value={layer.movementConfig?.orbitRadius ?? 0.3}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  onChange={(v) =>
                    setLayer(layer.id, { movementConfig: { ...layer.movementConfig, orbitRadius: v } })
                  }
                />
              )}
              {layer.movementConfig?.pattern === "vortex" && (
                <>
                  <SliderRow
                    label="Rotation"
                    value={layer.movementConfig?.vortexStrength ?? 0.5}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, vortexStrength: v } })
                    }
                  />
                  <SliderRow
                    label="Inward Pull"
                    value={layer.movementConfig?.vortexInward ?? 0.2}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, vortexInward: v } })
                    }
                  />
                </>
              )}
              {layer.movementConfig?.pattern === "wave" && (
                <>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="rowLabel">Direction</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button 
                        className={`btn btnSm ${layer.movementConfig?.waveCardinalDirection === "east" ? "active" : ""}`}
                        onClick={() => setLayer(layer.id, { 
                          movementConfig: { ...layer.movementConfig, waveCardinalDirection: "east", waveDirection: 0 } 
                        })}
                        title="East (→)"
                      >→</button>
                      <button 
                        className={`btn btnSm ${layer.movementConfig?.waveCardinalDirection === "north" ? "active" : ""}`}
                        onClick={() => setLayer(layer.id, { 
                          movementConfig: { ...layer.movementConfig, waveCardinalDirection: "north", waveDirection: 90 } 
                        })}
                        title="North (↑)"
                      >↑</button>
                      <button 
                        className={`btn btnSm ${layer.movementConfig?.waveCardinalDirection === "west" ? "active" : ""}`}
                        onClick={() => setLayer(layer.id, { 
                          movementConfig: { ...layer.movementConfig, waveCardinalDirection: "west", waveDirection: 180 } 
                        })}
                        title="West (←)"
                      >←</button>
                      <button 
                        className={`btn btnSm ${layer.movementConfig?.waveCardinalDirection === "south" ? "active" : ""}`}
                        onClick={() => setLayer(layer.id, { 
                          movementConfig: { ...layer.movementConfig, waveCardinalDirection: "south", waveDirection: 270 } 
                        })}
                        title="South (↓)"
                      >↓</button>
                    </div>
                  </div>
                  <SliderRow
                    label={`Angle (${layer.movementConfig?.waveDirection ?? 0}°)`}
                    value={layer.movementConfig?.waveDirection ?? 0}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, waveDirection: v } })
                    }
                  />
                  <SliderRow
                    label="Amplitude"
                    value={layer.movementConfig?.waveAmplitude ?? 0.1}
                    min={0}
                    max={0.5}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, waveAmplitude: v } })
                    }
                  />
                  <SliderRow
                    label="Frequency"
                    value={layer.movementConfig?.waveFrequency ?? 2}
                    min={0.5}
                    max={5}
                    step={0.1}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, waveFrequency: v } })
                    }
                  />
                </>
              )}
              {layer.movementConfig?.pattern === "evade" && (
                <>
                  <SliderRow
                    label="Evade Strength"
                    value={layer.movementConfig?.evadeStrength ?? 0.3}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, evadeStrength: v } })
                    }
                  />
                  <SliderRow
                    label="Evade Radius"
                    value={layer.movementConfig?.evadeRadius ?? 0.1}
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, evadeRadius: v } })
                    }
                  />
                </>
              )}
              {layer.movementConfig?.pattern === "clusters" && (
                <>
                  <SliderRow
                    label="Cluster Strength"
                    value={layer.movementConfig?.clusterStrength ?? 0.5}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, clusterStrength: v } })
                    }
                  />
                  <SliderRow
                    label="Break Threshold"
                    value={layer.movementConfig?.clusterBreakThreshold ?? 0.7}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, clusterBreakThreshold: v } })
                    }
                  />
                  <div className="small" style={{ marginTop: 8, marginBottom: 4 }}>Cluster by:</div>
                  <SwitchRow
                    label="Size"
                    checked={layer.movementConfig?.clusterBySize ?? false}
                    onCheckedChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, clusterBySize: v } })
                    }
                  />
                  <SwitchRow
                    label="Color"
                    checked={layer.movementConfig?.clusterByColor ?? false}
                    onCheckedChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, clusterByColor: v } })
                    }
                  />
                  <SwitchRow
                    label="Brightness"
                    checked={layer.movementConfig?.clusterByBrightness ?? false}
                    onCheckedChange={(v) =>
                      setLayer(layer.id, { movementConfig: { ...layer.movementConfig, clusterByBrightness: v } })
                    }
                  />
                </>
              )}
            </div>

            <div className="hr" />

            {/* Boundary */}
            <div className="section">
              <h3 className="sectionTitle">Boundary</h3>
              <div className="row">
                <span className="rowLabel">Mode</span>
                <select
                  className="select inputSm"
                  style={{ width: 140 }}
                  value={layer.boundaryMode}
                  onChange={(e) =>
                    setLayer(layer.id, {
                      boundaryMode: e.target.value as LayerConfig["boundaryMode"]
                    })
                  }
                >
                  <option value="respawn">Respawn inside</option>
                  <option value="bounce">Bounce</option>
                  <option value="wrap">Wrap</option>
                  <option value="stick">Stick</option>
                  <option value="destroy">Destroy</option>
                  <option value="slowBounce">Slow Bounce</option>
                </select>
              </div>
              <SliderRow
                label="Bounce"
                value={layer.boundaryBounce}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLayer(layer.id, { boundaryBounce: v })}
              />
            </div>

            {/* Mask section (only for mask layers) */}
            {layer.kind === "mask" && (
              <>
                <div className="hr" />
                <div className="section">
                  <h3 className="sectionTitle">Mask</h3>
                  <div className="small" style={{ marginBottom: 8 }}>
                    Black = inside boundary, white = outside.
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      key={layer.id}
                      type="file"
                      accept="image/*"
                      style={{ flex: 1 }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = URL.createObjectURL(f);
                        setLayer(layer.id, { maskUrl: url });
                      }}
                    />
                    <button
                      className="btn btnSm"
                      onClick={() => setLayer(layer.id, { maskUrl: undefined })}
                    >
                      Clear
                    </button>
                  </div>

                  <SwitchRow
                    label="Show mask (red overlay)"
                    checked={layer.showMask ?? false}
                    onCheckedChange={(b) => setLayer(layer.id, { showMask: b })}
                  />

                  <div className="row">
                    <span className="rowLabel">Mask mode</span>
                    <select
                      className="select inputSm"
                      style={{ width: 140 }}
                      value={layer.maskMode ?? "collision"}
                      onChange={(e) =>
                        setLayer(layer.id, {
                          maskMode: e.target.value as LayerConfig["maskMode"]
                        })
                      }
                    >
                      <option value="ignore">Ignore (pass through)</option>
                      <option value="visibility">Visibility only</option>
                      <option value="collision">Collision (bounce)</option>
                      <option value="accumulate">Accumulate (stick)</option>
                    </select>
                  </div>

                  <SwitchRow
                    label="Invert mask"
                    checked={layer.maskInvert}
                    onCheckedChange={(b) => setLayer(layer.id, { maskInvert: b })}
                  />

                  <SliderRow
                    label="Threshold"
                    value={layer.maskThreshold}
                    min={0}
                    max={1}
                    step={0.001}
                    onChange={(v) => setLayer(layer.id, { maskThreshold: v })}
                  />

                  <SliderRow
                    label="Stickiness"
                    value={layer.maskStickiness ?? 0.3}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setLayer(layer.id, { maskStickiness: v })}
                  />

                  <SliderRow
                    label="Magnetism"
                    value={layer.maskMagnetism ?? 0}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(v) => setLayer(layer.id, { maskMagnetism: v })}
                  />

                  <SliderRow
                    label="Magnet radius"
                    value={layer.maskMagnetismRadius ?? 0.1}
                    min={0}
                    max={0.5}
                    step={0.01}
                    onChange={(v) => setLayer(layer.id, { maskMagnetismRadius: v })}
                  />
                </div>

                {/* Mask transform controls */}
                <MaskEditor />

                {/* Mask eraser */}
                <MaskEraser />
              </>
            )}

            {/* Flow path editor (for mask and directed flow layers) */}
            {(layer.kind === "directedFlow" || layer.kind === "mask") && (
              <>
                <div className="hr" />
                <FlowPathEditor />
              </>
            )}
          </>
        )}

        {!layer && (
          <div className="small" style={{ padding: 20, textAlign: "center" }}>
            No layers. Click "+ Add" to create one.
          </div>
        )}
      </div>

      <AddLayerModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </div>
  );
}
