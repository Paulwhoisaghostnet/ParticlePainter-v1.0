import React, { useState } from 'react';
import { useStudioStore } from '../state/store';
import { PresetLibrary } from './PresetLibrary';
import { Accordion, AccordionItem } from './ui/StudioAccordion';
import { LayerControls } from './LayerControls'; 
import { LayerList } from './LayerList';
import { ParticleType, LayerKind } from '../state/types';

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
             <div className="row">
               <span className="rowLabel">Time Scale</span>
               <input 
                 type="range" 
                 min="0" max="2" step="0.1" 
                 value={global.timeScale}
                 onChange={(e) => setGlobal({ timeScale: parseFloat(e.target.value) })}
               />
             </div>
             <div className="row">
               <span className="rowLabel">Clear Rate</span>
               <input 
                 type="range" 
                 min="0" max="1" step="0.01" 
                 value={global.clearRate}
                 onChange={(e) => setGlobal({ clearRate: parseFloat(e.target.value) })}
               />
             </div>
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
