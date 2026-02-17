import React, { useState, useRef, useEffect } from 'react';
import { LayerConfig } from '../../state/types';
import { useStudioStore } from '../../state/store';

// Fallback icons
const EyeOpen = () => <span>👁</span>;
const EyeClosed = () => <span style={{ opacity: 0.5 }}>-</span>;
const IconUp = () => <span>▲</span>;
const IconDown = () => <span>▼</span>;
const IconCopy = () => <span>❐</span>;
const IconTrash = () => <span>×</span>;

interface LayerListItemProps {
  layer: LayerConfig;
  isActive: boolean;
  onSelect: () => void;
}

export const LayerListItem: React.FC<LayerListItemProps> = ({ layer, isActive, onSelect }) => {
  const setLayer = useStudioStore((s) => s.setLayer);
  const removeLayer = useStudioStore((s) => s.removeLayer);
  const duplicateLayer = useStudioStore((s) => s.duplicateLayer);
  const moveLayerUp = useStudioStore((s) => s.moveLayerUp);
  const moveLayerDown = useStudioStore((s) => s.moveLayerDown);
  const layers = useStudioStore((s) => s.layers);

  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  const handleSolo = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Logic: If this layer is the ONLY one enabled, enable all. 
    // Otherwise, disable all others and enable this one.
    const otherLayers = layers.filter(l => l.id !== layer.id);
    const areOthersDisabled = otherLayers.every(l => !l.enabled);

    if (layer.enabled && areOthersDisabled) {
      // Un-solo: Enable everyone (or restore previous state - simplified to enable all for now)
      layers.forEach(l => setLayer(l.id, { enabled: true }));
    } else {
      // Solo: Disable others, enable self
      layers.forEach(l => {
        if (l.id === layer.id) setLayer(l.id, { enabled: true });
        else setLayer(l.id, { enabled: false });
      });
    }
  };

  return (
    <div 
      className={`layerRow ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      style={{ borderLeft: `3px solid ${layer.color || '#fff'}` }}
    >
      {/* Visibility Toggle / Solo */}
      <button 
        className={`layerVisBtn ${layer.enabled ? 'active' : ''}`}
        onClick={(e) => {
          if (e.altKey) {
            handleSolo(e);
          } else {
            e.stopPropagation();
            setLayer(layer.id, { enabled: !layer.enabled });
          }
        }}
        title="Click to Toggle, Alt-Click to Solo"
      >
        {layer.enabled ? <EyeOpen /> : <EyeClosed />}
      </button>

      {/* Name Input / Label */}
      <div className="layerNameContainer" style={{ flex: 1, paddingLeft: 8 }}>
        {isEditingName ? (
           <input 
             ref={nameInputRef}
             className="layerNameInput"
             value={layer.name}
             onChange={(e) => setLayer(layer.id, { name: e.target.value })}
             onBlur={() => setIsEditingName(false)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') setIsEditingName(false);
             }}
             onClick={(e) => e.stopPropagation()}
           />
        ) : (
           <span 
             className="layerNameLabel"
             onDoubleClick={() => setIsEditingName(true)}
             style={{ fontSize: 13, color: layer.enabled ? 'var(--text)' : 'var(--muted)' }}
           >
             {layer.name}
           </span>
        )}
      </div>

      {/* Actions */}
      <div className="layerActions">
        <button className="layerActionBtn" title="Move Up" onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id); }}><IconUp /></button>
        <button className="layerActionBtn" title="Move Down" onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id); }}><IconDown /></button>
        <button className="layerActionBtn" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }}><IconCopy /></button>
        <button className="layerActionBtn danger" title="Delete" onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}><IconTrash /></button>
      </div>
    </div>
  );
};
