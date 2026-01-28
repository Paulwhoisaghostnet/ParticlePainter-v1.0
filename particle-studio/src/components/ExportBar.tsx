import { useState, useRef } from "react";
import { useStudioStore } from "../state/store";
import { getAudioEngine } from "./AudioControls";
import type { GifDuration, WebmDuration, Mp4Duration } from "../state/types";
import { exportSceneAsHTML } from "../engine/HTMLExporter";

type ExportStatus = {
  active: boolean;
  format: "gif" | "webm" | "mp4" | null;
  message: string;
  progress: number;
};

export function ExportBar() {
  const global = useStudioStore((s) => s.global);
  const setGlobal = useStudioStore((s) => s.setGlobal);
  const requestScreenshot = useStudioStore((s) => s.requestScreenshot);
  const requestExportGif = useStudioStore((s) => s.requestExportGif);
  const requestStartRecording = useStudioStore((s) => s.requestStartRecording);
  const requestStopRecording = useStudioStore((s) => s.requestStopRecording);
  const requestExportMp4 = useStudioStore((s) => s.requestExportMp4);
  const isRecording = useStudioStore((s) => s.isRecording);
  const isGifExporting = useStudioStore((s) => s.isGifExporting);
  const isMp4Exporting = useStudioStore((s) => s.isMp4Exporting);

  const [expandedSection, setExpandedSection] = useState<"gif" | "webm" | "mp4" | null>(null);

  const isExporting = isRecording || isGifExporting || isMp4Exporting;
  
  // Get audio duration once for the MP4 section
  const audioDuration = global.audioUrl ? getAudioEngine().getDuration() : 0;

  const gifDurations: GifDuration[] = [1, 3, 4.2, 5, 6.66];
  const webmDurations: WebmDuration[] = [0, 5, 15, 30, 60];
  const mp4Durations: Mp4Duration[] = [15, 30, 60, -1];

  const formatDuration = (d: number) => {
    if (d === 0) return "∞";
    if (d === -1) {
      // Show actual audio duration if available
      if (audioDuration > 0) {
        return `🎵 ${Math.round(audioDuration)}s`;
      }
      return "🎵";
    }
    if (d === 4.2) return "4.2s";
    if (d === 6.66) return "6.6s";
    return `${d}s`;
  };

  return (
    <div className="exportBar">
      {/* Status indicator */}
      {isExporting && (
        <span
          className="badge"
          style={{ background: "#ff3d5a", color: "#fff", animation: "pulse 1s infinite" }}
        >
          ● {isGifExporting ? "GIF..." : isMp4Exporting ? "MP4..." : "REC"}
        </span>
      )}

      {/* Screenshot */}
      <div className="exportGroup">
        <button
          className="btn btnSm"
          onClick={requestScreenshot}
          disabled={isExporting}
          title="Screenshot (PNG)"
        >
          📷 PNG
        </button>
      </div>

      {/* GIF Export */}
      <div className="exportGroup">
        <button
          className={`btn btnSm ${expandedSection === "gif" ? "active" : ""}`}
          onClick={() => setExpandedSection(expandedSection === "gif" ? null : "gif")}
          disabled={isExporting}
        >
          🧩 GIF
        </button>
        {expandedSection === "gif" && (
          <div className="exportDropdown">
            <div className="exportDropdownLabel">Duration</div>
            <div className="segmented segmentedVertical">
              {gifDurations.map((d) => (
                <button
                  key={d}
                  className={global.gifDuration === d ? "active" : ""}
                  onClick={() => setGlobal({ gifDuration: d })}
                >
                  {formatDuration(d)}
                </button>
              ))}
            </div>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setExpandedSection(null);
                requestExportGif();
              }}
              style={{ marginTop: 8, width: "100%" }}
            >
              Export GIF
            </button>
          </div>
        )}
      </div>

      {/* WebM Export */}
      <div className="exportGroup">
        {!isRecording ? (
          <button
            className={`btn btnSm ${expandedSection === "webm" ? "active" : ""}`}
            onClick={() => setExpandedSection(expandedSection === "webm" ? null : "webm")}
            disabled={isGifExporting || isMp4Exporting}
          >
            🎬 WebM
          </button>
        ) : (
          <button
            className="btn btnSm btnDanger"
            onClick={requestStopRecording}
          >
            ⏹ Stop
          </button>
        )}
        {expandedSection === "webm" && !isRecording && (
          <div className="exportDropdown">
            <div className="exportDropdownLabel">Duration</div>
            <div className="segmented segmentedVertical">
              {webmDurations.map((d) => (
                <button
                  key={d}
                  className={global.webmDuration === d ? "active" : ""}
                  onClick={() => setGlobal({ webmDuration: d })}
                >
                  {formatDuration(d)}
                </button>
              ))}
            </div>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setExpandedSection(null);
                requestStartRecording();
              }}
              style={{ marginTop: 8, width: "100%" }}
            >
              {global.webmDuration === 0 ? "Start Recording" : `Record ${global.webmDuration}s`}
            </button>
          </div>
        )}
      </div>

      {/* MP4 Export (with audio) */}
      <div className="exportGroup">
        <button
          className={`btn btnSm ${expandedSection === "mp4" ? "active" : ""}`}
          onClick={() => setExpandedSection(expandedSection === "mp4" ? null : "mp4")}
          disabled={isExporting}
          title={global.audioUrl ? "Export MP4 with audio" : "Export MP4 (no audio loaded)"}
        >
          🎥 MP4
        </button>
        {expandedSection === "mp4" && (
          <div className="exportDropdown">
            <div className="exportDropdownLabel">Duration</div>
            <div className="segmented segmentedVertical">
              {mp4Durations.map((d) => (
                <button
                  key={d}
                  className={global.mp4Duration === d ? "active" : ""}
                  onClick={() => setGlobal({ mp4Duration: d })}
                  disabled={d === -1 && !global.audioUrl}
                  title={d === -1 ? "Match audio track length" : undefined}
                >
                  {formatDuration(d)}
                </button>
              ))}
            </div>
            {!global.audioUrl && (
              <div className="exportDropdownHint">
                Load audio for 🎵 option
              </div>
            )}
            <button
              className="btn btnPrimary"
              onClick={() => {
                setExpandedSection(null);
                requestExportMp4();
              }}
              style={{ marginTop: 8, width: "100%" }}
            >
              Export MP4
            </button>
          </div>
        )}
      </div>

      {/* HTML Export */}
      <div className="exportGroup">
        <button
          className="btn btnSm"
          onClick={() => {
            try {
              exportSceneAsHTML();
            } catch (err) {
              alert(`Failed to export HTML: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          disabled={isExporting}
          title="Export scene as self-contained HTML"
        >
          🌐 HTML
        </button>
      </div>

      {/* FPS Selection */}
      <div className="exportGroup">
        <span className="exportLabel">FPS</span>
        <div className="segmented" style={{ minWidth: 90 }}>
          {([24, 30, 60] as const).map((fps) => (
            <button
              key={fps}
              className={global.recordingFps === fps ? "active" : ""}
              onClick={() => setGlobal({ recordingFps: fps })}
              disabled={isRecording}
            >
              {fps}
            </button>
          ))}
        </div>
      </div>

      {/* Reset on start toggle */}
      <div className="exportGroup">
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={global.recordingResetOnStart}
            onChange={(e) => setGlobal({ recordingResetOnStart: e.target.checked })}
            disabled={isRecording}
          />
          <span className="small">Reset</span>
        </label>
      </div>
    </div>
  );
}
