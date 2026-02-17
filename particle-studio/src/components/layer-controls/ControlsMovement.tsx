import React from 'react';
import { useStudioStore } from '../../state/store';
import { SliderRow } from '../ui/SliderRow';
import { SwitchRow } from '../ui/SwitchRow';

interface ControlsProps {
  layerId: string;
}

export const ControlsMovement: React.FC<ControlsProps> = ({ layerId }) => {
  const layers = useStudioStore((s) => s.layers);
  const layer = layers.find((l) => l.id === layerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const updateLayer = (id: string, patch: any) => setLayer(id, patch);

  if (!layer) return null;

  // Type guard helpers
  const isPattern = (patterns: string[]) => patterns.includes(layer.movementConfig.pattern);

  return (
    <div className="controls-group">
      {/* MOVEMENT PATTERN */}
      <div className="section">
        <div className="sectionTitle">Pattern & Flow</div>
        
        <div className="row">
          <span className="rowLabel">Pattern</span>
          <select 
            className="select"
            value={layer.movementConfig.pattern}
            onChange={(e) => updateLayer(layerId, { 
              movementConfig: { ...layer.movementConfig, pattern: e.target.value as any } 
            })}
          >
            <option value="still">Still (Physics Only)</option>
            <option value="linear">Linear Direction</option>
            <option value="orbit">Orbit Center</option>
            <option value="spiral">Spiral</option>
            <option value="wave">Wave</option>
            <option value="vortex">Vortex</option>
            <option value="brownian">Brownian (Random)</option>
            <option value="figure8">Figure 8</option>
            <option value="followCurl">Follow Curl Noise</option>
            <option value="evade">Evade</option>
            <option value="clusters">Clusters</option>
          </select>
        </div>

        {/* Direction - Relevant for Linear, Wave, Spiral, RadialOut, Vortex */}
        {isPattern(['linear', 'wave', 'spiral', 'radialOut', 'vortex']) && (
          <SliderRow
            label="Direction (Deg)"
            value={layer.movementConfig.direction}
            min={0} max={360} step={1}
            onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, direction: v } })}
            tooltip="Direction of movement"
          />
        )}

        <SliderRow
          label="Base Speed"
          value={layer.movementConfig.speed}
          min={0} max={5} step={0.01}
          onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, speed: v } })}
        />

        {/* Orbit/Spiral Settings */}
        {isPattern(['orbit', 'spiral', 'vortex']) && (
          <>
             <SliderRow
              label={layer.movementConfig.pattern === 'orbit' ? "Orbit Radius" : "Spiral Tightness"}
              value={layer.movementConfig.pattern === 'orbit' ? layer.movementConfig.orbitRadius : layer.movementConfig.spiralTightness}
              min={0} max={2} step={0.01}
              onChange={(v) => updateLayer(layerId, { 
                  movementConfig: { 
                      ...layer.movementConfig, 
                      [layer.movementConfig.pattern === 'orbit' ? 'orbitRadius' : 'spiralTightness']: v 
                  } 
              })}
            />
            <SliderRow
               label="Twist / Inward"
               value={layer.movementConfig.vortexInward}
               min={-1} max={1} step={0.01}
               onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, vortexInward: v } })}
            />
          </>
        )}

        {/* Vortex Specific */}
        {isPattern(['vortex']) && (
          <SliderRow
            label="Vortex Strength"
            value={layer.movementConfig.vortexStrength}
            min={0} max={1} step={0.01}
            onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, vortexStrength: v } })}
          />
        )}

        {/* Wave Settings */}
        {isPattern(['wave']) && (
          <>
            <SliderRow
              label="Amplitude"
              value={layer.movementConfig.waveAmplitude}
              min={0} max={1} step={0.01}
              onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, waveAmplitude: v } })}
            />
            <SliderRow
              label="Frequency"
              value={layer.movementConfig.waveFrequency}
              min={0} max={10} step={0.1}
              onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, waveFrequency: v } })}
            />
          </>
        )}

        {/* Cluster Settings */}
        {isPattern(['clusters']) && (
          <SliderRow
            label="Cluster Strength"
            value={layer.movementConfig.clusterStrength}
            min={0} max={1} step={0.01}
            onChange={(v) => updateLayer(layerId, { movementConfig: { ...layer.movementConfig, clusterStrength: v } })}
          />
        )}
        
        {/* General Noise - Always Useful */}
        <div className="sectionHeader" style={{marginTop: 12}}>Micro-Movement</div>
        
        <SliderRow
          label="Brownian Jitter"
          value={layer.movementConfig.pattern === 'brownian' ? (layer.movementConfig.speed * 2) : 0} 
          min={0} max={1} step={0.01}
          onChange={(v) => {
             // If turning on, set pattern to brownian. If off, set to still.
             if (v > 0) updateLayer(layerId, { movementConfig: { ...layer.movementConfig, pattern: 'brownian', speed: v } });
             else updateLayer(layerId, { movementConfig: { ...layer.movementConfig, pattern: 'still', speed: 0 } });
          }}
          tooltip="Random motion"
        />

        <SliderRow
          label="Curl Noise (Flow)"
          value={layer.curl}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { curl: v })}
        />
        
        <SliderRow
          label="General Speed"
          value={layer.speed}
          min={0} max={2.0} step={0.01}
          onChange={(v) => updateLayer(layerId, { speed: v })}
        />
      </div>

      {/* ATTRACTION POINTS */}
      <div className="section">
        <div className="sectionTitle">Attraction Points</div>
        <div className="small" style={{ marginBottom: 8, opacity: 0.7 }}>
          Use mouse to add points if tool is active.
        </div>
        
        {layer.attractionPoints.length === 0 && (
           <div className="small" style={{ fontStyle: 'italic' }}>No attraction points added.</div>
        )}

        {layer.attractionPoints.map((pt, idx) => (
          <div key={pt.id} className="card" style={{ marginBottom: 8 }}>
            <div className="cardTitle">
              <span>Point {idx + 1}</span>
              <button 
                className="btn btnSm btnDanger"
                onClick={() => {
                  const newPts = layer.attractionPoints.filter(p => p.id !== pt.id);
                  updateLayer(layerId, { attractionPoints: newPts });
                }}
              >
                Remove
              </button>
            </div>
            <SliderRow
              label="Strength"
              value={pt.strength}
              min={-1} max={1} step={0.01}
              onChange={(v) => {
                 const newPts = [...layer.attractionPoints];
                 newPts[idx] = { ...pt, strength: v };
                 updateLayer(layerId, { attractionPoints: newPts });
              }}
            />
            <SliderRow
              label="Falloff"
              value={pt.falloff}
              min={0} max={2} step={0.1}
              onChange={(v) => {
                 const newPts = [...layer.attractionPoints];
                 newPts[idx] = { ...pt, falloff: v };
                 updateLayer(layerId, { attractionPoints: newPts });
              }}
            />
          </div>
        ))}
        
        <button 
          className="btn btnSm btnPrimary" 
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => {
             const newPt = {
               id: Math.random().toString(36).substr(2, 9),
               enabled: true,
               position: { x: 0.5, y: 0.5 },
               strength: 0.5,
               falloff: 0.5,
               type: 'direct' as const,
               effect: 'none' as const
             };
             // @ts-ignore
             updateLayer(layerId, { attractionPoints: [...layer.attractionPoints, newPt] });
          }}
        >
          + Add Point
        </button>
      </div>
    </div>
  );
};
