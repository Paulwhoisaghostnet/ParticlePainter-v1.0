import { useStudioStore } from "../state/store";
import { SliderRow } from "./ui/SliderRow";
import { SwitchRow } from "./ui/SwitchRow";
import type { ResolutionPreset } from "../state/types";

export function StudioControls() {
  const global = useStudioStore((s) => s.global);
  const setGlobal = useStudioStore((s) => s.setGlobal);
  const addLayer = useStudioStore((s) => s.addLayer);
  const requestResetAll = useStudioStore((s) => s.requestResetAll);
  const requestScreenshot = useStudioStore((s) => s.requestScreenshot);
  const requestStartRecording = useStudioStore((s) => s.requestStartRecording);
  const requestStopRecording = useStudioStore((s) => s.requestStopRecording);
  const requestExportGif = useStudioStore((s) => s.requestExportGif);
  const isRecording = useStudioStore((s) => s.isRecording);
  const isGifExporting = useStudioStore((s) => s.isGifExporting);

  return (
    <>
      <div className="toolbarRow">
        <button className="btn btnPrimary" onClick={() => addLayer()}>
          + Add Layer
        </button>
        <button className="btn" onClick={() => setGlobal({ paused: !global.paused })}>
          {global.paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button className="btn btnDanger" onClick={requestResetAll}>
          Reset
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="cardTitle">
          <span>Export</span>
          {(isRecording || isGifExporting) && (
            <span className="badge" style={{ background: "#ff3d5a", color: "#fff" }}>
              ● {isGifExporting ? "GIF" : "REC"}
            </span>
          )}
        </div>
        <div className="toolbarRow">
          <button className="btn" onClick={requestScreenshot}>
            📷 Screenshot
          </button>
          {!isRecording ? (
            <button className="btn" onClick={requestStartRecording} disabled={isGifExporting}>
              🎬 Record
            </button>
          ) : (
            <button className="btn btnDanger" onClick={requestStopRecording}>
              ⏹ Stop & Save
            </button>
          )}
          <button className="btn" onClick={requestExportGif} disabled={isRecording || isGifExporting}>
            🧩 Export GIF
          </button>
        </div>
        <div className="row">
          <div className="small">Recording FPS</div>
          <div style={{ display: "flex", gap: 6 }}>
            {([24, 30, 60] as const).map((fps) => (
              <button
                key={fps}
                className={`btn ${global.recordingFps === fps ? "btnPrimary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setGlobal({ recordingFps: fps })}
                disabled={isRecording}
              >
                {fps}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="small">WebM duration</div>
          <div style={{ display: "flex", gap: 6 }}>
            {([0, 5, 15, 30, 60] as const).map((seconds) => (
              <button
                key={seconds}
                className={`btn ${global.webmDuration === seconds ? "btnPrimary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setGlobal({ webmDuration: seconds })}
                disabled={isRecording}
              >
                {seconds === 0 ? "Free" : `${seconds}s`}
              </button>
            ))}
          </div>
        </div>
        <SwitchRow
          label={global.recordingResetOnStart ? "Reset before recording" : "Keep current state"}
          checked={global.recordingResetOnStart}
          onCheckedChange={(v) => setGlobal({ recordingResetOnStart: v })}
        />
        <div className="row">
          <div className="small">GIF duration</div>
          <div style={{ display: "flex", gap: 6 }}>
            {([1, 3, 4.2, 5, 6.66] as const).map((d) => (
              <button
                key={d}
                className={`btn ${global.gifDuration === d ? "btnPrimary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setGlobal({ gifDuration: d })}
              >
                {d === 4.2 ? "4.2s" : d === 6.66 ? "6.6s" : `${d}s`}
              </button>
            ))}
          </div>
        </div>
        <div className="small">
          Screenshot saves PNG. WebM/MP4 include audio if loaded.
          GIF export uses fixed {global.recordingFps} fps for {global.gifDuration}s.
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">
          <span>Global</span>
          <span className="badge">{global.monochrome ? "Mono" : "RGB"}</span>
        </div>

        <SliderRow
          label="Time scale"
          value={global.timeScale}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => setGlobal({ timeScale: v })}
        />
        <SliderRow
          label="Exposure"
          value={global.exposure}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => setGlobal({ exposure: v })}
        />
        <SliderRow
          label="Background fade"
          value={global.backgroundFade}
          min={0}
          max={0.35}
          step={0.001}
          onChange={(v) => setGlobal({ backgroundFade: v })}
        />
        <SliderRow
          label="Threshold"
          value={global.threshold}
          min={0}
          max={1}
          step={0.001}
          onChange={(v) => setGlobal({ threshold: v })}
        />
        <SliderRow
          label="Threshold soft"
          value={global.thresholdSoft}
          min={0}
          max={0.35}
          step={0.001}
          onChange={(v) => setGlobal({ thresholdSoft: v })}
        />
        <SliderRow
          label="Threshold gain"
          value={global.thresholdGain}
          min={0}
          max={3}
          step={0.01}
          onChange={(v) => setGlobal({ thresholdGain: v })}
        />

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

        <div className="small" style={{ marginTop: 10 }}>
          Tips: Use a high-contrast mask (black = inside). For the "gif look", keep fade low
          (0.03–0.10) and raise curl + dither.
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">
          <span>Resolution</span>
          <span className="badge">{global.resolutionPreset === "custom" ? `${global.customWidth}×${global.customHeight}` : global.resolutionPreset}</span>
        </div>

        <div className="row">
          <div className="small">Preset</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["512x512", "1080x1080", "2048x2048", "custom"] as ResolutionPreset[]).map((preset) => (
              <button
                key={preset}
                className={`btn ${global.resolutionPreset === preset ? "btnPrimary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setGlobal({ resolutionPreset: preset })}
              >
                {preset === "custom" ? "Custom" : preset}
              </button>
            ))}
          </div>
        </div>

        {global.resolutionPreset === "custom" && (
          <>
            <div className="row">
              <label className="small">Width</label>
              <input
                type="number"
                value={global.customWidth}
                min={256}
                max={4096}
                step={1}
                onChange={(e) => setGlobal({ customWidth: parseInt(e.target.value, 10) || 256 })}
                style={{ width: "100px", padding: "4px 8px", fontSize: 12 }}
              />
            </div>
            <div className="row">
              <label className="small">Height</label>
              <input
                type="number"
                value={global.customHeight}
                min={256}
                max={4096}
                step={1}
                onChange={(e) => setGlobal({ customHeight: parseInt(e.target.value, 10) || 256 })}
                style={{ width: "100px", padding: "4px 8px", fontSize: 12 }}
              />
            </div>
          </>
        )}

        <div className="small" style={{ marginTop: 10 }}>
          Canvas/output resolution. Rolling buffer and all exports use this resolution.
          Higher resolutions use more memory.
        </div>
      </div>
    </>
  );
}
