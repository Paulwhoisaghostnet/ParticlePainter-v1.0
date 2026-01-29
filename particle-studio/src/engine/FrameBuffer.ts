/**
 * Rolling Frame Buffer for Quick Export
 * 
 * Maintains a circular buffer of recent canvas frames for instant replay exports.
 * Uses ImageData storage with configurable resolution scaling to balance
 * memory usage vs quality.
 * 
 * Memory estimation (at "low" quality - 512x512):
 * - Each frame ~1MB RGBA
 * - 5 seconds at 24fps = 120 frames = ~120MB
 * - This is manageable for modern browsers
 */

export type BufferedFrame = {
  timestamp: number;
  imageData: ImageData;
};

export type FrameBufferConfig = {
  enabled: boolean;
  durationSeconds: number; // How many seconds to buffer (2-10)
  fps: number; // Target FPS for buffer capture (15-30)
  quality: "low" | "medium" | "high"; // Resolution scale
};

// Quality presets with resolution scaling
const QUALITY_SCALE = {
  low: 0.25,    // 512x512 from 2048x2048
  medium: 0.5,  // 1024x1024 from 2048x2048
  high: 1.0,    // Full resolution (memory intensive!)
} as const;

export const DEFAULT_BUFFER_CONFIG: FrameBufferConfig = {
  enabled: false, // Disabled by default to avoid memory overhead
  durationSeconds: 5,
  fps: 24,
  quality: "low",
};

export class FrameBuffer {
  private frames: BufferedFrame[] = [];
  private maxFrames: number = 0;
  private config: FrameBufferConfig;
  private lastCaptureTime: number = 0;
  private captureInterval: number = 0;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private targetWidth: number = 0;
  private targetHeight: number = 0;

  constructor(config: FrameBufferConfig = DEFAULT_BUFFER_CONFIG) {
    this.config = { ...config };
    this.updateConfig(config);
  }

  updateConfig(config: Partial<FrameBufferConfig>) {
    const wasEnabled = this.config.enabled;
    const oldQuality = this.config.quality;
    this.config = { ...this.config, ...config };
    
    // Recalculate max frames
    this.maxFrames = Math.ceil(this.config.durationSeconds * this.config.fps);
    this.captureInterval = 1000 / this.config.fps;
    
    // If disabled, clear the buffer
    if (!this.config.enabled) {
      this.clear();
    }
    
    // If quality changed, clear buffer to ensure consistent frame dimensions
    if (config.quality && config.quality !== oldQuality) {
      this.clear();
    }
    
    // If newly enabled, reset last capture time
    if (!wasEnabled && this.config.enabled) {
      this.lastCaptureTime = 0;
    }
  }

  /**
   * Initialize the offscreen canvas based on source canvas dimensions
   */
  private initOffscreenCanvas(sourceWidth: number, sourceHeight: number) {
    const scale = QUALITY_SCALE[this.config.quality];
    this.targetWidth = Math.floor(sourceWidth * scale);
    this.targetHeight = Math.floor(sourceHeight * scale);
    
    // Only recreate if dimensions changed
    if (this.offscreenCanvas?.width !== this.targetWidth || 
        this.offscreenCanvas?.height !== this.targetHeight) {
      this.offscreenCanvas = new OffscreenCanvas(this.targetWidth, this.targetHeight);
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
        willReadFrequently: true, // Optimize for frequent getImageData calls
      });
    }
  }

  /**
   * Capture a frame from the canvas if enough time has passed
   * Call this in the render loop
   */
  captureFrame(canvas: HTMLCanvasElement): boolean {
    if (!this.config.enabled) return false;
    
    const now = performance.now();
    
    // Check if enough time has passed since last capture
    if (now - this.lastCaptureTime < this.captureInterval) {
      return false;
    }
    
    this.lastCaptureTime = now;
    
    // Initialize or resize offscreen canvas if needed
    this.initOffscreenCanvas(canvas.width, canvas.height);
    
    if (!this.offscreenCtx || !this.offscreenCanvas) return false;
    
    try {
      // Draw scaled-down version of canvas
      this.offscreenCtx.drawImage(
        canvas,
        0, 0, canvas.width, canvas.height,
        0, 0, this.targetWidth, this.targetHeight
      );
      
      // Get image data (this is the expensive operation)
      const imageData = this.offscreenCtx.getImageData(
        0, 0, this.targetWidth, this.targetHeight
      );
      
      // Add to circular buffer
      this.frames.push({
        timestamp: now,
        imageData,
      });
      
      // Maintain max size (circular buffer behavior)
      while (this.frames.length > this.maxFrames) {
        this.frames.shift();
      }
      
      return true;
    } catch {
      // Canvas might be in a state where we can't read it
      return false;
    }
  }

  /**
   * Get all buffered frames
   */
  getFrames(): BufferedFrame[] {
    return [...this.frames];
  }

  /**
   * Get the last N seconds of frames
   */
  getRecentFrames(seconds: number): BufferedFrame[] {
    if (this.frames.length === 0) return [];
    
    const now = performance.now();
    const cutoff = now - (seconds * 1000);
    
    return this.frames.filter(f => f.timestamp >= cutoff);
  }

  /**
   * Get buffer statistics for UI display
   */
  getStats(): {
    frameCount: number;
    maxFrames: number;
    durationMs: number;
    memoryEstimateMB: number;
    isEnabled: boolean;
    quality: string;
  } {
    const frameSize = this.targetWidth * this.targetHeight * 4; // RGBA
    const memoryBytes = this.frames.length * frameSize;
    
    let durationMs = 0;
    if (this.frames.length >= 2) {
      durationMs = this.frames[this.frames.length - 1].timestamp - this.frames[0].timestamp;
    }
    
    return {
      frameCount: this.frames.length,
      maxFrames: this.maxFrames,
      durationMs,
      memoryEstimateMB: Math.round(memoryBytes / (1024 * 1024) * 10) / 10,
      isEnabled: this.config.enabled,
      quality: this.config.quality,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): FrameBufferConfig {
    return { ...this.config };
  }

  /**
   * Check if buffer has enough frames for export
   */
  hasFrames(): boolean {
    return this.frames.length > 0;
  }

  /**
   * Get the resolution of buffered frames
   */
  getResolution(): { width: number; height: number } {
    return {
      width: this.targetWidth,
      height: this.targetHeight,
    };
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.frames = [];
    this.lastCaptureTime = 0;
  }

  /**
   * Destroy and release resources
   */
  destroy() {
    this.clear();
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }
}

// Singleton instance for global access
let frameBufferInstance: FrameBuffer | null = null;

export function getFrameBuffer(): FrameBuffer {
  if (!frameBufferInstance) {
    frameBufferInstance = new FrameBuffer();
  }
  return frameBufferInstance;
}

export function initFrameBuffer(config: FrameBufferConfig): FrameBuffer {
  if (frameBufferInstance) {
    frameBufferInstance.updateConfig(config);
  } else {
    frameBufferInstance = new FrameBuffer(config);
  }
  return frameBufferInstance;
}
