import React, { useState } from 'react';
import { useStudioStore } from '../state/store';
import { PresetLibrary } from './PresetLibrary';
import { Accordion, AccordionItem } from './ui/StudioAccordion';
import { LayerControls } from './LayerControls'; 
import { LayerList } from './LayerList';
import { AudioControls } from './AudioControls';
import { ParticleType, LayerKind, ResolutionPreset } from '../state/types';
import { SliderRow } from './ui/SliderRow';
import { SwitchRow } from './ui/SwitchRow';

// Fallback icons since lucide-react is not installed
const IconPlay = () => <span>▶</span>;
const IconPause = () => <span>⏸</span>;
const IconReset = () => <span>↺</span>;

interface StudioPanelProps {
  className?: string;
  onClose?: () => void;
}

export const StudioPanel: React.FC<StudioPanelProps> = ({ className = "", onClose }) => {
  // ... state setup remains the same
  const global = useStudioStore((s) => s.global);
  const setGlobal = useStudioStore((s) => s.setGlobal);
  const layers = useStudioStore((s) => s.layers);
  const selectedLayerId = useStudioStore((s) => s.selectedLayerId);
  const addLayer = useStudioStore((s) => s.addLayer);
  const selectLayer = useStudioStore((s) => s.selectLayer);

  // New Layer State
  const [isAddingLayer, setIsAddingLayer] = useState(false);

  // Global Transport Handlers
  const togglePause = () => setGlobal({ paused: !global.paused });
  const reset = () => {
    useStudioStore.getState().requestResetAll();
  };

  const handleCreateLayer = (kind: LayerKind, type: ParticleType) => {
    addLayer(kind, type);
    setIsAddingLayer(false);
  };

  return (
    <div className={`panel rightPanel ${className}`} style={{ gridRow: '1 / 3', height: '100%' }}>
      {/* Studio Header - Always Visible */}
      <div className="panelHeader">
        <div className="brand">
          <h1>Particle Painter</h1>
          <span>Studio</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btnIcon" onClick={togglePause} title={global.paused ? "Play" : "Pause"}>
            {global.paused ? <IconPlay /> : <IconPause />}
          </button>
          <button className="btn btnIcon" onClick={reset} title="Reset">
            <IconReset />
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="panelBody">
        <Accordion>
          <AccordionItem value="global" trigger="Global Settings" defaultOpen={false}>
             {/* Resolution Section */}
             <div className="section" style={{ marginBottom: 16 }}>
               <div className="sectionTitle" style={{ fontSize: 11, marginBottom: 8, opacity: 0.7 }}>RESOLUTION</div>
               <div className="row">
                 <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: '100%' }}>
                   {(["512x512", "1080x1080", "2048x2048", "custom"] as ResolutionPreset[]).map((preset) => (
                     <button
                       key={preset}
                       className={`btn btnSm ${global.resolutionPreset === preset ? "btnPrimary" : ""}`}
                       style={{ flex: 1, minWidth: 60 }}
                       onClick={() => setGlobal({ resolutionPreset: preset })}
                     >
                       {preset === "custom" ? "Custom" : preset.split('x')[0]}
                     </button>
                   ))}
                 </div>
               </div>

               {global.resolutionPreset === "custom" && (
                 <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                   <div style={{ flex: 1 }}>
                     <div className="small">Width</div>
                     <input
                       type="number" className="input inputSm" style={{ width: '100%' }}
                       value={global.customWidth} min={256} max={4096}
                       onChange={(e) => setGlobal({ customWidth: parseInt(e.target.value) || 256 })}
                     />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div className="small">Height</div>
                     <input
                       type="number" className="input inputSm" style={{ width: '100%' }}
                       value={global.customHeight} min={256} max={4096}
                       onChange={(e) => setGlobal({ customHeight: parseInt(e.target.value) || 256 })}
                     />
                   </div>
                 </div>
               )}
             </div>

             <div className="separator" style={{ margin: '16px 0', borderBottom: '1px solid var(--stroke)' }} />
             
             {/* Visual Settings */}
             <div className="section" style={{ marginBottom: 16 }}>
               <div className="sectionTitle" style={{ fontSize: 11, marginBottom: 8, opacity: 0.7 }}>VISUALS</div>
               <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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

               <SliderRow
                 label="Exposure"
                 value={global.exposure}
                 min={0} max={2} step={0.01}
                 onChange={(v) => setGlobal({ exposure: v })}
               />
               <SliderRow
                 label="Threshold"
                 value={global.threshold}
                 min={0} max={1} step={0.001}
                 onChange={(v) => setGlobal({ threshold: v })}
               />
               <SliderRow
                 label="Threshold Soft"
                 value={global.thresholdSoft}
                 min={0} max={0.35} step={0.001}
                 onChange={(v) => setGlobal({ thresholdSoft: v })}
               />
               <SliderRow
                 label="Threshold Gain"
                 value={global.thresholdGain}
                 min={0} max={3} step={0.01}
                 onChange={(v) => setGlobal({ thresholdGain: v })}
               />
             </div>

             <div className="separator" style={{ margin: '16px 0', borderBottom: '1px solid var(--stroke)' }} />

             <div className="section">
                 <div className="sectionTitle" style={{ fontSize: 11, marginBottom: 8, opacity: 0.7 }}>TIME</div>
                 <SliderRow 
                   label="Time Scale" 
                   value={global.timeScale} 
                   min={0} max={2} step={0.1}
                   onChange={(v) => setGlobal({ timeScale: v })}
                 />
                 <SliderRow 
                   label="Clear Rate" 
                   value={global.clearRate} 
                   min={0} max={1} step={0.01}
                   onChange={(v) => setGlobal({ clearRate: v })}
                 />
             </div>

             <div className="separator" style={{ margin: '16px 0', borderBottom: '1px solid var(--stroke)' }} />
             
             <AudioControls />
          </AccordionItem>

          <AccordionItem value="layers" trigger={`Layers (${layers.length})`} defaultOpen={true}>
            <div style={{ marginBottom: 8 }}>
                 <LayerList />
            </div>
            
            {!isAddingLayer && (
              <button 
                className="btn btnSm btnPrimary" 
                style={{ width: '100%', marginBottom: 8 }}
                onClick={() => setIsAddingLayer(true)}
              >
                + Add New Layer
              </button>
            )}

            {/* New Layer Creation Form */}
            {isAddingLayer && (
              <PresetLibrary 
                onSelect={handleCreateLayer}
                onCancel={() => setIsAddingLayer(false)}
              />
            )}
          </AccordionItem>

          {selectedLayerId && (
            <div style={{ marginTop: 16 }}>
              <LayerControls layerId={selectedLayerId} />
            </div>
          )}
        </Accordion>
      </div>
    </div>
  );
};
