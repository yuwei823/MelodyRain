# MelodyRain Hardware Requirements Specification

**Version:** v1.0  
**Date:** 2026-07-09  
**Project:** MelodyRain Music Sheet Animation Video Generator

---

## Table of Contents

1. [Overview](#1-overview)
2. [Minimum Configuration](#2-minimum-configuration)
3. [Recommended Configuration](#3-recommended-configuration)
4. [High Performance Configuration](#4-high-performance-configuration)
5. [Hardware Requirements by Stage](#5-hardware-requirements-by-stage)
6. [Operating System Compatibility](#6-operating-system-compatibility)
7. [Storage Requirements](#7-storage-requirements)
8. [Network Requirements](#8-network-requirements)
9. [Scaling and Upgrade Recommendations](#9-scaling-and-upgrade-recommendations)
10. [Cost Estimation](#10-cost-estimation)

---

## 1. Overview

MelodyRain is a multimedia rendering pipeline involving the following compute-intensive tasks:
- MIDI parsing and music analysis (CPU light)
- Sheet music rendering (CPU + memory, VexFlow headless Chrome)
- Note falling animation (CPU/GPU, Spring physics simulation + 2D rendering)
- Dream effects (GPU heavy, GLSL Shader particle/curve systems)
- Video composition (CPU heavy, FFmpeg multi-threaded encoding)

**Hardware bottleneck priority:** GPU VRAM > CPU multi-core performance > Memory capacity > Disk I/O > Network

---

## 2. Minimum Configuration

For: Single video testing, development debugging, preview mode, low-resolution output (720p30)

| Component | Specification | Notes |
|-----------|-------------|-------|
| **CPU** | 4 cores 8 threads, 2.5 GHz | Intel i5-8400 / AMD Ryzen 5 2600 equivalent |
| **Memory** | 8 GB DDR4 | System + browser + render cache |
| **GPU** | Integrated graphics / GTX 1050 2GB | No Shader effects or CPU fallback |
| **VRAM** | 2 GB | Basic 2D rendering only |
| **Storage** | 256 GB SSD | System + project files + cache |
| **Disk I/O** | SATA SSD, 500 MB/s sequential read | Frame sequence read/write |
| **Display** | 1080p, 60 Hz | Debug preview |
| **Network** | 10 Mbps | Dependency downloads, updates |

**Minimum configuration performance expectations:**
- 720p30 video: ~15-20 minutes per 30-second clip
- 1080p60 video: ~40-60 minutes per 30-second clip (not recommended)
- Preview mode: ~2-3 minutes per 30-second clip
- Memory peak: ~6 GB
- VRAM peak: ~1.5 GB (shared memory for integrated graphics)

**Limitations:**
- Cannot enable GLSL Shader effects (auto downgrade to CPU Canvas 2D)
- Particle count limited to 100
- Cannot render multiple videos in parallel
- Preview mode recommended to disable real-time preview window

---

## 3. Recommended Configuration

For: Daily production, 1080p60 standard output, batch processing (5-10 video queue)

| Component | Specification | Notes |
|-----------|-------------|-------|
| **CPU** | 8 cores 16 threads, 3.5 GHz | Intel i7-12700 / AMD Ryzen 7 5800X equivalent |
| **Memory** | 32 GB DDR4-3200 | 16GB system + 16GB render cache |
| **GPU** | RTX 3060 12GB / RX 6700 XT 12GB | CUDA/OpenCL/ROCm support |
| **VRAM** | 12 GB GDDR6 | Shader effects + frame buffer |
| **Storage** | 1 TB NVMe SSD | High-speed frame sequence read/write |
| **Disk I/O** | NVMe Gen3, 3000 MB/s sequential read | Optimized for many small files |
| **Display** | 1440p, 144 Hz | Dual-screen debugging (code + preview) |
| **Network** | 100 Mbps | Dependency downloads, resource updates |

**Recommended configuration performance expectations:**
- 1080p60 video: ~3-5 minutes per 30-second clip
- 60-second video: ~6-10 minutes
- Batch processing: 10 videos/hour (queue mode)
- Memory peak: ~20 GB
- VRAM peak: ~8 GB
- GPU utilization: 60-80%

### CPU Requirements (8 cores 16 threads)
- **8 cores 16 threads**: FFmpeg encoding uses 8 threads, remaining cores handle MIDI parsing and VexFlow rendering
- **AVX2 support**: Accelerates numpy vector operations and Spring physics simulation
- **High single-core frequency**: Benefits VexFlow single-threaded rendering

### GPU Requirements (RTX 3060 12GB)
- **12GB VRAM**: Accommodates 1080p60 frame buffer (1920x1080x4x60fps = ~500MB/s) + Shader textures + particle data
- **3584 CUDA cores**: Accelerates PyOpenGL and Shader computation
- **NVENC**: Hardware H.264 encoding, reduces CPU burden (optional enable)
- **OpenGL 3.3+**: Supports all GLSL Shader features

### Memory Requirements (32GB)
- **System + browser**: 4-6 GB (Chrome headless multiple instances)
- **Frame sequence cache**: 10-15 GB (1080p60 30 seconds = ~11GB raw frames)
- **Effects rendering**: 5-8 GB (particle system + Shader textures)
- **Reserved**: 5 GB (safety margin + other applications)

### Storage Requirements (1TB NVMe)
- **System + software**: 100 GB
- **Project files**: 200 GB (MIDI, audio, output videos)
- **Cache directory**: 400 GB (frame sequences, intermediate files, cleanable)
- **Pre-rendered resources**: 100 GB (nature element PNG sequences, Shader cache)
- **Reserved**: 200 GB (safety margin)

---

## 4. High Performance Configuration

For: 4K output, real-time preview, batch factory mode (50+ videos/day), commercial production

| Component | Specification | Notes |
|-----------|-------------|-------|
| **CPU** | 16 cores 32 threads, 4.0 GHz+ | Intel i9-13900K / AMD Ryzen 9 7950X equivalent |
| **Memory** | 64 GB DDR5-5600 | Large cache + multi-task parallel processing |
| **GPU** | RTX 4090 24GB / RTX 4080 16GB | Flagship rendering performance |
| **VRAM** | 24 GB GDDR6X | 4K frame buffer + complex Shaders |
| **Storage** | 2 TB NVMe Gen4 + 4 TB HDD | High-speed cache + large capacity archive |
| **Disk I/O** | NVMe Gen4, 7000 MB/s sequential read | Ultimate frame sequence read/write |
| **Display** | 4K, 144 Hz + 1080p auxiliary screen | Multi-screen workflow |
| **Network** | 1 Gbps | Resource downloads, cloud backup |
| **Extra** | 10 GbE NAS (optional) | Network storage, team collaboration |

**High performance configuration performance expectations:**
- 1080p60 video: ~1-2 minutes per 30-second clip
- 4K60 video: ~3-5 minutes per 30-second clip
- Batch factory mode: 50+ videos/day (24/7 continuous)
- Memory peak: ~40 GB
- VRAM peak: ~18 GB
- GPU utilization: 80-95%

### CPU Requirements (16 cores 32 threads)
- **FFmpeg encoding**: 16 threads available, 2-3x encoding speed improvement
- **Parallel rendering**: Process 2-3 videos Stage 1-3 simultaneously
- **DDR5 memory**: High bandwidth accelerates frame data transfer

### GPU Requirements (RTX 4090 24GB)
- **24GB VRAM**: Supports 4K rendering + complex particle systems (500+ particles)
- **16384 CUDA cores**: 3-4x Shader computation speed
- **DLSS/FSR**: Optional for preview mode acceleration
- **Multi-GPU support**: Can scale to 2x RTX 4090 (requires code modification)

### Storage Architecture
- **NVMe Gen4 2TB**: System + active projects + cache (high-speed read/write)
- **HDD 4TB**: Archive output videos, historical projects, backups
- **NAS (optional)**: Team collaboration, shared resource library

---

## 5. Hardware Requirements by Stage

### Stage 0: MIDI Parsing (Light)

| Resource | Minimum | Recommended | High Performance |
|----------|---------|-------------|------------------|
| CPU | 1 core | 2 cores | 4 cores |
| Memory | 100 MB | 200 MB | 500 MB |
| GPU | None | None | None |
| Time | <1 second | <1 second | <1 second |

**Bottleneck:** None, any modern CPU can handle this

### Stage 1: Sheet Rendering (Medium)

| Resource | Minimum | Recommended | High Performance |
|----------|---------|-------------|------------------|
| CPU | 2 cores | 4 cores | 8 cores |
| Memory | 2 GB | 4 GB | 8 GB |
| GPU | None | None | None |
| Time | 30-60 seconds | 10-20 seconds | 5-10 seconds |

**Bottleneck:** VexFlow headless Chrome single-threaded rendering, high-frequency CPU benefits
**Optimization:** Multi-instance parallel rendering (1 Chrome per instance), requires more memory

### Stage 2: Note Animation (Medium-Heavy)

| Resource | Minimum | Recommended | High Performance |
|----------|---------|-------------|------------------|
| CPU | 4 cores | 8 cores | 16 cores |
| Memory | 4 GB | 12 GB | 24 GB |
| GPU | Optional | RTX 3060 | RTX 4090 |
| VRAM | Shared | 8 GB | 20 GB |
| Time | 5-10 minutes | 1-2 minutes | 30-60 seconds |

**Bottleneck:** Large volume of frame 2D/3D rendering, GPU can accelerate 3-5x
**Optimization:** GPU rendering (PyOpenGL/Three.js) vs CPU rendering (Pillow/OpenCV)

### Stage 3: Dream Effects (Heavy)

| Resource | Minimum | Recommended | High Performance |
|----------|---------|-------------|------------------|
| CPU | 4 cores (downgraded) | 8 cores + GPU | 16 cores + GPU |
| Memory | 2 GB (downgraded) | 10 GB | 20 GB |
| GPU | None (CPU fallback) | RTX 3060 | RTX 4090 |
| VRAM | Shared | 10 GB | 22 GB |
| Time | 10-20 minutes (downgraded) | 2-3 minutes | 1-2 minutes |

**Bottleneck:** GLSL Shader real-time rendering, GPU essential
**Fallback:** CPU Canvas 2D simplified effects (reduced particles, no Shader)

### Stage 4: Video Composition (Heavy)

| Resource | Minimum | Recommended | High Performance |
|----------|---------|-------------|------------------|
| CPU | 4 cores | 8 cores | 16 cores |
| Memory | 4 GB | 12 GB | 24 GB |
| GPU | None | NVENC (optional) | NVENC acceleration |
| Disk I/O | 500 MB/s | 3000 MB/s | 7000 MB/s |
| Time | 5-10 minutes | 1-2 minutes | 30-60 seconds |

**Bottleneck:** FFmpeg multi-threaded encoding + large frame file read/write
**Optimization:** NVENC hardware encoding (sacrifices 5-10% quality for 3x speed)

---

## 6. Operating System Compatibility

### 6.1 Officially Supported

| OS | Version | Status | Notes |
|----|---------|--------|-------|
| **Ubuntu** | 22.04 LTS | Primary | Full support, best performance |
| **Ubuntu** | 24.04 LTS | Recommended | Latest LTS, long-term support |
| **macOS** | 14+ (Sonoma) | Supported | Apple Silicon requires adaptation |
| **Windows** | 11 | Supported | WSL2 recommended |
| **Windows** | 10 | Compatible | Some features limited |

### 6.2 Platform-Specific Requirements

**Ubuntu 22.04/24.04:**

```bash
# System dependencies
sudo apt update
sudo apt install -y ffmpeg chromium-browser nodejs npm \
    python3.10 python3.10-dev python3-pip \
    libgl1-mesa-dev libglu1-mesa-dev \
    libopencv-dev libportmidi-dev

# NVIDIA GPU driver (if using NVIDIA GPU)
sudo apt install -y nvidia-driver-535 nvidia-cuda-toolkit
```

**macOS (Apple Silicon M1/M2/M3):**
- Requires Rosetta 2 for x86 dependencies (e.g., Puppeteer Chrome)
- GPU acceleration uses Metal (requires Shader code modification)
- FFmpeg uses Apple VideoToolbox hardware encoding
- Recommended configuration: M3 Pro 18GB unified memory or M3 Max 36GB

```bash
# macOS dependencies
brew install ffmpeg node chromium-browser
brew install python@3.10
pip3 install -r requirements.txt
```

**Windows 11 (WSL2):**
- WSL2 Ubuntu subsystem recommended
- GPU passthrough requires WSL2 + NVIDIA CUDA on WSL
- Or native Windows (requires manual installation of all dependencies)

### 6.3 Containerized Deployment (Docker)

```dockerfile
# Dockerfile
FROM nvidia/cuda:12.0-devel-ubuntu22.04

RUN apt update && apt install -y \
    ffmpeg chromium-browser nodejs npm \
    python3.10 python3-pip \
    libgl1-mesa-dev libglu1-mesa-dev

COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY . /app
WORKDIR /app

ENTRYPOINT ["python3", "MelodyRain.py"]
```

**Docker execution:**
```bash
# CPU mode
docker run -v $(pwd)/input:/input -v $(pwd)/output:/output MelodyRain --config /input/config.json

# GPU mode (NVIDIA Container Toolkit)
docker run --gpus all -v $(pwd)/input:/input -v $(pwd)/output:/output MelodyRain --config /input/config.json
```

---

## 7. Storage Requirements

### 7.1 Single Video Generation Storage Usage

| Resolution | Duration | Intermediate | Final Output | Total | After Cleanup |
|------------|----------|--------------|--------------|-------|---------------|
| 720p30 | 30s | 2.5 GB | 50 MB | 2.55 GB | 50 MB |
| 1080p60 | 30s | 11 GB | 150 MB | 11.15 GB | 150 MB |
| 1080p60 | 60s | 22 GB | 300 MB | 22.3 GB | 300 MB |
| 4K60 | 30s | 44 GB | 500 MB | 44.5 GB | 500 MB |
| 4K60 | 60s | 88 GB | 1 GB | 89 GB | 1 GB |

**Intermediate file composition:**
- Sheet frame sequence: ~40% (PNG sequence)
- Note animation layer: ~30% (RGBA MOV)
- Effects layer: ~25% (RGBA MOV)
- Audio cache: ~5% (WAV temporary files)

### 7.2 Cache Strategy

```python
CACHE_POLICY = {
    "auto_clean": True,
    "keep_last_n": 5,
    "max_cache_size_gb": 100,
    "compress_intermediate": False,
    "cache_dir": "./cache/"
}
```

### 7.3 Long-term Storage Planning

| Scenario | Capacity | Type | Notes |
|----------|----------|------|-------|
| Active projects | 500 GB | NVMe SSD | Currently processing videos |
| Output archive | 2 TB | HDD / NAS | Historical output videos |
| Resource library | 500 GB | SSD / NAS | Nature element PNG, Shaders, templates |
| Backup | 1 TB | Cloud / cold storage | Project files, configs, raw materials |

---

## 8. Network Requirements

### 8.1 Basic Requirements

| Scenario | Bandwidth | Latency | Notes |
|----------|-----------|---------|-------|
| First installation | 100 Mbps | - | Download Python packages, Node.js modules, pre-rendered resources |
| Daily updates | 10 Mbps | - | Dependency updates, template updates |
| Cloud backup | 10 Mbps | - | Upload output videos |
| Team collaboration | 100 Mbps | <50ms | NAS shared resource library |

### 8.2 Offline Mode

MelodyRain supports fully offline operation:
- All dependencies can be pre-downloaded
- Pre-rendered resources can be stored locally
- No cloud API required (unless using AI background generation feature)

**Offline installation package:**
```bash
# Generate offline installation package
python scripts/create_offline_bundle.py --output MelodyRain-offline.tar.gz
# Includes: Python wheels, Node modules, pre-rendered resources, FFmpeg binaries
```

---

## 9. Scaling and Upgrade Recommendations

### 9.1 Horizontal Scaling (Multi-Machine Cluster)

For: Video factory mode, 50+ videos/day

```
Master Node (Scheduling)
    +-- Worker Node 1 (RTX 3060 x2)
    +-- Worker Node 2 (RTX 3060 x2)
    +-- Worker Node 3 (RTX 3060 x2)
    +-- ...
```

**Architecture:**
- Master: Lightweight, responsible for task distribution, result collection
- Worker: Each independently runs complete Pipeline
- Shared storage: NAS or distributed file system (NFS/GlusterFS)

**Cost-effectiveness:**
- 3x RTX 3060 workstations vs 1x RTX 4090 workstation
- 3x RTX 3060: ~$1500 x 3 = $4500, output 3x
- 1x RTX 4090: ~$1600, output 1x
- **Conclusion:** Multiple RTX 3060 machines offer better cost-effectiveness (batch production scenario)

### 9.2 Vertical Scaling (Single Machine Upgrade)

| Upgrade Path | Cost | Performance Gain | Recommendation |
|--------------|------|------------------|----------------|
| RTX 3060 -> RTX 4070 Ti | +$400 | 2x | Best cost-effectiveness |
| RTX 3060 -> RTX 4080 | +$700 | 3x | High performance demand |
| RTX 3060 -> RTX 4090 | +$1000 | 4x | Flagship demand |
| 32GB -> 64GB DDR4 | +$150 | Parallel ability+ | Batch processing priority |
| DDR4 -> DDR5 + new motherboard | +$400 | 10-15% | New build recommendation |
| NVMe Gen3 -> Gen4 | +$100 | 2x sequential read | Large file scenarios |

### 9.3 Cloud Service Options

| Cloud Platform | Instance Type | Cost/Hour | Use Case |
|----------------|---------------|-----------|----------|
| **AWS** | g5.xlarge (A10G 24GB) | $1.2 | Elastic rendering |
| **AWS** | g5.2xlarge (A10G 24GB) | $2.0 | High performance |
| **GCP** | n1-standard-8 + T4 | $0.8 | Low-cost testing |
| **GCP** | a2-highgpu-1g (A100 40GB) | $3.7 | Ultimate performance |
| **Azure** | NC6s v3 (V100 16GB) | $1.1 | Stable production |
| **Alibaba Cloud** | gn7i-c8g1.2xlarge (A10) | 8 RMB | China domestic preferred |
| **AutoDL** | RTX 4090 | 2.5 RMB | China cost-effectiveness |

**Cloud rendering cost estimation (1080p60 30-second video):**
- AWS g5.xlarge: ~$0.15/video (render time 5-8 minutes)
- Alibaba Cloud gn7i: ~1 RMB/video
- Self-built RTX 3060: ~$0.02/video (electricity, render time 3-5 minutes)

**Conclusion:** Long-term batch production recommends self-built, short-term/elastic demand recommends cloud rendering

---

## 10. Cost Estimation

### 10.1 Self-Built Solution (One-time Investment)

| Configuration | Hardware Cost | Monthly Electricity* | 3-Year Total Cost | Suitable For |
|---------------|---------------|----------------------|-------------------|--------------|
| **Minimum** | $500 | $15 | $1040 | Personal testing |
| **Recommended** | $1500 | $30 | $2580 | Small studio |
| **High Performance** | $4000 | $60 | $6160 | Professional studio |
| **Dual-machine cluster** | $3000 | $50 | $4800 | Video factory |
| **5-machine cluster** | $7500 | $120 | $11820 | Large factory |

*Based on 8 hours daily operation, electricity $0.15/kWh

### 10.2 Cloud Solution (Pay-as-you-go)

| Scale | Monthly Output | Cloud Cost/Month | 3-Year Total Cost | Comparison with Self-Built |
|-------|----------------|------------------|-------------------|---------------------------|
| 100 videos/month | 100 | $15 | $540 | Minimum config better |
| 1000 videos/month | 1000 | $150 | $5400 | Recommended config equivalent |
| 5000 videos/month | 5000 | $750 | $27000 | Dual-machine cluster better |
| 20000 videos/month | 20000 | $3000 | $108000 | 5-machine cluster better |

**Break-even point:**
- Minimum config vs Cloud: Self-built better when monthly output > 80 videos
- Recommended config vs Cloud: Self-built better when monthly output > 600 videos
- High performance config vs Cloud: Self-built better when monthly output > 2500 videos

### 10.3 Hybrid Solution (Recommended)

**Architecture:**
- 1x Recommended configuration workstation (daily production, debugging)
- Cloud rendering (elastic peaks, urgent tasks)

**Cost:**
- Hardware: $1500 (one-time)
- Monthly cloud budget: $50-100
- 3-year total cost: ~$3300-5100

**Advantages:**
- Low-cost daily production
- Rapid scaling during peaks
- No need to maintain large clusters
- Suitable for fluctuating demand scenarios

---

## Appendix

### A. Hardware Detection Script

```bash
#!/bin/bash
# check_hardware.sh - Hardware compatibility detection

echo "=== MelodyRain Hardware Detection ==="

# CPU
echo "CPU: $(nproc) cores"
echo "CPU Model: $(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d':' -f2)"

# Memory
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"

# GPU
if command -v nvidia-smi &> /dev/null; then
    echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader)"
    echo "GPU Memory: $(nvidia-smi --query-gpu=memory.total --format=csv,noheader)"
else
    echo "GPU: Not detected (NVIDIA)"
fi

# Storage
echo "Storage: $(df -h / | tail -1 | awk '{print $4}') available"

# FFmpeg
echo "FFmpeg: $(ffmpeg -version | head -1)"

# Python
echo "Python: $(python3 --version)"

# Node.js
echo "Node.js: $(node --version)"

# Chrome
echo "Chrome: $(chromium-browser --version 2>/dev/null || google-chrome --version 2>/dev/null || echo 'Not found')"

echo ""
echo "=== Compatibility Assessment ==="
# Output compatibility rating based on detection results
```

### B. Performance Benchmark

```python
# benchmark.py - Performance benchmark
import time
import psutil

def benchmark_pipeline():
    # Run standard test MIDI, record stage duration and resource usage
    stages = {
        "parse": benchmark_stage_0,
        "render": benchmark_stage_1,
        "animate": benchmark_stage_2,
        "effects": benchmark_stage_3,
        "compose": benchmark_stage_4
    }

    results = {}
    for name, func in stages.items():
        start = time.time()
        cpu_before = psutil.cpu_percent()
        mem_before = psutil.virtual_memory().used

        func()

        elapsed = time.time() - start
        cpu_after = psutil.cpu_percent()
        mem_after = psutil.virtual_memory().used

        results[name] = {
            "time": elapsed,
            "cpu_delta": cpu_after - cpu_before,
            "mem_delta": (mem_after - mem_before) / 1024 / 1024  # MB
        }

    return results
```

### C. Recommended Hardware List (July 2026)

| Component | Model | Price | Purchase Channel |
|-----------|-------|-------|-----------------|
| **CPU** | AMD Ryzen 7 7700X | $300 | Amazon/Newegg |
| **Motherboard** | MSI B650 Tomahawk | $200 | Amazon/Newegg |
| **Memory** | Corsair 32GB DDR5-5600 | $120 | Amazon/Newegg |
| **GPU** | RTX 3060 12GB | $300 | Amazon/Newegg |
| **SSD** | Samsung 980 Pro 1TB | $100 | Amazon/Newegg |
| **PSU** | Corsair RM750x | $130 | Amazon/Newegg |
| **Case** | Fractal Design Meshify 2 | $150 | Amazon/Newegg |
| **Cooling** | Noctua NH-D15 | $100 | Amazon/Newegg |
| **Total** | | **$1400** | |

*Prices are for reference only, July 2026 market prices

---

**Document Version:** v1.0  
**Last Updated:** 2026-07-09  
**Maintainer:** [TBD]

---

*This document is used in conjunction with the MelodyRain Vibe Coding Requirements Document to form a complete project deliverable.*
