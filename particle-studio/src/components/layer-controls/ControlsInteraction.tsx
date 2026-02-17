import React from 'react';
import { useStudioStore } from '../../state/store';
import { SliderRow } from '../ui/SliderRow';
import { SwitchRow } from '../ui/SwitchRow';

interface ControlsProps {
  layerId: string;
}

export const ControlsInteraction: React.FC<ControlsProps> = ({ layerId }) => {
  const layers = useStudioStore((s) => s.layers);
  const layer = layers.find((l) => l.id === layerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const updateLayer = (id: string, patch: any) => setLayer(id, patch);

  if (!layer) return null;

  return (
    <div className="controls-group">
      <div className="section">
        <div className="sectionTitle">Boundaries & Mask</div>
        
        <div className="row">
          <span className="rowLabel">Boundary Mode</span>
          <select 
            className="select"
            value={layer.boundaryMode}
            onChange={(e) => updateLayer(layerId, { boundaryMode: e.target.value as any })}
          >
            <option value="bounce">Bounce</option>
            <option value="wrap">Wrap Around</option>
            <option value="respawn">Respawn</option>
            <option value="destroy">Destroy</option>
          </select>
        </div>

        {layer.boundaryMode === 'bounce' && (
           <SliderRow
             label="Bounce Factor"
             value={layer.boundaryBounce}
             min={0} max={1.5} step={0.01}
             onChange={(v) => updateLayer(layerId, { boundaryBounce: v })}
           />
        )}

        <div className="hr" />

        <div className="row">
          <span className="rowLabel">Mask Interaction</span>
          <select 
            className="select"
            value={layer.maskMode}
            onChange={(e) => updateLayer(layerId, { maskMode: e.target.value as any })}
          >
            <option value="ignore">Ignore Mask</option>
            <option value="collision">Collision (Bounce)</option>
            <option value="accumulate">Accumulate (Stick)</option>
          </select>
        </div>

        {layer.maskMode !== 'ignore' && (
           <>
             <SliderRow
               label="Stickiness"
               value={layer.maskStickiness}
               min={0} max={1} step={0.01}
               onChange={(v) => updateLayer(layerId, { maskStickiness: v })}
             />
             <SliderRow
               label="Magnetism"
               value={layer.maskMagnetism}
               min={-1} max={1} step={0.01}
               onChange={(v) => updateLayer(layerId, { maskMagnetism: v })}
             />
           </>
        )}
      </div>

      <div className="section">
        <div className="sectionTitle">Material Response</div>
        <div className="small" style={{ marginBottom: 8 }}>
            Override physical properties for surface interaction.
        </div>
        
        {/* Simplified material controls - deep dive in shader logic */}
        <SwitchRow
           label="Depth Field (2.5D)"
           checked={layer.depthEnabled}
           onCheckedChange={(v) => updateLayer(layerId, { depthEnabled: v })}
        />
        
        {layer.depthEnabled && (
           <SliderRow
             label="Depth Scale"
             value={layer.depthScale}
             min={0} max={2} step={0.01}
             onChange={(v) => updateLayer(layerId, { depthScale: v })}
           />
        )}
      </div>
    </div>
  );
};
