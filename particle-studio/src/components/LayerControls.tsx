import React, { useRef } from 'react';
import { useStudioStore } from '../state/store';
import { Accordion, AccordionItem } from './ui/StudioAccordion';
import { ControlsSimulation } from './layer-controls/ControlsSimulation';
import { ControlsMovement } from './layer-controls/ControlsMovement';
import { ControlsAppearance } from './layer-controls/ControlsAppearance';
import { ControlsInteraction } from './layer-controls/ControlsInteraction';
import { AudioMappingEditor } from './AudioMappingEditor';
import { SliderRow } from './ui/SliderRow';

interface LayerControlsProps {
  layerId: string;
}

export const LayerControls: React.FC<LayerControlsProps> = ({ layerId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layers = useStudioStore((s) => s.layers);
  const layer = layers.find((l) => l.id === layerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const importLayer = useStudioStore((s) => s.importLayer);

  if (!layer) return <div className="p-4 text-muted">No layer selected</div>;

  const handleSaveLayer = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layer));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${layer.name.replace(/\s+/g, '_')}_layer.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleLoadLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Remove ID to let importLayer generate a new one
        const { id, ...settings } = json;
        importLayer(settings);
      } catch (err) {
        console.error("Failed to load layer", err);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="layerControls">
      {/* Header Info */}
      <div className="card" style={{ marginBottom: 12 }}>
         <div className="row" style={{ marginBottom: 8 }}>
            <span className="rowLabel">Type</span>
            <span className="badge badgeKind mask">{layer.type}</span>
         </div>
         
         <SliderRow
           label="Particle Count"
           value={layer.particleCount}
           min={100} max={20000} step={100}
           onChange={(v) => setLayer(layerId, { particleCount: v })}
         />

         {/* Actions */}
         <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
           <button className="btn btnSm" onClick={handleSaveLayer}>Save Layer</button>
           <button className="btn btnSm" onClick={() => fileInputRef.current?.click()}>Load Layer</button>
           <input 
             type="file" 
             ref={fileInputRef} 
             style={{ display: 'none' }} 
             accept=".json"
             onChange={handleLoadLayer}
           />
         </div>
      </div>

      {/* Nested Accordion for Categories */}
      <Accordion>
        <AccordionItem value="sim" trigger="Simulation & Forces" defaultOpen={true}>
           <ControlsSimulation layerId={layerId} />
        </AccordionItem>
        
        <AccordionItem value="move" trigger="Movement & Attraction" defaultOpen={false}>
           <ControlsMovement layerId={layerId} />
        </AccordionItem>
        
        <AccordionItem value="look" trigger="Appearance & Color" defaultOpen={false}>
           <ControlsAppearance layerId={layerId} />
        </AccordionItem>
        
        <AccordionItem value="interact" trigger="Material & Interaction" defaultOpen={false}>
           <ControlsInteraction layerId={layerId} />
        </AccordionItem>

        <AccordionItem value="audio" trigger="Audio Reactivity" defaultOpen={false}>
           <AudioMappingEditor />
        </AccordionItem>
      </Accordion>
    </div>
  );
};
