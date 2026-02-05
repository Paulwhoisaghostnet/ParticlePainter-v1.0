import { useState } from "react";
import { useStudioStore } from "../state/store";
import { getFrameBuffer } from "../engine/FrameBuffer";
import { quickExportGif, quickExportWebM } from "../engine/QuickExport";

interface MintModalProps {
  onClose: () => void;
}

interface MintSuccess {
  opHash: string;
  explorerUrl: string;
}

export function MintModal({ onClose }: MintModalProps) {
  const [editions, setEditions] = useState(1);
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState<"gif" | "webm">("gif");
  const [isMinting, setIsMinting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<MintSuccess | null>(null);

  const global = useStudioStore((s) => s.global);
  const walletAddress = useStudioStore((s) => s.walletAddress);
  const gifWorkerUrl = new URL("gif.js/dist/gif.worker.js", import.meta.url).toString();

  const handleMint = async () => {
    if (!walletAddress) {
      setError("Wallet not connected");
      return;
    }

    if (!description.trim()) {
      setError("Please provide a description");
      return;
    }

    setIsMinting(true);
    setError(null);
    setProgress("Preparing file for export...");

    try {
      // Get frames from buffer
      const buffer = getFrameBuffer();
      const frames = buffer.getFrames();

      if (frames.length === 0) {
        throw new Error("No frames in buffer. Enable buffer and wait for frames to accumulate.");
      }

      // Export file based on selected type
      let fileBlob: Blob;
      let fileName: string;
      let mimeType: string;

      setProgress(`Exporting ${fileType.toUpperCase()}...`);

      if (fileType === "gif") {
        fileBlob = await quickExportGif(frames, undefined, gifWorkerUrl);
        fileName = `particle-${Date.now()}.gif`;
        mimeType = "image/gif";
      } else {
        // Try to include audio if available
        let audioStream: MediaStream | null = null;
        if (global.audioUrl) {
          try {
            const Tone = await import("tone");
            const audioCtx = Tone.context.rawContext;
            if (audioCtx && audioCtx instanceof AudioContext) {
              const dest = audioCtx.createMediaStreamDestination();
              Tone.getDestination().connect(dest);
              audioStream = dest.stream;
            }
          } catch (err) {
            console.warn("Could not capture audio:", err);
          }
        }
        fileBlob = await quickExportWebM(frames, { audioStream });
        fileName = `particle-${Date.now()}.webm`;
        mimeType = "video/webm";
      }

      // Lazy load services
      const { walletService } = await import("../services/walletService");
      const { teiaService } = await import("../services/teiaService");

      // Get Tezos toolkit from wallet service
      const tezos = walletService.getTezos();
      if (!tezos) {
        throw new Error("Tezos toolkit not initialized");
      }

      // Mint on Teia - returns MintResult with opHash and explorerUrl
      const mintResult = await teiaService.mint(
        tezos,
        {
          editions,
          description,
          fileBlob,
          fileName,
          mimeType,
        },
        walletAddress,
        (msg) => setProgress(msg)
      );

      // Hard guard: Only show success if we have a valid opHash
      if (!mintResult.opHash) {
        throw new Error("Mint did not return an operation hash. The transaction was not broadcast.");
      }

      setSuccess({
        opHash: mintResult.opHash,
        explorerUrl: mintResult.explorerUrl,
      });
      setProgress("");
    } catch (err) {
      console.error("Minting failed:", err);
      setError(err instanceof Error ? err.message : "Failed to mint");
      setProgress("");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Mint to Teia</h2>

          {!success ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                  File Type
                </label>
                <div className="segmented">
                  <button
                    className={fileType === "gif" ? "active" : ""}
                    onClick={() => setFileType("gif")}
                    disabled={isMinting}
                  >
                    GIF
                  </button>
                  <button
                    className={fileType === "webm" ? "active" : ""}
                    onClick={() => setFileType("webm")}
                    disabled={isMinting}
                  >
                    WebM
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                  Number of Editions
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={editions}
                  onChange={(e) => setEditions(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isMinting}
                  style={{
                    width: "100%",
                    padding: 8,
                    fontSize: 14,
                    borderRadius: 4,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isMinting}
                  placeholder="Describe your artwork..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: 8,
                    fontSize: 14,
                    borderRadius: 4,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff",
                    resize: "vertical",
                  }}
                />
              </div>

              {progress && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: "rgba(68, 136, 255, 0.2)",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {progress}
                </div>
              )}

              {error && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: "rgba(255, 61, 90, 0.2)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#ff3d5a",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btnPrimary"
                  onClick={handleMint}
                  disabled={isMinting}
                  style={{ flex: 1 }}
                >
                  {isMinting ? "Minting..." : "Mint NFT"}
                </button>
                <button className="btn" onClick={onClose} disabled={isMinting}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "rgba(34, 197, 94, 0.2)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#22c55e",
                  wordBreak: "break-word",
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  ✓ Mint Successful!
                </div>
                <div style={{ marginBottom: 8 }}>
                  Operation Hash: <code style={{ fontSize: 11 }}>{success.opHash}</code>
                </div>
                <a
                  href={success.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#22c55e",
                    textDecoration: "underline",
                  }}
                >
                  View on TzKT Explorer →
                </a>
              </div>
              <button className="btn btnPrimary" onClick={onClose} style={{ width: "100%" }}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
