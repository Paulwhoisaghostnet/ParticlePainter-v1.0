import React from 'react';
import { useStudioStore } from '../../state/store';
import { SliderRow } from '../ui/SliderRow';
import { SwitchRow } from '../ui/SwitchRow';

interface ControlsProps {
  layerId: string;
}

export const ControlsAppearance: React.FC<ControlsProps> = ({ layerId }) => {
  const layers = useStudioStore((s) => s.layers);
  const layer = layers.find((l) => l.id === layerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const updateLayer = (id: string, patch: any) => setLayer(id, patch);

  if (!layer) return null;

  return (
    <div className="controls-group">
      <div className="section">
        <div className="sectionTitle">Particle Render</div>
        
        {/* SHAPE */}
        <div className="row">
          <span className="rowLabel">Shape</span>
          <select 
            className="select"
            value={layer.shape}
            onChange={(e) => updateLayer(layerId, { shape: e.target.value as any })}
          >
            <option value="dot">Dot (Soft)</option>
            <option value="square">Square</option>
            <option value="star">Star</option>
            <option value="dash">Dash</option>
            <option value="ring">Ring</option>
            <option value="diamond">Diamond</option>
            <option value="cross">Cross</option>
            <option value="tilde">Tilde</option>
          </select>
        </div>

        <SliderRow
          label="Size"
          value={layer.pointSize}
          min={0.5} max={64} step={0.5}
          onChange={(v) => updateLayer(layerId, { pointSize: v })}
        />
        
        <SliderRow
          label="Size Jitter"
          value={layer.sizeJitter}
          min={0} max={2} step={0.01}
          onChange={(v) => updateLayer(layerId, { sizeJitter: v })}
        />

        <SliderRow
          label="Trail Length"
          value={layer.trailLength}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { trailLength: v })}
        />
      </div>

      <div className="section">
        <div className="sectionTitle">Color</div>
        
        <div className="row">
          <span className="rowLabel">Mode</span>
          <select 
            className="select"
            value={layer.colorMode}
            onChange={(e) => updateLayer(layerId, { colorMode: e.target.value as any })}
          >
            <option value="single">Single Color</option>
            <option value="gradient">Gradient (2-3 Colors)</option>
            <option value="scheme">Preset Scheme</option>
            <option value="range">HSL Range</option>
          </select>
        </div>

        {layer.colorMode === 'single' && (
           <div className="row">
             <span className="rowLabel">Color</span>
             <input 
               type="color" 
               className="colorInput"
               value={layer.color}
               onChange={(e) => updateLayer(layerId, { color: e.target.value })}
             />
           </div>
        )}

        {layer.colorMode === 'gradient' && (
           <div className="row" style={{ display: 'flex', gap: 8 }}>
             <input type="color" className="colorInput" value={layer.color} onChange={(e) => updateLayer(layerId, { color: e.target.value })} />
             <input type="color" className="colorInput" value={layer.colorSecondary || '#ffffff'} onChange={(e) => updateLayer(layerId, { colorSecondary: e.target.value })} />
             <input type="color" className="colorInput" value={layer.colorTertiary || '#ffffff'} onChange={(e) => updateLayer(layerId, { colorTertiary: e.target.value })} />
           </div>
        )}

        <SliderRow
          label="Brightness"
          value={layer.brightness}
          min={0} max={2} step={0.01}
          onChange={(v) => updateLayer(layerId, { brightness: v })}
        />
        
        <SliderRow
          label="Dither"
          value={layer.dither}
          min={0} max={1} step={0.01}
          onChange={(v) => updateLayer(layerId, { dither: v })}
        />
      </div>
    </div>
  );
};
