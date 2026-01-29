import { useState, useRef, useEffect } from "react";
import { useStudioStore } from "../state/store";
import { getAudioEngine } from "./AudioControls";
import type { GifDuration, WebmDuration, Mp4Duration, BufferQuality } from "../state/types";
import { exportSceneAsHTML } from "../engine/HTMLExporter";
import { getFrameBuffer } from "../engine/FrameBuffer";
import { quickExportGif, quickExportWebM, downloadBlob } from "../engine/QuickExport";

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

  const [expandedSection, setExpandedSection] = useState<"gif" | "webm" | "mp4" | "buffer" | null>(null);
  const [isQuickExporting, setIsQuickExporting] = useState(false);
  const [bufferStats, setBufferStats] = useState({ frameCount: 0, durationMs: 0, memoryEstimateMB: 0 });
  const gifWorkerUrl = useRef<string>(new URL("gif.js/dist/gif.worker.js", import.meta.url).toString());

  const isExporting = isRecording || isGifExporting || isMp4Exporting || isQuickExporting;
  
  // Update buffer stats periodically when buffer is enabled
  useEffect(() => {
    if (!global.bufferEnabled) {
      setBufferStats({ frameCount: 0, durationMs: 0, memoryEstimateMB: 0 });
      return;
    }
    
    const interval = setInterval(() => {
      const stats = getFrameBuffer().getStats();
      setBufferStats({
        frameCount: stats.frameCount,
        durationMs: stats.durationMs,
        memoryEstimateMB: stats.memoryEstimateMB,
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [global.bufferEnabled]);
  
  // Get audio duration once for the MP4 section
  const audioDuration = global.audioUrl ? getAudioEngine().getDuration() : 0;

  const gifDurations: GifDuration[] = [1, 3, 4.2, 5, 6.66];
  const webmDurations: WebmDuration[] = [0, 5, 15, 30, 60];
  const mp4Durations: Mp4Duration[] = [15, 30, 60, -1];
  const bufferDurations = [2, 3, 5, 8, 10];
  const bufferQualities: BufferQuality[] = ["low", "medium", "high"];

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
  
  const handleQuickExportGif = async () => {
    const buffer = getFrameBuffer();
    const frames = buffer.getFrames();
    if (frames.length === 0) {
      alert("No frames in buffer. Enable buffer and wait for frames to accumulate.");
      return;
    }
    
    setIsQuickExporting(true);
    try {
      const blob = await quickExportGif(frames, undefined, gifWorkerUrl.current);
      downloadBlob(blob, `particle-quick-${Date.now()}.gif`);
    } catch (err) {
      alert(`Quick export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsQuickExporting(false);
    }
  };
  
  const handleQuickExportWebM = async () => {
    const buffer = getFrameBuffer();
    const frames = buffer.getFrames();
    if (frames.length === 0) {
      alert("No frames in buffer. Enable buffer and wait for frames to accumulate.");
      return;
    }
    
    setIsQuickExporting(true);
    try {
      const blob = await quickExportWebM(frames);
      downloadBlob(blob, `particle-quick-${Date.now()}.webm`);
    } catch (err) {
      alert(`Quick export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsQuickExporting(false);
    }
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

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />

      {/* Quick Export (from buffer) */}
      <div className="exportGroup">
        <button
          className={`btn btnSm ${expandedSection === "buffer" ? "active" : ""}`}
          onClick={() => setExpandedSection(expandedSection === "buffer" ? null : "buffer")}
          disabled={isExporting}
          title={global.bufferEnabled 
            ? `Buffer: ${Math.round(bufferStats.durationMs / 1000)}s (${bufferStats.memoryEstimateMB}MB)`
            : "Enable buffer for instant replay export"
          }
        >
          ⚡ Quick {global.bufferEnabled && bufferStats.frameCount > 0 && (
            <span style={{ fontSize: 10, opacity: 0.7 }}>({Math.round(bufferStats.durationMs / 1000)}s)</span>
          )}
        </button>
        {expandedSection === "buffer" && (
          <div className="exportDropdown" style={{ minWidth: 200 }}>
            {/* Buffer toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={global.bufferEnabled}
                onChange={(e) => setGlobal({ bufferEnabled: e.target.checked })}
              />
              <span>Enable Rolling Buffer</span>
            </label>
            
            {global.bufferEnabled && (
              <>
                {/* Buffer stats */}
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
                  {bufferStats.frameCount} frames • {Math.round(bufferStats.durationMs / 1000)}s • {bufferStats.memoryEstimateMB}MB
                </div>
                
                {/* Duration selector */}
                <div className="exportDropdownLabel">Buffer Duration</div>
                <div className="segmented segmentedVertical" style={{ marginBottom: 8 }}>
                  {bufferDurations.map((d) => (
                    <button
                      key={d}
                      className={global.bufferDuration === d ? "active" : ""}
                      onClick={() => setGlobal({ bufferDuration: d })}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
                
                {/* Quality selector */}
                <div className="exportDropdownLabel">Quality</div>
                <div className="segmented" style={{ marginBottom: 8 }}>
                  {bufferQualities.map((q) => (
                    <button
                      key={q}
                      className={global.bufferQuality === q ? "active" : ""}
                      onClick={() => setGlobal({ bufferQuality: q })}
                      title={q === "low" ? "512px (fast)" : q === "medium" ? "1024px" : "2048px (slow)"}
                    >
                      {q.charAt(0).toUpperCase() + q.slice(1)}
                    </button>
                  ))}
                </div>
                
                {/* Quick export buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btnPrimary"
                    onClick={() => {
                      setExpandedSection(null);
                      handleQuickExportGif();
                    }}
                    disabled={bufferStats.frameCount === 0 || isQuickExporting}
                    style={{ flex: 1 }}
                  >
                    ⚡ GIF
                  </button>
                  <button
                    className="btn btnPrimary"
                    onClick={() => {
                      setExpandedSection(null);
                      handleQuickExportWebM();
                    }}
                    disabled={bufferStats.frameCount === 0 || isQuickExporting}
                    style={{ flex: 1 }}
                  >
                    ⚡ WebM
                  </button>
                </div>
              </>
            )}
            
            {!global.bufferEnabled && (
              <div className="exportDropdownHint">
                Enable buffer to capture frames for instant export
              </div>
            )}
          </div>
        )}
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
