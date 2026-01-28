import { useMemo } from "react";
import type { LayerConfig, ParticleType, ParticleShape } from "../state/types";
import { useStudioStore } from "../state/store";
import { SliderRow } from "./ui/SliderRow";
import { SwitchRow } from "./ui/SwitchRow";

const typeOptions: { value: ParticleType; label: string; desc: string }[] = [
  { value: "sand", label: "Sand", desc: "Heavy, resists wind, clings to surfaces" },
  { value: "dust", label: "Dust", desc: "Very light, floats, blown by wind" },
  { value: "sparks", label: "Sparks", desc: "Light, rises, erratic motion" },
  { value: "ink", label: "Ink", desc: "Medium weight, follows flow field" }
];

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

const MIN_PARTICLES = 50;
const MAX_PARTICLES = 20000;

export function LayerControls({ selected }: { selected?: LayerConfig }) {
  const layers = useStudioStore((s) => s.layers);
  const setLayer = useStudioStore((s) => s.setLayer);
  const selectLayer = useStudioStore((s) => s.selectLayer);
  const removeLayer = useStudioStore((s) => s.removeLayer);

  const selectedId = selected?.id ?? "";
  const layer = useMemo(() => layers.find((l) => l.id === selectedId), [layers, selectedId]);
  if (!layer) return null;

  return (
    <>
      <div className="card">
        <div className="cardTitle">
          <span>Layers</span>
          <span className="value">{layers.length}</span>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <select className="select" style={{ width: "100%" }} value={selectedId} onChange={(e) => selectLayer(e.target.value)}>
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </select>
          </div>
          <button className="btn btnDanger" onClick={() => removeLayer(layer.id)}>
            Remove
          </button>
        </div>

        <div className="row">
          <div className="small">Name</div>
          <input
            type="text"
            className="input"
            value={layer.name}
            onChange={(e) => setLayer(layer.id, { name: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>

        <SwitchRow
          label="Enabled"
          checked={layer.enabled}
          onCheckedChange={(b) => setLayer(layer.id, { enabled: b })}
        />

        <div className="row">
          <div className="small">Particle type</div>
          <div style={{ minWidth: 230 }}>
            <select
              className="select"
              value={layer.type}
              onChange={(e) => setLayer(layer.id, { type: e.target.value as ParticleType })}
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="small" style={{ marginTop: -4, marginBottom: 8, opacity: 0.7 }}>
          {typeOptions.find(t => t.value === layer.type)?.desc}
        </div>

        <div className="row">
          <div className="small">Particle count</div>
          <div style={{ minWidth: 230, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              style={{ flex: 1 }}
              min={MIN_PARTICLES}
              max={MAX_PARTICLES}
              step={50}
              value={layer.particleCount}
              onChange={(e) => setLayer(layer.id, { particleCount: Number(e.target.value) })}
            />
            <input
              type="number"
              className="input"
              style={{ width: 70 }}
              min={MIN_PARTICLES}
              max={MAX_PARTICLES}
              value={layer.particleCount}
              onChange={(e) => {
                const val = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Number(e.target.value) || MIN_PARTICLES));
                setLayer(layer.id, { particleCount: val });
              }}
            />
          </div>
        </div>

        <div className="hr" />

        <div className="cardTitle">
          <span>Mask (BW)</span>
          <span className="value">{layer.maskUrl ? "Loaded" : "None"}</span>
        </div>
        <div className="small" style={{ marginBottom: 8 }}>
          Black = inside boundary, white = outside.
        </div>

        <div className="row">
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                setLayer(layer.id, { maskUrl: url });
              }}
            />
          </div>
          <button className="btn" onClick={() => setLayer(layer.id, { maskUrl: undefined })}>
            Clear
          </button>
        </div>

        <SwitchRow
          label="Invert mask"
          checked={layer.maskInvert}
          onCheckedChange={(b) => setLayer(layer.id, { maskInvert: b })}
        />

        <SliderRow
          label="Mask threshold"
          value={layer.maskThreshold}
          min={0}
          max={1}
          step={0.001}
          onChange={(v) => setLayer(layer.id, { maskThreshold: v })}
        />

        <div className="hr" />

        <div className="cardTitle">
          <span>Physics</span>
          <span className="value">per layer</span>
        </div>

        <SliderRow
          label="Gravity"
          value={layer.gravity}
          min={-0.5}
          max={1}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { gravity: v })}
        />
        <SliderRow
          label="Wind angle"
          value={layer.windAngle ?? 0}
          min={0}
          max={360}
          step={1}
          onChange={(v) => setLayer(layer.id, { windAngle: v })}
        />
        <SliderRow
          label="Wind strength"
          value={layer.windStrength ?? 0}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { windStrength: v })}
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
          label="Spawn velocity"
          value={layer.spawnSpeed}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { spawnSpeed: v })}
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
        <SliderRow
          label="Attract"
          value={layer.attract}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { attract: v })}
        />
        <SliderRow
          label="Attract falloff"
          value={layer.attractFalloff ?? 1}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => setLayer(layer.id, { attractFalloff: v })}
        />
        <SliderRow
          label="Attract X"
          value={layer.attractPoint.x}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { attractPoint: { ...layer.attractPoint, x: v } })}
        />
        <SliderRow
          label="Attract Y"
          value={layer.attractPoint.y}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { attractPoint: { ...layer.attractPoint, y: v } })}
        />

        <div className="row">
          <div className="small">Boundary mode</div>
          <div style={{ minWidth: 230 }}>
            <select
              className="select"
              value={layer.boundaryMode}
              onChange={(e) => setLayer(layer.id, { boundaryMode: e.target.value as LayerConfig["boundaryMode"] })}
            >
              <option value="respawn">Respawn inside</option>
              <option value="bounce">Bounce</option>
              <option value="wrap">Wrap</option>
            </select>
          </div>
        </div>
        <SliderRow
          label="Boundary bounce"
          value={layer.boundaryBounce}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { boundaryBounce: v })}
        />

        <SliderRow
          label="Spawn density"
          value={layer.spawnRate}
          min={0}
          max={1}
          step={0.001}
          onChange={(v) => setLayer(layer.id, { spawnRate: v })}
        />

        <div className="hr" />

        <div className="cardTitle">
          <span>Appearance</span>
          <span className="value">{layer.shape ?? "dot"}</span>
        </div>

        <div className="row">
          <div className="small">Shape</div>
          <div style={{ minWidth: 230 }}>
            <select
              className="select"
              value={layer.shape ?? "dot"}
              onChange={(e) => {
                const newShape = e.target.value as ParticleShape;
                // Only update glyphPalette if it's a single-entry palette (default case)
                // This preserves multi-shape palettes while fixing the default behavior
                if (!layer.glyphPalette || layer.glyphPalette.length <= 1) {
                  setLayer(layer.id, { 
                    shape: newShape,
                    glyphPalette: [{ shape: newShape, weight: 1.0 }]
                  });
                } else {
                  // Multi-shape palette exists, only update the shape parameter
                  setLayer(layer.id, { shape: newShape });
                }
              }}
            >
              {shapeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SliderRow
          label="Point size"
          value={layer.pointSize}
          min={0.5}
          max={8}
          step={0.1}
          onChange={(v) => setLayer(layer.id, { pointSize: v })}
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
          label="Dither"
          value={layer.dither}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { dither: v })}
        />

        <div className="row">
          <div className="small">Tint</div>
          <input
            type="color"
            value={layer.color}
            onChange={(e) => setLayer(layer.id, { color: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}
