import React from 'react';
import { useStudioStore } from '../../state/store';
import { SliderRow } from '../ui/SliderRow';
import { SwitchRow } from '../ui/SwitchRow';
import { SPAWN_REGION_MAP } from '../../engine/config';

interface ControlsProps {
  layerId: string;
}

export const ControlsSimulation: React.FC<ControlsProps> = ({ layerId }) => {
  const layers = useStudioStore((s) => s.layers);
  const layer = layers.find((l) => l.id === layerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  
  // Helper to standardise update
  const updateLayer = (id: string, patch: any) => setLayer(id, patch);

  if (!layer) return null;

  return (
    <div className="controls-group">
      {/* SPAWN SETTINGS */}
      <div className="section">
        <div className="sectionTitle">Spawn & Lifecycle</div>
        
        <SliderRow
          label="Spawn Rate"
          value={layer.spawnRate}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { spawnRate: v })}
        />
        
        <div className="row">
          <span className="rowLabel">Region</span>
          <select 
            className="select"
            value={layer.spawnConfig.region}
            onChange={(e) => updateLayer(layerId, { 
              spawnConfig: { ...layer.spawnConfig, region: e.target.value as any } 
            })}
          >
            <option value="random">Random Loop</option>
            <option value="center">Center</option>
            <option value="centerBurst">Center Burst</option>
            <option value="topEdge">Top Edge</option>
            <option value="bottomEdge">Bottom Edge</option>
            <option value="leftEdge">Left Edge</option>
            <option value="rightEdge">Right Edge</option>
            <option value="mask">Mask Area</option>
            <option value="maskEdge">Mask Edge</option>
          </select>
        </div>

        {/* Conditional Burst Speed */}
        {layer.spawnConfig.region === 'centerBurst' && (
           <SliderRow
             label="Burst Speed"
             value={layer.spawnConfig.burstSpeed}
             min={0} max={1} step={0.01}
             onChange={(v) => updateLayer(layerId, { 
               spawnConfig: { ...layer.spawnConfig, burstSpeed: v } 
             })}
           />
        )}

        <SliderRow
          label="Accumulation"
          value={layer.accumulationRate}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { accumulationRate: v })}
        />
        <SliderRow
          label="Decay Rate"
          value={layer.decayRate}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { decayRate: v })}
        />
      </div>

      {/* FORCES */}
      <div className="section">
        <div className="sectionTitle">Forces</div>
        
        <SliderRow
          label="Gravity"
          value={layer.gravity}
          min={-0.5} max={1.0} step={0.01}
          onChange={(v) => updateLayer(layerId, { gravity: v })}
        />
        <SliderRow
          label="Wind Strength"
          value={layer.windStrength}
          min={0} max={0.5} step={0.01}
          onChange={(v) => updateLayer(layerId, { windStrength: v })}
        />
        {layer.windStrength > 0 && (
          <SliderRow
            label="Wind Angle"
            value={layer.windAngle}
            min={0} max={6.28} step={0.1}
            onChange={(v) => updateLayer(layerId, { windAngle: v })}
          />
        )}
        <SliderRow
          label="Drag (Air Res)"
          value={layer.drag}
          min={0} max={0.5} step={0.01}
          onChange={(v) => updateLayer(layerId, { drag: v })}
        />
        <SliderRow
          label="Jitter/Noise"
          value={layer.jitter}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { jitter: v })}
        />
      </div>
    </div>
  );
};
