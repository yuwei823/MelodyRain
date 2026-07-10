# MelodyRain Vibe Coding Requirements Document

**Project Code:** MelodyRain  
**Version:** v1.1  
**Date:** 2026-07-10  
**Goal:** Input MuseScore.com URL, output 30-60 second sheet music animation video

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Input/Output Definition](#2-inputoutput-definition)
3. [Core Pipeline Architecture](#3-core-pipeline-architecture)
4. [Technology Stack Selection](#4-technology-stack-selection)
5. [Module Detailed Requirements](#5-module-detailed-requirements)
6. [Configuration File Format](#6-configuration-file-format)
7. [CLI Interface](#7-cli-interface)
8. [Directory Structure](#8-directory-structure)
9. [Dependency List](#9-dependency-list)
10. [Key Algorithm Pseudocode](#10-key-algorithm-pseudocode)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Vibe Coding Execution Guide](#12-vibe-coding-execution-guide)

---

## 1. Project Overview

> **One-sentence description:** Input a MuseScore.com URL, output a 30-60 second sheet music animation video: notes fall from above and flash, finally freeze on the complete sheet music frame, with dream particle effects throughout.

### Scene Description

1. **Background Audio:** Pop song piano audio (from MuseScore.com MIDI/MP3 or user-provided audio)
2. **Note Animation:** As notes sound, notes fall from above, flash colors, and land in the correct staff interval
3. **Duration:** 30 seconds to 1 minute, completing a relatively complete musical segment
4. **Dream Effects:** Along with music melody and emotion, animations occur on the video - flowers, clouds, stars, rainbows, vortexes, curves, staff floating, etc.
5. **Final Freeze:** The final frame freezes on the completed sheet music

### Core Constraints

- **Repetitive Demand:** This is a serialized production demand, must use scripts/automation, reject manual operations
- **Cost Control:** Prioritize open source solutions, AI video generation only as background material supplement
- **Music Sync Precision:** Note falling and audio time deviation < 16ms (about 1 frame @ 60fps)
- **Style Consistency:** Different videos maintain unified visual language, switch styles through emotion templates
- **Source Quality:** Use human-typeset sheet music from MuseScore.com rather than MIDI reverse-engineering

---

## 2. Input/Output Definition

### 2.1 Input

```yaml
input:
  musescore_url: "https://musescore.com/user/12345/scores/67890"  # Required: MuseScore.com score URL
  audio_source: "auto"     # Optional: auto, file, or none
  audio_file: "song.mp3"   # Optional: User-provided audio file
  config: "config.json"    # Optional: Style template, effect parameters
  segment: "auto"          # Optional: auto, [start, end], or full
```

**MuseScore.com URL Requirements:**
- Must be a valid MuseScore.com score URL format
- Score must be publicly accessible (Public Domain or Creative Commons preferred)
- Score must contain at least one instrument part (piano preferred)
- Score should have reasonable typesetting quality (human-edited preferred)

### 2.2 Output

```yaml
output:
  video_file: "output.mp4"        # Main output: 1080p 60fps H.264
  duration: "30-60s"              # Auto-crop based on segment
  final_frame: "sheet_music.png"  # Final freeze frame HD image (4K)
  intermediate:
    - "sheet_frames/*.png"
    - "note_layer.mov"
    - "effects_layer.mov"
    - "score.musicxml"
    - "score.midi"
    - "score.pdf"
    - "note_positions.json"
```

**Output Video Specifications:**
- Resolution: 1920 x 1080
- Frame rate: 60 fps
- Video codec: H.264 (libx264), CRF 18
- Audio codec: AAC (libfdk_aac), 320 kbps
- Container: MP4
- Color space: sRGB

---

## 3. Core Pipeline Architecture

The entire system is divided into 6 stages, must be executed in strict order.

```
Stage 0: Resource Acquisition (Resource Downloader)
  - Input: MuseScore.com URL
  - Use dl-librescore to download: MusicXML + MIDI + PDF + MP3
  - Validate: Check score exists, accessible, contains piano part
  - Output: score.musicxml, score.midi, score.pdf, score.mp3

Stage 1: Sheet Parser and Coordinate Extractor (Sheet Parser)
  - Parse MusicXML with music21 -> Extract note list with precise coordinates
  - Parse MIDI -> Extract timing information (start_time, duration, velocity)
  - Merge: Combine MusicXML visual coordinates + MIDI timing data
  - Use PDF/PNG as staff background image (human-typeset quality)
  - Output: note_positions.json + sheet_background.png + final_sheet.png

Stage 2: Note Animation (Note Animator)
  - Based on merged timing data, notes fall from screen top y=-100
  - Fall target: Precise (x, y) coordinates from MusicXML parsing
  - On arrival: Flash once (white halo -> fade)
  - Physics: Spring elastic buffer (reference Pianola implementation)
  - Output: Transparent background note layer video (RGBA MOV)

Stage 3: Dream Effects (Dream Effects)
  - Particle system: Stars, light points, note trails
  - Curve animation: Rainbow, vortex, ribbons
  - Natural elements: Flower growth, cloud drift
  - Staff floating: Sine wave displacement + breathing opacity
  - Output: Effects layer video (RGBA MOV)

Stage 4: Compositor (Compositor)
  - Layer order: Background -> Staff (PDF/PNG) -> Notes -> Particles -> Curves -> Natural elements
  - Audio sync: Ensure note falling and audio precise alignment (+-16ms tolerance)
  - Final freeze: Last 2 seconds fade out animation, freeze on complete staff frame
  - Output: Final MP4 (H.264, 1080p60, AAC audio)

Stage 5: Cleanup (optional, configurable)
  - Remove intermediate files to save space
  - Upload output to cloud storage (if configured)
  - Generate thumbnail and metadata
```

### Stage Data Flow

```
Stage 0: MuseScore URL
    |
    +-- dl-librescore --> score.musicxml + score.midi + score.pdf + score.mp3
    |
    +------> Stage 1: music21 parses MusicXML -> note list with (x, y)
    |              +-- MIDI timing merged -> note_positions.json
    |              +-- PDF rendered -> sheet_background.png (4K)
    |              +-- PDF first page -> final_sheet.png (4K freeze frame)
    |
    +------> Stage 2: Note Animator -> note_layer.mov (RGBA)
    |
    +------> Stage 3: Dream Effects -> effects_layer.mov (RGBA)
    |
    +------> Stage 4: Compositor -> output.mp4 (final video)
    |
    +------> Stage 5: Cleanup -> upload to cloud, delete intermediates
```

---

## 4. Technology Stack Selection

**Confirmed, no substitutions.** Selection based on maturity, open source license, community activity, music data compatibility.

| Layer | Technology | Purpose | Selection Reason | License |
|-------|-----------|---------|------------------|---------|
| **Resource Download** | dl-librescore | Download MusicXML/MIDI/PDF/MP3 from MuseScore.com | MIT license, supports CLI, no login required for public scores | MIT |
| **Sheet Parsing** | music21 | Parse MusicXML, extract notes with coordinates | Most mature Python music theory library, direct MusicXML support | BSD/LGPL |
| **Coordinate Extraction** | OpenSheetMusicDisplay (OSMD) | Render MusicXML to SVG, extract precise (x, y) coordinates | Built on VexFlow, outputs SVG with exact element positions | MIT |
| **Note Animation** | Pianola (modified) | Note falling physics animation | Existing Spring physics model, Python+GLSL, MIT license | MIT |
| **Effects Rendering** | GLSL Shaders + PyOpenGL/Three.js | Particles, curves, floating effects | Strong controllability, batch processing, GPU acceleration | MIT |
| **Video Composition** | FFmpeg + MoviePy | Layered composition, audio embedding | Industry standard, script-friendly, frame-accurate | LGPL/GPL |
| **Main Script** | Python 3.10+ | Pipeline orchestration, config management | Rich ecosystem, AI assistant friendly | - |
| **PDF Processing** | PyMuPDF (fitz) | Render PDF pages to PNG, extract text/metadata | Fast, high-quality PDF rendering, supports 4K output | AGPL/Commercial |

### Alternative Comparison

| Scenario | Primary | Alternative | Reason for not choosing |
|----------|---------|-------------|------------------------|
| Resource download | dl-librescore | Manual download | Automation required for batch processing |
| Sheet parsing | music21 + OSMD | VexFlow direct | music21 provides music theory analysis, OSMD provides precise SVG coordinates |
| Coordinate extraction | OSMD SVG parsing | Self-built renderer | OSMD already handles complex MusicXML layout, beams, ties |
| Note animation | Pianola | Self-built Canvas 2D | Pianola has mature Spring physics, low modification cost |
| Effects | GLSL Shader | After Effects script | AE scripts cannot batch unattended, cost uncontrollable |
| Composition | FFmpeg | Premiere Pro | PR cannot script batch processing |
| Mood analysis | music21 + self-built rules | librosa | Rule engine sufficient, avoid ML dependency |

---

## 5. Module Detailed Requirements

Each module must include: input definition, output definition, core algorithm, error handling, unit tests.

---

### Module 1: Resource Downloader (src/resource_downloader.py)

**Responsibility:** Download MusicXML, MIDI, PDF, and MP3 from MuseScore.com using dl-librescore.

#### Input

```python
download_score(musescore_url: str, output_dir: str, formats: List[str] = ["musicxml", "midi", "pdf", "mp3"]) -> DownloadResult
```

#### Output

```python
@dataclass
class DownloadResult:
    musicxml_path: str      # Path to downloaded MusicXML file
    midi_path: str          # Path to downloaded MIDI file
    pdf_path: str           # Path to downloaded PDF file
    mp3_path: str           # Path to downloaded MP3 file (if available)
    score_info: ScoreInfo   # Metadata about the score
    success: bool           # Whether all requested formats were downloaded
    errors: List[str]       # List of errors for failed downloads
    
@dataclass
class ScoreInfo:
    title: str              # Score title
    composer: str         # Composer name
    arranger: str         # Arranger name (if any)
    duration: float       # Total duration in seconds (from MIDI)
    measures: int         # Number of measures
    parts: List[str]      # List of instrument parts
    has_piano: bool       # Whether piano part exists
    license: str          # License type (Public Domain, CC-BY, etc.)
    uploader: str         # MuseScore uploader username
    page_count: int       # Number of pages in PDF
```

#### Core Algorithm

**dl-librescore Integration:**

```python
import subprocess
import os

def download_with_librescore(url: str, output_dir: str, formats: List[str]) -> Dict[str, str]:
    # Use dl-librescore CLI to download score files from MuseScore.com
    # Supported formats: musicxml, midi, pdf, mp3, mscz
    downloaded = {}
    
    for fmt in formats:
        try:
            result = subprocess.run(
                ["npx", "dl-librescore@latest", url, 
                 "--format", fmt, 
                 "--output", output_dir],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                downloaded[fmt] = find_file_in_dir(output_dir, fmt)
            else:
                downloaded[fmt] = None
                log.error(f"Failed to download {fmt}: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            log.error(f"Download timeout for {fmt}")
            downloaded[fmt] = None
            
    return downloaded
```

**Score Validation:**

```python
def validate_score(downloaded: Dict[str, str]) -> ValidationResult:
    # Validate downloaded score files
    # Checks: MusicXML valid, MIDI has notes, PDF has pages, piano part exists,
    #         duration reasonable (30s-10min), license allows usage
    pass
```

#### Error Handling

- `InvalidURLError`: URL is not a valid MuseScore.com URL -> Prompt user with correct format
- `ScoreNotFoundError`: Score does not exist or is private -> Suggest alternative scores
- `DownloadTimeoutError`: Download exceeds 120 seconds -> Retry with exponential backoff
- `FormatNotAvailableError`: Requested format not available -> Download available formats, continue with degraded functionality
- `NoPianoPartError`: Score does not contain piano part -> Allow user to specify which part to animate, or skip
- `CopyrightRestrictedError`: Score is All Rights Reserved -> Suggest Public Domain alternatives

#### Unit Test Requirements

- Test valid MuseScore.com URL download (Public Domain score)
- Test invalid URL handling
- Test private score handling
- Test format availability fallback
- Test score validation (piano part detection)

---

### Module 2: Sheet Parser and Coordinate Extractor (src/sheet_parser.py)

**Responsibility:** Parse MusicXML with music21, extract note coordinates with OSMD, merge with MIDI timing data.

#### Input

```python
parse_sheet(musicxml_path: str, midi_path: str, pdf_path: str, 
            target_part: str = "piano", output_dir: str = "./output/") -> ParseResult
```

#### Output

```python
@dataclass
class ParseResult:
    notes: List[VisualNote]         # Notes with visual + timing data
    staff_image_path: str           # Path to rendered staff background PNG
    final_sheet_path: str           # Path to 4K freeze frame PNG
    note_positions_json: str        # Path to note_positions.json
    measure_map: List[MeasureInfo]  # Measure boundaries and info
    
@dataclass
class VisualNote:
    # Visual properties (from MusicXML via OSMD)
    x: float                        # X coordinate on staff (pixels)
    y: float                        # Y coordinate on staff (pixels)
    width: float                  # Note head width (pixels)
    height: float                 # Note head height (pixels)
    page: int                     # Page number (1-indexed)
    measure: int                  # Measure number (1-indexed)
    beat: float                   # Beat within measure (1.0 = first beat)
    staff_line: int               # Staff line number
    
    # Musical properties (from MusicXML)
    pitch: int                      # MIDI note number (0-127)
    note_name: str                # Note name (e.g., "C4", "F#5")
    duration: float               # Duration in quarter notes
    
    # Timing properties (from MIDI)
    start_time: float             # Start time in seconds
    end_time: float               # End time in seconds
    velocity: int                   # MIDI velocity (0-127)
    
    # Animation properties (computed)
    color: Tuple[int, int, int]   # RGB color based on pitch and velocity
    approach_time: float          # Time when note starts falling (start_time - 1.5s)
    
@dataclass
class MeasureInfo:
    number: int                     # Measure number
    start_x: float                # X coordinate of measure start
    end_x: float                  # X coordinate of measure end
    start_time: float             # Start time in seconds
    end_time: float               # End time in seconds
```

#### Core Algorithm

**Step 1: Parse MusicXML with music21**

```python
from music21 import converter, stream

def parse_musicxml(musicxml_path: str) -> stream.Score:
    # Parse MusicXML file with music21
    # Extracts: notes with pitch, duration, measure, beat
    #           key signature, time signature, tempo
    #           part list (instruments)
    score = converter.parse(musicxml_path)
    
    key = score.analyze('key')
    tempo = score.metronomeMarkBoundaries()[0][2] if score.metronomeMarkBoundaries() else 120
    
    # Extract notes from target part (e.g., piano)
    target_part = None
    for part in score.parts:
        if 'piano' in part.partName.lower() or 'keyboard' in part.partName.lower():
            target_part = part
            break
    
    if not target_part:
        target_part = score.parts[0]  # Fallback to first part
    
    notes = []
    for note in target_part.recurse().notes:
        notes.append({
            'pitch': note.pitch.midi,
            'note_name': note.pitch.nameWithOctave,
            'duration': note.duration.quarterLength,
            'measure': note.measureNumber,
            'beat': note.beat,
            'offset': note.offset,
        })
    
    return notes, key, tempo
```

**Step 2: Extract Precise Coordinates with OSMD**

OSMD renders MusicXML to SVG, where each note element has exact x, y attributes. We use a headless browser to load OSMD, render the score, and extract coordinates via JavaScript DOM queries.

```python
from typing import List, Dict
import json

def extract_coordinates_with_osmd(musicxml_path: str) -> List[Dict]:
    # Use OpenSheetMusicDisplay to render MusicXML and extract precise note coordinates
    # Returns: List of {x, y, width, height, pitch, measure, beat, page} for each note
    
    # JavaScript code to run in headless browser
    js_code = """
    async function extractNotes() {
        const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('osmd-container');
        await osmd.load('MUSICXML_PATH');
        await osmd.render();
        
        const notes = [];
        const noteElements = document.querySelectorAll('.vf-note');
        
        noteElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const data = el.dataset;
            
            notes.push({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                pitch: parseInt(data.pitch),
                measure: parseInt(data.measure),
                beat: parseFloat(data.beat),
                page: parseInt(data.page) || 1
            });
        });
        
        return notes;
    }
    
    extractNotes();
    """.replace('MUSICXML_PATH', json.dumps(musicxml_path))
    
    # Run in headless browser (Puppeteer/Playwright)
    # ... implementation details
    
    return notes_with_coordinates
```

**Step 3: Parse MIDI for Timing Data**

```python
import mido

def parse_midi_timing(midi_path: str) -> List[Dict]:
    # Parse MIDI file to extract precise timing information
    # Maps each note_on event to start_time, end_time, velocity
    midi = mido.MidiFile(midi_path)
    
    notes = []
    current_time = 0
    active_notes = {}  # pitch -> {start_time, velocity}
    
    for msg in midi:
        current_time += msg.time
        
        if msg.type == 'note_on' and msg.velocity > 0:
            active_notes[msg.note] = {
                'start_time': current_time,
                'velocity': msg.velocity
            }
        elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
            if msg.note in active_notes:
                note_data = active_notes.pop(msg.note)
                notes.append({
                    'pitch': msg.note,
                    'start_time': note_data['start_time'],
                    'end_time': current_time,
                    'duration': current_time - note_data['start_time'],
                    'velocity': note_data['velocity']
                })
    
    return notes
```

**Step 4: Merge Visual + Timing Data**

```python
def merge_note_data(visual_notes: List[Dict], timing_notes: List[Dict]) -> List[VisualNote]:
    # Merge visual coordinates (from MusicXML/OSMD) with timing data (from MIDI)
    # Matching strategy:
    # 1. Sort both lists by pitch, then by start time
    # 2. For each visual note, find closest MIDI note with same pitch and similar start time
    # 3. Handle polyphony (multiple notes with same pitch at different times)
    # 4. Handle ornaments (grace notes, trills) - match to closest main note
    
    visual_sorted = sorted(visual_notes, key=lambda n: (n['pitch'], n.get('beat', 0)))
    timing_sorted = sorted(timing_notes, key=lambda n: (n['pitch'], n['start_time']))
    
    merged = []
    v_idx = 0
    t_idx = 0
    
    while v_idx < len(visual_sorted) and t_idx < len(timing_sorted):
        v_note = visual_sorted[v_idx]
        t_note = timing_sorted[t_idx]
        
        if v_note['pitch'] == t_note['pitch']:
            # Match found - create VisualNote
            merged.append(VisualNote(
                x=v_note['x'],
                y=v_note['y'],
                width=v_note['width'],
                height=v_note['height'],
                page=v_note.get('page', 1),
                measure=v_note['measure'],
                beat=v_note['beat'],
                staff_line=calculate_staff_line(v_note['pitch']),
                pitch=v_note['pitch'],
                note_name=midi_to_note_name(v_note['pitch']),
                duration=t_note['duration'],
                start_time=t_note['start_time'],
                end_time=t_note['end_time'],
                velocity=t_note['velocity'],
                color=pitch_to_color(v_note['pitch'], t_note['velocity']),
                approach_time=t_note['start_time'] - 1.5
            ))
            v_idx += 1
            t_idx += 1
        elif v_note['pitch'] < t_note['pitch']:
            v_idx += 1
        else:
            t_idx += 1
    
    return merged
```

**Step 5: Render PDF Background**

```python
import fitz  # PyMuPDF

def render_pdf_background(pdf_path: str, output_path: str, dpi: int = 300) -> str:
    # Render PDF sheet music to high-resolution PNG for video background
    # For 1080p video at 60fps:
    # Page width: 1920px -> DPI = 1920 / page_width_inches
    # Typical sheet music page: 8.5 x 11 inches
    # Target DPI: 300 (sufficient for 4K as well)
    doc = fitz.open(pdf_path)
    page = doc[0]  # First page for single-page scores, or all pages
    
    # Render at 4K resolution for high quality
    mat = fitz.Matrix(4, 4)  # 4x zoom for 4K
    pix = page.get_pixmap(matrix=mat)
    pix.save(output_path)
    
    return output_path
```

#### Error Handling

- `MusicXMLParseError`: MusicXML file is corrupted or invalid -> Try to repair with music21, or fallback to MIDI-only mode
- `CoordinateExtractionError`: OSMD fails to render or extract coordinates -> Fallback to music21 estimated coordinates
- `MIDIParseError`: MIDI file is corrupted -> Use MusicXML timing (less precise but functional)
- `PDFRenderError`: PDF cannot be rendered -> Generate staff background with music21/VexFlow
- `NoteMismatchError`: Visual notes and MIDI notes count mismatch -> Use fuzzy matching, log warnings
- `MultiPageError`: Score has multiple pages -> Handle page transitions in animation (scroll or page flip)

#### Unit Test Requirements

- Test MusicXML parsing with various scores (single voice, polyphony, multi-staff)
- Test OSMD coordinate extraction accuracy (compare with manual measurement)
- Test MIDI timing extraction (verify against known tempo)
- Test merge logic with edge cases (ornaments, ties, grace notes)
- Test PDF rendering quality (check resolution and clarity)

---

### Module 3: Note Animator (src/note_animator.py)

**Responsibility:** Based on merged VisualNote data, render notes falling from above to their precise (x, y) coordinates with Spring physics.

#### Input

```python
animate_falling_notes(notes: List[VisualNote], 
                      staff_bounds: Tuple[int, int, int, int],
                      fps: int = 60,
                      duration: float = 30.0,
                      config: AnimationConfig) -> str
```

#### Output

- File path: Transparent background video file (RGBA MOV or PNG sequence)

#### Key Differences from Original Design

**Original (MIDI-only):**
- Notes had estimated y coordinates based on pitch calculation
- x coordinates were evenly distributed across time
- Staff was rendered by VexFlow in real-time

**New (MusicXML + OSMD):**
- Notes have exact (x, y) from human-typeset score
- x coordinates reflect actual horizontal position in measure
- y coordinates reflect actual staff line position
- Staff background is pre-rendered PDF (higher quality)

#### Core Animation Logic

**Note Lifecycle (unchanged):**
```
Birth at start-1.5s -> Fall with Spring physics -> Arrival flash (0.3s) -> Hold at target -> Disappear at start+duration+0.5s
```

**Spring Physics (enhanced with precise coordinates):**

```python
class NoteAnimator:
    def __init__(self, notes: List[VisualNote], staff_bounds: Tuple[int, int, int, int]):
        # staff_bounds: (x1, y1, x2, y2) - The staff area on screen
        self.notes = notes
        self.staff_x1, self.staff_y1, self.staff_x2, self.staff_y2 = staff_bounds
        
    def calculate_falling_path(self, note: VisualNote) -> List[Tuple[float, float]]:
        # Calculate the falling path from above screen to exact (x, y) coordinate
        # Start position: (note.x, y=-100) - same x as target, above screen
        # Target position: (note.x, note.y) - exact coordinate from OSMD
        # Uses Spring physics for natural motion
        spring = SpringState(target_y=note.y)
        path = []
        
        # Simulate physics at 60fps
        dt = 1/60
        for frame in range(int(1.5 * 60)):  # 1.5 seconds approach time
            y = spring.update(dt)
            path.append((note.x, y))
            
            if spring.is_arrived():
                # Fill remaining frames with target position
                while len(path) < int(1.5 * 60):
                    path.append((note.x, note.y))
                break
        
        return path
```

**Color Mapping (unchanged):**
```python
def pitch_to_color(pitch: int, velocity: int) -> Tuple[int, int, int, int]:
    base_hue = 270
    octave = (pitch - 60) // 12
    semitone = (pitch - 60) % 12
    hue = (base_hue + octave * 30 + semitone * 2.5) % 360
    saturation = 30 + (velocity / 127) * 70
    lightness = 40 + (velocity / 127) * 30
    r, g, b = hsl_to_rgb(hue, saturation, lightness)
    return (int(r), int(g), int(b), 255)
```

#### Error Handling

- `AnimationStuckError`: Spring physics not reaching target for 5 seconds -> Force teleport to exact coordinate
- `CoordinateOutOfBoundsError`: Note coordinate outside staff bounds -> Clamp to bounds, log warning
- `RenderPerformanceError`: Single frame render > 50ms -> Degrade to 30fps or simplify effects

---

### Module 4: Dream Effects Engine (src/dream_effects.py)

**Responsibility:** Render particles, curves, natural elements, staff floating based on music emotion.

**Unchanged from original design.** See original document for full specification.

Key integration point: Effects are rendered relative to staff bounds (from PDF rendering), not dynamically generated staff.

---

### Module 5: Mood Analyzer (src/mood_analyzer.py)

**Responsibility:** Automatically analyze MusicXML score, output emotion label for selecting effect presets.

#### Input

```python
analyze_mood(score: stream.Score, notes: List[VisualNote]) -> str
```

#### Enhancements from Original Design

**Additional metrics available from MusicXML (vs MIDI-only):**
- **Articulation patterns**: Staccato, legato, tenuto (from MusicXML notations)
- **Dynamic markings**: pp, p, mp, mf, f, ff (from MusicXML direction elements)
- **Ornament density**: Trills, mordents, turns (from MusicXML ornaments)
- **Texture complexity**: Number of simultaneous voices (from MusicXML voice elements)
- **Harmonic rhythm**: Rate of chord changes (from MusicXML harmony elements)

```python
def analyze_mood_enhanced(score: stream.Score, notes: List[VisualNote]) -> str:
    # Enhanced mood analysis using MusicXML data
    # Additional features:
    # - Dynamic markings (p, mp, f, etc.) -> affects particle intensity
    # - Articulation (staccato vs legato) -> affects curve type
    # - Ornament density -> affects particle density
    # - Texture (monophonic vs polyphonic) -> affects mood classification
    scores = {"lyrical": 0, "joyful": 0, "sad": 0, "dreamy": 0, "epic": 0}
    
    # Original metrics (from MIDI)
    tempo = calculate_tempo(notes)
    pitch_range = max(n.pitch for n in notes) - min(n.pitch for n in notes)
    avg_velocity = sum(n.velocity for n in notes) / len(notes)
    note_density = len(notes) / notes[-1].start_time if notes else 0
    key = score.analyze('key')
    
    # New metrics (from MusicXML)
    dynamics = extract_dynamic_markings(score)
    articulations = extract_articulation_patterns(score)
    ornament_density = calculate_ornament_density(score)
    texture = analyze_texture(score)
    
    # Enhanced scoring with new metrics
    # ... (detailed scoring logic)
    
    return max(scores, key=scores.get)
```

---

### Module 6: Video Compositor (src/compositor.py)

**Responsibility:** Layered composition of all elements, add audio, output final video.

#### Key Difference from Original Design

**Layer 1 (Staff Background):**
- Original: Dynamically rendered PNG sequence from VexFlow
- New: Static PDF-rendered PNG (higher quality, human-typeset)
- Optional: Add subtle page curl or scroll effect for multi-page scores

**Layer 2 (Notes):**
- Original: Notes positioned by estimated coordinates
- New: Notes positioned by exact (x, y) from OSMD/MusicXML

**Final Freeze Frame:**
- Original: Generated by VexFlow/LilyPond
- New: Directly from PDF (first page or complete score)

#### Output Specifications (unchanged)

```python
OUTPUT_SPEC = {
    "format": "mp4",
    "video_codec": "libx264",
    "video_bitrate": "8M",
    "crf": 18,
    "preset": "slow",
    "fps": 60,
    "resolution": (1920, 1080),
    "pixel_format": "yuv420p",
    "audio_codec": "libfdk_aac",
    "audio_bitrate": "320k",
    "audio_sample_rate": 48000,
    "audio_channels": 2,
}
```

---

## 6. Configuration File Format

### 6.1 Default Config (config/default.json)

```json
{
  "project": {
    "name": "MelodyRain",
    "version": "1.1.0"
  },
  "input": {
    "musescore_url": "",
    "audio_source": "auto",
    "audio_file": "",
    "segment": "auto"
  },
  "download": {
    "formats": ["musicxml", "midi", "pdf", "mp3"],
    "timeout": 120,
    "retry_count": 3,
    "preferred_license": ["Public Domain", "CC-BY", "CC-BY-SA"]
  },
  "parsing": {
    "target_part": "auto",
    "coordinate_extraction": "osmd",
    "fallback_to_midi_only": false,
    "dpi": 300
  },
  "style": {
    "mood": "auto",
    "theme": "default",
    "color_palette": "adaptive",
    "particle_intensity": 1.0,
    "curve_complexity": "medium"
  },
  "animation": {
    "fps": 60,
    "resolution": [1920, 1080],
    "duration": "auto",
    "note_approach_time": 1.5,
    "spring_stiffness": 120,
    "spring_damping": 14,
    "spring_mass": 1,
    "flash_duration": 0.3,
    "flash_max_radius": 50,
    "flash_max_alpha": 0.8,
    "final_hold_duration": 1.0,
    "final_fade_duration": 2.0
  },
  "effects": {
    "particles": true,
    "curves": true,
    "nature_elements": true,
    "staff_floating": true,
    "background_gradient": true,
    "glow_bloom": true
  },
  "render": {
    "use_gpu": true,
    "gpu_backend": "auto",
    "parallel_rendering": true,
    "max_workers": 8,
    "cache_intermediate": true,
    "cache_dir": "./cache/",
    "ffthreads": 8,
    "video_codec": "libx264",
    "video_crf": 18,
    "video_preset": "slow",
    "audio_codec": "libfdk_aac",
    "audio_bitrate": "320k"
  },
  "advanced": {
    "headless_browser": "chromium",
    "osmd_version": "1.8.0",
    "shader_quality": "high",
    "particle_max_count": 500,
    "nature_max_count": 20,
    "debug_mode": false,
    "keep_intermediate": false
  }
}
```

---

## 7. CLI Interface

### 7.1 Main Commands

```bash
# One-click generation from MuseScore URL (recommended)
python melodyrain.py --url https://musescore.com/user/12345/scores/67890

# With custom audio
python melodyrain.py --url https://musescore.com/user/12345/scores/67890 --audio my_recording.mp3

# Specify mood
python melodyrain.py --url https://musescore.com/user/12345/scores/67890 --mood dreamy

# Specify segment (start and end in seconds)
python melodyrain.py --url https://musescore.com/user/12345/scores/67890 --segment 30,90

# Batch processing multiple URLs
python melodyrain.py --batch urls.txt --output ./output_folder/ --mood auto
```

### 7.2 Stage-by-stage Execution (for debugging)

```bash
# Stage 0: Download resources
python melodyrain.py --stage download --url https://musescore.com/user/12345/scores/67890 --output ./download/

# Stage 1: Parse sheet and extract coordinates
python melodyrain.py --stage parse --musicxml ./download/score.musicxml --midi ./download/score.midi --pdf ./download/score.pdf --output ./parsed/

# Stage 2: Note animation
python melodyrain.py --stage animate --notes ./parsed/note_positions.json --output ./note_layer.mov

# Stage 3: Effects rendering
python melodyrain.py --stage effects --notes ./parsed/note_positions.json --mood dreamy --output ./effects_layer.mov

# Stage 4: Compose output
python melodyrain.py --stage compose --sheet ./parsed/sheet_background.png --notes ./note_layer.mov --effects ./effects_layer.mov --audio ./download/score.mp3 --output ./final.mp4
```

### 7.3 Complete CLI Parameter List

| Parameter | Short | Type | Default | Description |
|-----------|-------|------|---------|-------------|
| `--url` | `-u` | str | Required | MuseScore.com score URL |
| `--audio` | `-a` | str | auto | Audio source: auto, file path, or none |
| `--output` | `-o` | str | ./output/ | Output directory |
| `--mood` | `-m` | str | auto | Mood label |
| `--segment` | `-s` | str | auto | Video segment: auto, [start,end], or full |
| `--stage` |  | str | all | Execution stage: download, parse, animate, effects, compose, all |
| `--batch` | `-b` | str |  | Batch processing file (one URL per line) |
| `--config` | `-c` | str | config/default.json | Config file path |
| `--preview` | `-p` | flag | False | Preview mode (low quality fast) |
| `--sheet-only` |  | flag | False | Generate only final sheet image |
| `--analyze` |  | flag | False | Analyze mood only |
| `--clean-cache` |  | flag | False | Clean cache |
| `--version` | `-v` | flag | False | View version |
| `--help` | `-h` | flag | False | View help |
| `--debug` |  | flag | False | Debug mode |
| `--quiet` | `-q` | flag | False | Quiet mode |
| `--workers` | `-w` | int | 8 | Parallel workers |

---

## 8. Directory Structure

```
melodyrain/
├── melodyrain.py                # Main entry script
├── config/
│   ├── default.json             # Default config
│   ├── preview.json             # Preview mode config
│   └── production.json          # Production mode config
├── templates/                   # Mood templates
│   ├── lyrical.json
│   ├── joyful.json
│   ├── sad.json
│   ├── dreamy.json
│   └── epic.json
├── src/                         # Source code
│   ├── __init__.py
│   ├── resource_downloader.py   # Module 1: Download from MuseScore
│   ├── sheet_parser.py          # Module 2: Parse MusicXML + extract coordinates
│   ├── note_animator.py         # Module 3: Note falling animation
│   ├── dream_effects.py         # Module 4: Dream effects
│   ├── mood_analyzer.py         # Module 5: Mood analysis
│   ├── compositor.py            # Module 6: Video composition
│   ├── cli.py                   # CLI interface
│   └── utils/
│       ├── __init__.py
│       ├── color_utils.py
│       ├── spring_physics.py
│       ├── ffmpeg_wrapper.py
│       ├── shader_compiler.py
│       ├── progress_bar.py
│       ├── logger.py
│       └── exceptions.py
├── js/                          # JavaScript helpers
│   ├── osmd_extract.js          # OSMD coordinate extraction script
│   └── render_sheet.js          # VexFlow fallback rendering
├── assets/                      # Pre-rendered resources
│   ├── nature/
│   │   ├── flowers/
│   │   ├── petals/
│   │   ├── clouds/
│   │   ├── stars/
│   │   ├── rain/
│   │   └── leaves/
│   └── shaders/
│       ├── common.glsl
│       ├── particles.frag
│       ├── curves.frag
│       ├── gradient.frag
│       ├── nature.frag
│       └── main.frag
├── tests/                       # Unit tests
│   ├── __init__.py
│   ├── test_resource_downloader.py
│   ├── test_sheet_parser.py
│   ├── test_note_animator.py
│   ├── test_dream_effects.py
│   ├── test_mood_analyzer.py
│   ├── test_compositor.py
│   └── fixtures/
│       ├── test_musicxml/
│       │   ├── c_major_score.xml
│       │   ├── twinkle_twinkle.xml
│       │   └── complex_polyphony.xml
│       └── expected/
├── cache/                       # Cache directory
│   ├── downloads/               # Downloaded scores
│   ├── parsed/                  # Parsed note data
│   ├── rendered/                # Rendered frames
│   └── effects/                 # Effect layers
├── output/                      # Output directory
│   └── [project_name]/
│       ├── sheet_frames/
│       ├── note_layer.mov
│       ├── effects_layer.mov
│       ├── final.mp4
│       └── sheet_music.png
├── docs/
│   ├── architecture.md
│   ├── api_reference.md
│   └── troubleshooting.md
├── requirements.txt
├── requirements-dev.txt
├── setup.py
├── pyproject.toml
├── README.md
├── LICENSE
└── .gitignore
```

---

## 9. Dependency List

### 9.1 Python Dependencies (requirements.txt)

```
# Core dependencies
mido>=1.3.0                     # MIDI parsing (for timing)
music21>=9.1.0                  # MusicXML parsing, music theory analysis
PyMuPDF>=1.23.0                 # PDF rendering (fitz)

# Video processing
moviepy>=1.0.3                  # Video composition
ffmpeg-python>=0.2.0            # FFmpeg wrapper

# Image processing
numpy>=1.24.0
Pillow>=10.0.0
opencv-python>=4.8.0

# GPU acceleration
PyOpenGL>=3.1.7
PyOpenGL-accelerate>=3.1.7

# Audio analysis
librosa>=0.10.0
pydub>=0.25.1

# Browser automation (for OSMD coordinate extraction)
selenium>=4.15.0
webdriver-manager>=4.0.0
playwright>=1.40.0              # Alternative to Selenium for OSMD

# Utility libraries
tqdm>=4.66.0
colorama>=0.4.6
click>=8.1.0
pydantic>=2.0.0
pyyaml>=6.0.0
requests>=2.31.0                # For API calls if needed

# Logging
loguru>=0.7.0
```

### 9.2 JavaScript Dependencies (js/package.json)

```json
{
  "dependencies": {
    "opensheetmusicdisplay": "^1.8.0",
    "vexflow": "^4.0.3"
  }
}
```

### 9.3 System Dependencies

| Dependency | Minimum Version | Purpose | Installation |
|------------|-----------------|---------|--------------|
| FFmpeg | 6.0 | Video encoding | apt install ffmpeg |
| Node.js | 18.0 | dl-librescore, OSMD | apt install nodejs |
| dl-librescore | latest | MuseScore download | npm install -g dl-librescore |
| Chrome/Chromium | 110 | Headless OSMD rendering | apt install chromium-browser |
| OpenGL | 3.3 | Shader effects | Included with driver |
| CUDA (optional) | 11.8 | GPU acceleration | NVIDIA driver |

---

## 10. Key Algorithm Pseudocode

### 10.1 Main Pipeline Control Flow

```python
def main(config_path: str):
    # 1. Load config
    config = load_config(config_path)
    
    # 2. Stage 0: Download resources from MuseScore
    downloaded = download_score(
        url=config.musescore_url,
        output_dir=config.cache_dir + "/downloads/",
        formats=config.download.formats
    )
    
    if not downloaded.success:
        raise ResourceDownloadError(downloaded.errors)
    
    # 3. Stage 1: Parse sheet and extract coordinates
    parsed = parse_sheet(
        musicxml_path=downloaded.musicxml_path,
        midi_path=downloaded.midi_path,
        pdf_path=downloaded.pdf_path,
        target_part=config.parsing.target_part,
        output_dir=config.cache_dir + "/parsed/"
    )
    
    # 4. Analyze mood (if auto)
    if config.mood == "auto":
        mood = analyze_mood(parsed.score, parsed.notes)
    else:
        mood = config.mood
    
    # 5. Load mood template
    mood_config = load_mood_template(mood)
    config = merge_config(config, mood_config)
    
    # 6. Stage 2: Note animation
    note_video = animate_falling_notes(
        notes=parsed.notes,
        staff_bounds=parsed.staff_bounds,
        fps=config.fps,
        duration=config.duration
    )
    
    # 7. Stage 3: Effects rendering
    effects_video = render_effects(
        notes=parsed.notes,
        mood=mood,
        fps=config.fps,
        duration=config.duration
    )
    
    # 8. Stage 4: Compose output
    final_video = compose_video(
        sheet_image=parsed.staff_image_path,
        note_video=note_video,
        effects_video=effects_video,
        audio_path=downloaded.mp3_path or config.audio_file,
        final_sheet=parsed.final_sheet_path,
        output_path=config.output_path,
        duration=config.duration
    )
    
    # 9. Stage 5: Cleanup (if configured)
    if not config.keep_intermediate:
        clean_intermediate_files(config.cache_dir)
    
    return final_video
```

### 10.2 Coordinate Extraction with OSMD

```python
def extract_osmd_coordinates(musicxml_path: str) -> List[Dict]:
    # Use OSMD in headless browser to extract precise note coordinates
    # Returns: List of {x, y, width, height, pitch, measure, beat, page}
    from playwright.sync_api import sync_playwright
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Load OSMD HTML page with MusicXML
        page.goto(f"file://{osmd_html_path}?xml={musicxml_path}")
        
        # Wait for rendering
        page.wait_for_selector('.vf-note', timeout=30000)
        
        # Extract coordinates via JavaScript
        notes = page.evaluate("""
            () => {
                const notes = [];
                document.querySelectorAll('.vf-note').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    notes.push({
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        pitch: parseInt(el.dataset.pitch),
                        measure: parseInt(el.dataset.measure),
                        beat: parseFloat(el.dataset.beat)
                    });
                });
                return notes;
            }
        """)
        
        browser.close()
        return notes
```

### 10.3 PDF Background Rendering

```python
def render_pdf_for_video(pdf_path: str, output_dir: str, resolution: Tuple[int, int] = (1920, 1080)):
    # Render PDF pages to PNG sequence for video background
    # For single-page scores: Render once, use as static background
    # For multi-page scores: Render each page, add scroll/page-turn animation
    import fitz
    
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    
    for i, page in enumerate(doc):
        # Calculate zoom to fit target resolution
        page_rect = page.rect
        zoom_x = resolution[0] / page_rect.width
        zoom_y = resolution[1] / page_rect.height
        zoom = min(zoom_x, zoom_y) * 2  # 2x for 4K quality
        
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        pix.save(f"{output_dir}/page_{i:04d}.png")
    
    return page_count
```

---

## 11. Acceptance Criteria

### 11.1 Functional Acceptance

| ID | Acceptance Item | Acceptance Method | Pass Standard |
|----|-----------------|-------------------|---------------|
| F-01 | MuseScore download | Test with 10 different scores | All formats downloaded successfully for public scores |
| F-02 | MusicXML parsing | Parse 10 different scores | 100% correct parsing of notes, measures, parts |
| F-03 | Coordinate extraction | Compare OSMD coordinates with manual measurement | Deviation < 2px for 95% of notes |
| F-04 | MIDI timing merge | Verify against known tempo | Time deviation < 16ms |
| F-05 | PDF background | Render and inspect | 4K resolution, clear notation, no artifacts |
| F-06 | Note animation | Check falling and landing | Precise landing on exact (x, y) coordinates |
| F-07 | Audio sync | Use waveform comparison | Note falling and audio deviation < 16ms |
| F-08 | Mood recognition | Test with 20 songs | Accuracy > 80% |
| F-09 | Batch processing | Submit 10 URLs | All successful, no crashes |
| F-10 | Output specs | MediaInfo check | 1920x1080, 60fps, H.264, AAC 320k |

### 11.2 Quality Acceptance (New)

| ID | Acceptance Item | Acceptance Method | Pass Standard |
|----|-----------------|-------------------|---------------|
| Q-07 | Sheet music quality | Compare with original MuseScore PDF | Staff background matches original layout |
| Q-08 | Note positioning | Overlay animation on original PDF | Notes land exactly on original note heads |
| Q-09 | Multi-page handling | Test with 3+ page scores | Smooth page transition or scroll |
| Q-10 | License compliance | Check output metadata | Contains attribution if required by license |

---

## 12. Vibe Coding Execution Guide

### 12.1 Key Changes from v1.0 to v1.1

| Aspect | v1.0 (MIDI-only) | v1.1 (MusicXML from MuseScore) |
|--------|------------------|--------------------------------|
| **Input** | MIDI file | MuseScore.com URL |
| **Source quality** | Machine-generated (MIDI reverse) | Human-typeset (MusicXML) |
| **Coordinate accuracy** | Estimated (VexFlow render) | Exact (OSMD SVG extraction) |
| **Staff background** | VexFlow real-time render | PDF pre-render (higher quality) |
| **Final freeze frame** | LilyPond/VexFlow generate | PDF direct export |
| **Mood analysis** | MIDI metrics only | MusicXML + MIDI enhanced metrics |
| **Dependencies** | VexFlow, LilyPond | dl-librescore, OSMD, PyMuPDF |
| **Offline capability** | Yes (local MIDI) | No (requires MuseScore.com access) |
| **Copyright risk** | Low (user-created MIDI) | Medium (depends on score license) |

### 12.2 System Prompt Template (Updated)

```
You are a professional multimedia development engineer, proficient in Python, JavaScript, GLSL Shader, FFmpeg, and music processing.

Current project: MelodyRain - Music Sheet Animation Video Generator

Technology Stack:
- Python 3.10+ (main control, music parsing, physics simulation, composition)
- dl-librescore (MuseScore.com resource download)
- music21 + OpenSheetMusicDisplay (MusicXML parsing, coordinate extraction)
- PyMuPDF (PDF rendering)
- Pianola (Spring physics note animation)
- GLSL Shaders + PyOpenGL/Three.js (dream effects)
- FFmpeg + MoviePy (video composition)

Key Architecture:
1. Download MusicXML + MIDI + PDF from MuseScore.com
2. Parse MusicXML with music21 for musical structure
3. Extract precise (x, y) coordinates with OSMD SVG rendering
4. Merge with MIDI timing data
5. Use PDF as high-quality staff background
6. Animate notes falling to exact coordinates
7. Compose with effects and audio

Development Principles:
1. Strictly follow module division and interface definitions
2. Each module must include complete type annotations
3. Each module must include unit tests (pytest)
4. Error handling must cover all exception classes
5. Performance priority: use numpy vectorization, GPU acceleration, cache intermediate results
6. Code style: Black formatting, Google style docstring

Current Task: Please implement [module name]
Input Definition: [from requirements document]
Output Definition: [from requirements document]
Core Algorithm: [from requirements document]

Please generate complete module code first, then generate corresponding unit test file.
```

---

**Document Version:** v1.1  
**Last Updated:** 2026-07-10  
**Maintainer:** [TBD]

---

*This document is written using Vibe Coding methodology, can be directly used as System Prompt and task decomposition input for AI programming assistants.*
