import React, { useMemo, useRef } from "react";
import { useStudioStore } from "../state/store";
import { SliderRow } from "./ui/SliderRow";
import { SwitchRow } from "./ui/SwitchRow";
import type { MaskTransform } from "../state/types";

const defaultTransform: MaskTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0
};

export function MaskEditor() {
  const layers = useStudioStore((s) => s.layers);
  const selectedLayerId = useStudioStore((s) => s.selectedLayerId);
  const setLayer = useStudioStore((s) => s.setLayer);
  const maskFileInputRef = useRef<HTMLInputElement>(null);

  const layer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId),
    [layers, selectedLayerId]
  );

  if (!layer || layer.kind !== "mask") return null;

  const transform = layer.maskTransform || defaultTransform;

  const updateTransform = (patch: Partial<MaskTransform>) => {
    setLayer(layer.id, {
      maskTransform: { ...transform, ...patch }
    });
  };

  const resetTransform = () => {
    setLayer(layer.id, { maskTransform: defaultTransform });
  };

  const handleMaskUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLayer(layer.id, { maskUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearMask = () => {
    setLayer(layer.id, { maskUrl: undefined });
  };

  return (
    <>
      {/* MASK IMAGE */}
      <div className="section">
        <h3 className="sectionTitle">Mask Image</h3>

        {layer.maskUrl ? (
          <div style={{ marginBottom: 10 }}>
            <img
              src={layer.maskUrl}
              alt="Mask preview"
              style={{
                width: "100%",
                maxHeight: 120,
                objectFit: "contain",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "#111",
                display: "block",
                marginBottom: 8
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btnSm"
                style={{ flex: 1 }}
                onClick={() => maskFileInputRef.current?.click()}
              >
                Replace
              </button>
              <button className="btn btnSm btnDanger" style={{ flex: 1 }} onClick={handleClearMask}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btnSm btnPrimary"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => maskFileInputRef.current?.click()}
          >
            Upload Mask Image
          </button>
        )}

        <input
          ref={maskFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleMaskUpload}
        />

        <SliderRow
          label="Threshold"
          value={layer.maskThreshold}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setLayer(layer.id, { maskThreshold: v })}
          tooltip="Luminance cutoff: pixels below this value are inside the mask"
        />

        <SwitchRow
          label="Invert Mask"
          checked={layer.maskInvert}
          onCheckedChange={(v) => setLayer(layer.id, { maskInvert: v })}
          tooltip="Swap inside/outside regions of the mask"
        />

        <SwitchRow
          label="Show Mask Overlay"
          checked={layer.showMask}
          onCheckedChange={(v) => setLayer(layer.id, { showMask: v })}
          tooltip="Display mask in red as a visual guide"
        />
      </div>

      {/* MASK TRANSFORM */}
      <div className="section">
        <h3 className="sectionTitle">
          Mask Transform
          <button className="btn btnSm" style={{ marginLeft: "auto" }} onClick={resetTransform}>
            Reset
          </button>
        </h3>

        <SliderRow
          label="Pan X"
          value={transform.x}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => updateTransform({ x: v })}
        />
        <SliderRow
          label="Pan Y"
          value={transform.y}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => updateTransform({ y: v })}
        />
        <SliderRow
          label="Scale"
          value={transform.scale}
          min={0.1}
          max={3}
          step={0.01}
          onChange={(v) => updateTransform({ scale: v })}
        />
        <SliderRow
          label="Rotation"
          value={transform.rotation}
          min={0}
          max={360}
          step={1}
          onChange={(v) => updateTransform({ rotation: v })}
        />
        <SliderRow
          label="Skew X"
          value={transform.skewX}
          min={-45}
          max={45}
          step={1}
          onChange={(v) => updateTransform({ skewX: v })}
        />
        <SliderRow
          label="Skew Y"
          value={transform.skewY}
          min={-45}
          max={45}
          step={1}
          onChange={(v) => updateTransform({ skewY: v })}
        />
      </div>
    </>
  );
}
