import React from 'react';
import { useStudioStore } from '../state/store';
import { Accordion, AccordionItem } from './ui/StudioAccordion';
import { ControlsSimulation } from './layer-controls/ControlsSimulation';
import { ControlsMovement } from './layer-controls/ControlsMovement';
import { ControlsAppearance } from './layer-controls/ControlsAppearance';
import { ControlsInteraction } from './layer-controls/ControlsInteraction';

interface LayerControlsProps {
  layerId: string;
}

export const LayerControls: React.FC<LayerControlsProps> = ({ layerId }) => {
  const layers = useStudioStore((s) => s.layers);
  const layer = layers.find((l) => l.id === layerId);

  if (!layer) return <div className="p-4 text-muted">No layer selected</div>;

  return (
    <div className="layerControls">
      {/* Header Info */}
      <div className="card" style={{ marginBottom: 12 }}>
         <div className="row">
            <span className="rowLabel">Type</span>
            <span className="badge badgeKind mask">{layer.type}</span>
         </div>
         <div className="row">
            <span className="rowLabel">Count</span>
            <span className="value">{layer.particleCount}</span>
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
      </Accordion>
    </div>
  );
};
