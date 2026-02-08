# Particle Studio User Manual 📖

A comprehensive guide to using Particle Studio for creating stunning particle-based visual effects.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Creating Layers](#creating-layers)
4. [Particle Types](#particle-types)
5. [Physics & Forces](#physics--forces)
6. [Movement Patterns](#movement-patterns)
7. [Spawn Regions](#spawn-regions)
8. [Appearance Settings](#appearance-settings)
9. [Color Options](#color-options)
10. [Masks](#masks)
11. [Material System](#material-system)
12. [Audio Reactivity](#audio-reactivity)
13. [Boundary Modes](#boundary-modes)
14. [Exporting](#exporting)
15. [Tips & Tricks](#tips--tricks)

---

## Getting Started

### First Launch

When you first open Particle Studio, you'll see a welcome popup with quick instructions. Click "Get Started" to begin creating.

### Adding Your First Layer

1. Click **"+ Add"** in the left panel
2. Select a **Layer Kind**: Foreground, Background, Mask, or Directed Flow
3. Choose a **Particle Type**: Sand, Dust, Sparks, Ink, Crumbs, or Liquid
4. Click **"Create Layer"**

Particles will immediately begin simulating on the canvas!

### Basic Controls

| Action | How |
|--------|-----|
| Pause/Resume | Press `Space` or click "⏸ Pause" |
| Reset Particles | Press `R` or click "Reset" |
| Switch Layers | Click layer tabs at the top of the left panel |

---

## Interface Overview

### Left Panel - Physics & Motion

Controls for particle behavior:
- **Layer Settings**: Name, enable/disable, particle type
- **Particle Count**: 50 to 20,000 particles per layer
- **Spawn**: Density and initial velocity
- **Lifecycle**: Accumulation and decay rates
- **Forces**: Gravity, drag, jitter, curl
- **Wind**: Direction and strength
- **Attract**: Single attraction point settings
- **Spawn Region**: Where particles appear
- **Movement Pattern**: Intrinsic motion behavior
- **Boundary**: How particles interact with canvas edges

### Right Panel - Render & Appearance

Controls for visual styling:
- **Global**: Time scale, exposure, background fade
- **Visual**: Monochrome, invert
- **Audio**: Upload and control audio reactivity
- **Particle**: Shape, size, brightness, jitter options
- **Color**: Single, gradient, scheme, or range modes
- **Material System**: Advanced depth and surface effects

### Export Bar (Bottom)

- Screenshot (PNG)
- GIF Export (3-6.66 seconds)
- WebM Recording
- MP4 with Audio

---

## Creating Layers

### Layer Kinds

| Kind | Description |
|------|-------------|
| **Foreground** | Standard particle layer rendered on top |
| **Background** | Particles rendered behind other layers |
| **Mask** | Define boundaries using uploaded images |
| **Directed Flow** | Particles follow defined flow paths |

### Managing Layers

- **Reorder**: Use ↑/↓ buttons to change layer order
- **Enable/Disable**: Toggle visibility without deleting
- **Import/Export**: Save and load layer settings as JSON

---

## Particle Types

Each type has unique physics characteristics:

| Type | Weight | Behavior |
|------|--------|----------|
| **Sand** | Heavy | Falls quickly, clings to surfaces |
| **Dust** | Very Light | Floats, easily blown by wind |
| **Sparks** | Light | Rises upward, erratic motion |
| **Ink** | Medium | Follows flow field patterns |
| **Crumbs** | Variable | Breaks on collision |
| **Liquid** | Medium | Droplets with cohesion, pools |

---

## Physics & Forces

### Gravity
- **Range**: -0.5 to 1.0
- **Negative values**: Particles rise (like sparks, bubbles)
- **Positive values**: Particles fall (like sand, rain)

### Mass Jitter
- **Range**: 0 to 1
- Adds variation to how particles respond to gravity and forces
- Higher values create more varied particle weights

### Velocity Scale
- **Range**: 0 to 2
- Multiplies all particle velocities

### Drag
- **Range**: 0 to 0.5
- Air resistance - higher values slow particles faster

### Jitter
- **Range**: 0 to 1
- Random movement added each frame
- Creates organic, chaotic motion

### Curl
- **Range**: 0 to 1
- Flow field strength for swirling patterns

---

## Movement Patterns

### Still
No intrinsic movement - particles only respond to forces (gravity, wind, etc.)

### Linear
Move in a constant direction.
- **Direction**: 0-360° (0=right, 90=up, 180=left, 270=down)

### Wave
Sinusoidal oscillating motion.
- **Cardinal Direction**: Click ←↑→↓ buttons for quick direction setting
- **Angle Slider**: Fine-tune wave travel direction (0-360°)
- **Amplitude**: Height of the wave (0-0.5)
- **Frequency**: How many wave cycles (0.5-5)

### Spiral
Particles spiral inward or outward from a center point.
- **Center X/Y**: Position of spiral center
- **Tightness**: Negative spirals outward, positive spirals inward

### Orbit
Circular motion around a center point.
- **Center X/Y**: Orbit center position
- **Radius**: Distance from center

### Radial Out / Radial In
Expand outward from or contract toward center.

### Vortex
Spinning drain effect.
- **Rotation**: Rotational strength
- **Inward Pull**: How strongly particles are pulled to center

### Brownian
Random walk - enhanced jitter for chaotic motion.

### Follow Curl
Particles follow the curl noise flow field.

### Evade
Particles flee from each other when nearby.
- **Evade Strength**: How strongly particles repel
- **Evade Radius**: Detection distance for nearby particles

### Clusters
Particles bind together in groups.
- **Cluster Strength**: Bond strength between particles
- **Break Threshold**: Force required to break cluster bonds
- **Cluster by Size**: Only same-sized particles cluster
- **Cluster by Color**: Only same-colored particles cluster
- **Cluster by Brightness**: Only similar brightness particles cluster

---

## Spawn Regions

Control where particles appear:

| Region | Description |
|--------|-------------|
| **Random** | Anywhere on canvas |
| **Top/Bottom/Left/Right Edge** | Along canvas edges |
| **Off-Canvas (Top/Bottom/Left/Right)** | Just outside canvas for rain/rise effects |
| **Center** | Spawn from canvas center |
| **Center Burst** | Burst outward from center |
| **Within Mask** | Only inside mask area |
| **Mask Edge** | Along mask boundaries |

**Parameters:**
- **Edge Offset**: Distance from edge for off-canvas spawn
- **Spread**: Distribution along the spawn edge
- **Burst Speed**: Initial velocity for center burst

---

## Appearance Settings

### Shape
8 particle shapes available:
- ● Dot, ★ Star, — Dash, ∼ Tilde
- ■ Square, ◆ Diamond, ○ Ring, ✚ Cross

### Point Size
- **Range**: 0.5 to 64 pixels
- **Size Min/Max Offset**: -6 to +6 variation

### Jitter Options
All jitter ranges are 0 to 2 (doubled from previous versions):
- **Size Jitter**: Random variation in particle size
- **Brightness Jitter**: Random variation in brightness
- **Scale Jitter**: Random scaling variation
- **Rotation Jitter**: Random rotation (0-360°)
- **Color Jitter**: Random hue variation

### Other
- **Trail Stretch**: Velocity-based elongation (0-1)
- **Dither**: Adds noise/texture (0-1)

---

## Color Options

### Color Modes

| Mode | Description |
|------|-------------|
| **Single** | One solid color |
| **Gradient** | Blend between 2-3 colors |
| **Scheme** | Preset color palettes (Warm, Cool, Earth, Neon, Mono) |
| **Range** | Random colors within HSL range |

---

## Masks

Masks define boundaries for particle behavior.

### Creating Masks
1. Add a new layer with kind "Mask"
2. Upload a black & white image
3. **Black areas** = inside boundary
4. **White areas** = outside boundary

### Mask Options
- **Invert Mask**: Flip inside/outside
- **Threshold**: Sensitivity for edge detection
- **Show Mask**: Display mask overlay in red (for debugging)

### Mask Modes
- **Ignore**: Particles pass through
- **Visibility**: Mask controls visibility only
- **Collision**: Particles bounce off boundaries
- **Accumulate**: Particles stick to boundaries

### Mask Transform
Pan, scale, rotate, and skew the mask image.

### Mask Eraser
Draw on the mask to erase portions:
1. Click "Erase" to activate eraser mode
2. Draw on the preview to remove mask areas
3. Click "Done" when finished
4. Click "Clear" to reset eraser

---

## Material System

The Material System adds 2.5D/3D effects to particle simulations, creating depth and dimension.

### Depth Field (2.5D)

The Depth Field feature uses mask luminance to create a height map that particles can interact with.

**How it works:**
- Brighter areas in the mask = higher elevation
- Darker areas = lower elevation  
- Particles roll down slopes from bright to dark areas

**Setup:**
1. Create a mask layer with an uploaded image
2. Open the "Material System" section in the right panel
3. Enable "Depth Field (2.5D)"
4. Adjust depth parameters:
   - **Depth blur** (0-10): Smoothing passes for the height map
   - **Depth curve** (0.1-3.0): Gamma curve for height mapping
   - **Depth scale** (0-1): Height multiplier (strength of the effect)
   - **Invert depth**: Flip high/low areas

**Tips:**
- Use images with gradual gradients for smooth slopes
- Higher depth scale = steeper slopes
- Combine with gravity for natural rolling behavior
- Works best with collision or accumulate mask modes

### Ground Plane

The Ground Plane creates a tilted invisible surface that particles interact with.

**Setup:**
1. Open the "Ground Plane" section in the right panel
2. Enable "Enable ground plane"
3. Adjust parameters:
   - **Tilt angle** (0-90°): Angle of the ground plane measured from horizontal (0° = flat/horizontal, 90° = vertical wall)
   - **Y position** (0-1): Vertical position of the plane (0 = top of canvas, 1 = bottom)

**How it works:**
- Particles near the ground plane experience a downhill force
- The force is stronger when closer to the plane (within 0.3 units)
- Particles naturally roll downhill based on the tilt angle
- Collisions use material properties for bounce and stickiness

**Tips:**
- Use with gravity to simulate particles rolling down a slope
- Combine with depth field for complex terrain
- Adjust boundary bounce for different surface behaviors
- Higher tilt angles create steeper slopes

---

## Audio Reactivity

### Setup
1. Click "Upload MP3" in the Audio section
2. Click "Play" to start audio
3. Configure audio mappings per layer

### Audio Sources
- **Amplitude**: Overall volume level
- **Bass**: Low frequency energy
- **Mid**: Middle frequency energy
- **Treble**: High frequency energy
- **Beat**: Beat detection
- **Brightness**: Spectral brightness
- **Centroid**: Spectral centroid

### Mapping Parameters
Each layer can map audio sources to:
- Spawn Rate
- Gravity
- Point Size
- Color Intensity
- Speed
- Curl
- Jitter
- Wind Strength

### Audio Gain
- **Range**: 0 to 3
- Multiplies audio reactivity sensitivity
- Higher values = more responsive particles

---

## Boundary Modes

How particles interact with canvas edges:

| Mode | Behavior |
|------|----------|
| **Respawn** | Reappear inside canvas |
| **Bounce** | Reflect off boundaries |
| **Wrap** | Exit one side, enter opposite |
| **Stick** | Stop at boundary |
| **Destroy** | Remove particle at boundary |
| **Slow Bounce** | Gradually slow down and bounce |

**Bounce Amount**: 0-1 (how much velocity is preserved)

---

## Exporting

### Screenshot (PNG)
- Click "Screenshot" for instant capture
- Full resolution (2048x2048)

### GIF Export
- Duration options: 1s, 3s, 4.2s, 5s, 6.66s
- Click "Export GIF" and wait for processing
- Automatically downloads when complete

### WebM Recording
- Click "Record" to start
- Click "Stop" to finish and download
- Duration options: Manual, 5s, 15s, 30s, 60s

### MP4 with Audio
- Upload audio file first
- Click "MP4" to export
- Options: 15s, 30s, 60s, or full audio length

### Rolling Buffer
- Enable for instant recent capture
- Saves last N seconds continuously
- Quick export of past moments

---

## Tips & Tricks

### Creating Rain Effects
1. Set Spawn Region to "Off-Canvas Top"
2. Use Sand or Liquid particle type
3. Set Gravity to positive (0.3-0.5)
4. Add slight Wind for diagonal rain

### Fire/Sparks Effects
1. Use Sparks type (naturally rises)
2. Set Spawn Region to "Bottom Edge"
3. Add high Jitter (0.5+)
4. Use warm color scheme

### Flowing Water
1. Use Liquid or Ink type
2. Set Movement Pattern to "Follow Curl"
3. Increase Curl value (0.5-0.8)
4. Add masks for riverbanks

### Flocking/Swarming
1. Use Movement Pattern "Evade" 
2. Low Evade Strength (0.1-0.2)
3. Add a weak attraction point
4. Particles will cluster loosely

### Creating Seamless Loops
1. Enable "Loop Mode" in recording settings
2. Set loop duration to match export duration
3. Simulation will wrap smoothly

### Performance Tips
- Start with fewer particles (1000-5000)
- Disable unused layers
- Close other browser tabs
- Use lower particle counts for GIF exports

---

## Troubleshooting

### Particles Not Visible
- Check layer is enabled
- Increase Point Size
- Increase Brightness
- Check Spawn Region isn't outside canvas

### Simulation Too Slow
- Reduce Particle Count
- Close other browser tabs
- Disable Material System features

### Export Fails
- Try shorter duration
- Reduce particle count
- Use WebM instead of GIF for longer clips

### Audio Not Working
- Check browser audio permissions
- Try a different audio file format (MP3 recommended)
- Click Play button after upload

---

## Keyboard Reference

| Key | Action |
|-----|--------|
| `Space` | Pause/Resume |
| `R` | Reset particles |

---

*Happy creating!* ✨🎨
