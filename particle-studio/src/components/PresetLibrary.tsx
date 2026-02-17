import React from 'react';
import { useStudioStore } from '../state/store';
import { PARTICLE_PRESETS } from '../state/presets';
import { ParticleType, LayerKind } from '../state/types';

interface PresetLibraryProps {
  onSelect: (kind: LayerKind, type: ParticleType) => void;
  onCancel: () => void;
}

export const PresetLibrary: React.FC<PresetLibraryProps> = ({ onSelect, onCancel }) => {
  const [selectedKind, setSelectedKind] = React.useState<LayerKind>('foreground');

  const presets = Object.entries(PARTICLE_PRESETS) as [ParticleType, any][];

  return (
    <div className="presetLibrary" style={{ padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8, marginBottom: 12 }}>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <span className="sectionTitle" style={{ margin: 0 }}>New Layer</span>
        <button className="btn btnSm" onClick={onCancel}>Cancel</button>
      </div>

      {/* Kind Selector Pills */}
      <div className="kindSelector" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['foreground', 'background', 'mask', 'directedFlow'] as LayerKind[]).map(kind => (
          <button
            key={kind}
            className={`btn btnSm ${selectedKind === kind ? 'btnPrimary' : ''}`}
            onClick={() => setSelectedKind(kind)}
            style={{ flex: 1, fontSize: 10, textTransform: 'capitalize' }}
          >
            {kind === 'directedFlow' ? 'Flow' : kind}
          </button>
        ))}
      </div>

      {/* Preset Grid */}
      <div className="presetGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {presets.map(([type, config]) => (
          <button
            key={type}
            className="presetCard"
            onClick={() => onSelect(selectedKind, type)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid transparent',
              borderRadius: 4,
              padding: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ 
                width: 12, height: 12, 
                borderRadius: '50%', 
                background: config.color || '#fff' 
              }} />
              <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: 12 }}>{type}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
