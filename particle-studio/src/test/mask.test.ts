import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore } from '../state/store';

describe('Mask Layer State Management', () => {
  beforeEach(() => {
    // Reset store state: remove all layers and reset selection
    useStudioStore.setState({ layers: [], selectedLayerId: '' });
  });

  it('should create a mask layer with default maskUrl undefined', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layers = useStudioStore.getState().layers;
    expect(layers).toHaveLength(1);
    expect(layers[0].kind).toBe('mask');
    expect(layers[0].maskUrl).toBeUndefined();
  });

  it('should set maskUrl on a mask layer', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    const fakeDataUrl = 'data:image/png;base64,abc123';
    useStudioStore.getState().setLayer(layerId, { maskUrl: fakeDataUrl });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.maskUrl).toBe(fakeDataUrl);
  });

  it('should clear maskUrl by setting it to undefined', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    useStudioStore.getState().setLayer(layerId, { maskUrl: 'data:image/png;base64,abc' });
    useStudioStore.getState().setLayer(layerId, { maskUrl: undefined });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.maskUrl).toBeUndefined();
  });

  it('should have default maskThreshold and maskInvert values', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layer = useStudioStore.getState().layers[0];
    expect(layer.maskThreshold).toBe(0.5);
    expect(layer.maskInvert).toBe(true);
  });

  it('should update maskThreshold', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    useStudioStore.getState().setLayer(layerId, { maskThreshold: 0.25 });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.maskThreshold).toBe(0.25);
  });

  it('should toggle maskInvert', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    useStudioStore.getState().setLayer(layerId, { maskInvert: false });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.maskInvert).toBe(false);
  });

  it('should toggle showMask', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    expect(useStudioStore.getState().layers[0].showMask).toBe(false);
    useStudioStore.getState().setLayer(layerId, { showMask: true });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.showMask).toBe(true);
  });

  it('should have default maskMagnetismRadius', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layer = useStudioStore.getState().layers[0];
    expect(layer.maskMagnetismRadius).toBe(0.1);
  });

  it('should update maskMagnetismRadius', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    useStudioStore.getState().setLayer(layerId, { maskMagnetismRadius: 0.5 });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.maskMagnetismRadius).toBe(0.5);
  });

  it('should have default maskBehavior as containment', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layer = useStudioStore.getState().layers[0];
    expect(layer.maskBehavior).toBe('containment');
  });

  it('should update maskBehavior to borderEffect', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    useStudioStore.getState().setLayer(layerId, { maskBehavior: 'borderEffect' });
    const layer = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(layer?.maskBehavior).toBe('borderEffect');
  });

  it('should update borderEffectConfig effect type', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    const layer = useStudioStore.getState().layers[0];
    useStudioStore.getState().setLayer(layerId, {
      borderEffectConfig: { ...layer.borderEffectConfig, effect: 'smear' }
    });
    const updated = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(updated?.borderEffectConfig.effect).toBe('smear');
  });

  it('should update borderEffectConfig smearLength', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    const layer = useStudioStore.getState().layers[0];
    useStudioStore.getState().setLayer(layerId, {
      borderEffectConfig: { ...layer.borderEffectConfig, effect: 'smear', smearLength: 0.8 }
    });
    const updated = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(updated?.borderEffectConfig.smearLength).toBe(0.8);
  });

  it('should update borderEffectConfig fragmentCount', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    const layer = useStudioStore.getState().layers[0];
    useStudioStore.getState().setLayer(layerId, {
      borderEffectConfig: { ...layer.borderEffectConfig, effect: 'fragment', fragmentCount: 5 }
    });
    const updated = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(updated?.borderEffectConfig.fragmentCount).toBe(5);
  });

  it('should update borderEffectConfig transformColor', () => {
    useStudioStore.getState().addLayer('mask', 'dust');
    const layerId = useStudioStore.getState().layers[0].id;
    const layer = useStudioStore.getState().layers[0];
    useStudioStore.getState().setLayer(layerId, {
      borderEffectConfig: { ...layer.borderEffectConfig, effect: 'transform', transformColor: '#ff0000' }
    });
    const updated = useStudioStore.getState().layers.find(l => l.id === layerId);
    expect(updated?.borderEffectConfig.transformColor).toBe('#ff0000');
  });
});
