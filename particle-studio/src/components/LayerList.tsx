import React from 'react';
import { useStudioStore } from '../state/store';
import { LayerListItem } from './ui/LayerListItem';

export const LayerList: React.FC = () => {
  const layers = useStudioStore((s) => s.layers);
  const selectedLayerId = useStudioStore((s) => s.selectedLayerId);
  const selectLayer = useStudioStore((s) => s.selectLayer);

  return (
    <div className="layerList">
      {layers.map((l) => (
        <LayerListItem 
          key={l.id}
          layer={l}
          isActive={l.id === selectedLayerId}
          onSelect={() => selectLayer(l.id)}
        />
      ))}
    </div>
  );
};
