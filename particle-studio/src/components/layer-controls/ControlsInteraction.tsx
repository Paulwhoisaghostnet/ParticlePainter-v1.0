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
        <div className="sectionTitle">Material System</div>
        
        {/* Material Mode */}
        <div className="row">
            <span className="rowLabel">Material Mode</span>
            <div className="segmented" style={{ width: '100%' }}>
              {[
                { value: "binary" as const, label: "Binary" },
                { value: "palette" as const, label: "Palette" },
                { value: "rgbParams" as const, label: "RGB" }
              ].map((m) => (
                <button
                  key={m.value}
                  className={layer.materialMode === m.value ? "active" : ""}
                  onClick={() => updateLayer(layerId, { materialMode: m.value })}
                >
                  {m.label}
                </button>
              ))}
            </div>
        </div>
        <div className="small" style={{ marginBottom: 12, opacity: 0.7 }}>
            {layer.materialMode === "binary" && "Standard collision - mask controls boundaries"}
            {layer.materialMode === "palette" && "Color regions map to material presets"}
            {layer.materialMode === "rgbParams" && "RGB channels control stick/ripple/pass-through"}
        </div>
        
        <div className="hr" />

        <div className="sectionTitle" style={{marginTop: 8}}>2.5D Depth</div>
        <SwitchRow
           label="Enable Depth Field"
           checked={layer.depthEnabled}
           onCheckedChange={(v) => updateLayer(layerId, { depthEnabled: v })}
        />
        
        {layer.depthEnabled && (
           <>
             <SliderRow
               label="Depth Scale"
               value={layer.depthScale}
               min={0} max={2} step={0.01}
               onChange={(v) => updateLayer(layerId, { depthScale: v })}
             />
             <SliderRow
                label="Depth Blur"
                value={layer.depthBlur}
                min={0} max={10} step={0.5}
                onChange={(v) => updateLayer(layerId, { depthBlur: v })}
              />
              <SliderRow
                label="Depth Curve"
                value={layer.depthCurve}
                min={0.1} max={3} step={0.1}
                onChange={(v) => updateLayer(layerId, { depthCurve: v })}
              />
              <SwitchRow
                label="Invert Depth"
                checked={layer.depthInvert}
                onCheckedChange={(v) => updateLayer(layerId, { depthInvert: v })}
              />
           </>
        )}

        <div className="hr" />

        <div className="sectionTitle" style={{marginTop: 8}}>Ground Plane</div>
        <SwitchRow
          label="Enable Ground Plane"
          checked={layer.groundPlaneEnabled}
          onCheckedChange={(v) => updateLayer(layerId, { groundPlaneEnabled: v })}
        />
        {layer.groundPlaneEnabled && (
          <>
            <SliderRow
              label="Tilt Angle"
              value={layer.groundPlaneTilt}
              min={0} max={90} step={1}
              onChange={(v) => updateLayer(layerId, { groundPlaneTilt: v })}
            />
            <SliderRow
              label="Y Position"
              value={layer.groundPlaneY}
              min={0} max={1} step={0.01}
              onChange={(v) => updateLayer(layerId, { groundPlaneY: v })}
            />
          </>
        )}

        <div className="hr" />

        <div className="sectionTitle" style={{marginTop: 8}}>Surface Fields</div>
        <SwitchRow
          label="Enable Surface Fields"
          checked={layer.surfaceFieldsEnabled}
          onCheckedChange={(v) => updateLayer(layerId, { surfaceFieldsEnabled: v })}
        />
        {layer.surfaceFieldsEnabled && (
          <>
            <SwitchRow
              label="Smear Field"
              checked={layer.smearFieldEnabled}
              onCheckedChange={(v) => updateLayer(layerId, { smearFieldEnabled: v })}
            />
            {layer.smearFieldEnabled && (
              <SliderRow
                label="Smear Decay"
                value={layer.smearDecayRate}
                min={0} max={1} step={0.01}
                onChange={(v) => updateLayer(layerId, { smearDecayRate: v })}
              />
            )}
            
            <SwitchRow
              label="Ripple Field"
              checked={layer.rippleFieldEnabled}
              onCheckedChange={(v) => updateLayer(layerId, { rippleFieldEnabled: v })}
            />
            {layer.rippleFieldEnabled && (
              <>
                <SliderRow
                  label="Ripple Damping"
                  value={layer.rippleDamping}
                  min={0} max={1} step={0.01}
                  onChange={(v) => updateLayer(layerId, { rippleDamping: v })}
                />
                <SliderRow
                  label="Ripple Speed"
                  value={layer.rippleSpeed}
                  min={0.1} max={3} step={0.1}
                  onChange={(v) => updateLayer(layerId, { rippleSpeed: v })}
                />
              </>
            )}

            <SwitchRow
              label="Dent Field"
              checked={layer.dentFieldEnabled}
              onCheckedChange={(v) => updateLayer(layerId, { dentFieldEnabled: v })}
            />
            {layer.dentFieldEnabled && (
              <SliderRow
                label="Dent Recovery"
                value={layer.dentRecoveryRate}
                min={0} max={1} step={0.01}
                onChange={(v) => updateLayer(layerId, { dentRecoveryRate: v })}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
