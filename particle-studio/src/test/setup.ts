import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock WebGL context if needed (basic stub)
HTMLCanvasElement.prototype.getContext = (() => {
  return {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: (x: number, y: number, w: number, h: number) => {
      return {
        data: new Uint8ClampedArray(w * h * 4)
      };
    },
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => {
      return { width: 0 };
    },
    transform: () => {},
    rect: () => {},
    clip: () => {},
  };
}) as any;

// Mock MediaRecorder
global.MediaRecorder = class MediaRecorder {
    state = "inactive";
    stream: MediaStream;
    mimeType: string;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;

    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onpause: ((event: Event) => void) | null = null;
    onresume: ((event: Event) => void) | null = null;
    onstart: ((event: Event) => void) | null = null;
    onstop: ((event: Event) => void) | null = null;

    constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        this.stream = stream;
        this.mimeType = options?.mimeType || "";
        this.videoBitsPerSecond = options?.videoBitsPerSecond;
        this.audioBitsPerSecond = options?.audioBitsPerSecond;
    }

    start() {
        this.state = "recording";
        this.onstart?.(new Event("start"));
    }
    stop() {
        this.state = "inactive";
        this.onstop?.(new Event("stop"));
    }
    pause() {
        this.state = "paused";
        this.onpause?.(new Event("pause"));
    }
    resume() {
        this.state = "recording";
        this.onresume?.(new Event("resume"));
    }
    requestData() {}

    static isTypeSupported() { return true; }
} as any;
