# MelodyRain Cloud Deployment Guide

**Version:** v1.0  
**Date:** 2026-07-09  
**Project:** MelodyRain Music Sheet Animation Video Generator

---

## Table of Contents

1. [Overview](#1-overview)
2. [Free Tier Options](#2-free-tier-options)
3. [Budget Options](#3-budget-options)
4. [Pay-as-you-go Options](#4-pay-as-you-go-options)
5. [Comparison and Recommendations](#5-comparison-and-recommendations)
6. [Deployment Guides](#6-deployment-guides)
7. [Cost Estimation](#7-cost-estimation)
8. [Limitations and Notes](#8-limitations-and-notes)

---

## 1. Overview

For users who do not want to purchase hardware, MelodyRain supports multiple cloud deployment options ranging from completely free to pay-as-you-go, covering different budgets and usage scenarios.

**Core Principles:**
- Development/testing phase: Prioritize free resources
- Production phase: Choose the most economical paid option based on output volume
- All options support one-click deployment without local hardware

---

## 2. Free Tier Options

### 2.1 Google Colab (Recommended for Development/Testing)

| Item | Specification |
|------|--------------|
| **GPU** | T4 16GB / A100 40GB (random allocation) |
| **CPU** | 2-core Intel Xeon |
| **Memory** | 12 GB |
| **Disk** | 78 GB (including Google Drive mount) |
| **Session Limit** | 12 hours/session, no guarantee for free users |
| **Network** | Available, but some ports restricted |

**Use Cases:**
- Single video testing (30 seconds, 720p)
- Code debugging and algorithm validation
- Learning VexFlow and FFmpeg usage

**Limitations:**
- Cannot guarantee GPU type (may be allocated to CPU mode)
- All data lost after session timeout (must manually save to Drive)
- Not suitable for batch production
- Cannot install Chrome/Chromium (container restrictions)

**Deployment:**
```python
# Colab Notebook Example
# 1. Mount Google Drive
from google.colab import drive
drive.mount('/content/drive')

# 2. Install dependencies
!apt-get update -qq
!apt-get install -y ffmpeg nodejs npm
!pip install -q mido music21 moviepy opencv-python-headless

# 3. Install Node.js dependencies
!cd /content/MelodyRain/js && npm install

# 4. Run (simplified version, no Chrome/VexFlow, use LilyPond instead)
!python MelodyRain.py --midi /content/drive/MyDrive/song.mid --audio /content/drive/MyDrive/song.mp3 --output /content/drive/MyDrive/output/ --mood auto --preview
```

**Note:** Colab cannot run headless Chrome (permission restrictions). Code modification needed to use LilyPond for sheet music generation, or use pure Python music21 renderer.

---

### 2.2 Kaggle Notebooks (Recommended, More Stable GPU)

| Item | Specification |
|------|--------------|
| **GPU** | P100 16GB / T4 16GB / A100 40GB (30-40 hours/week) |
| **CPU** | 4 cores |
| **Memory** | 16 GB |
| **Disk** | 20 GB persistent + external data mount |
| **Session Limit** | 9-12 hours/session |
| **Network** | Available, can download datasets |

**Use Cases:**
- More stable GPU environment than Colab
- Can process 3-5 videos per week (30 seconds 1080p)
- Datasets and models can be persisted

**Advantages:**
- More stable GPU type (usually T4)
- Supports dataset persistence (Kaggle Datasets)
- Rich community resources

**Limitations:**
- Weekly GPU time limit (about 30-40 hours)
- Cannot install Chrome (container restrictions)
- Requires Kaggle account phone verification

**Deployment:**
```python
# Kaggle Notebook Example
import os
os.system("pip install -q mido music21 moviepy opencv-python-headless")
os.system("apt-get install -y ffmpeg lilypond")

# Run (using LilyPond instead of VexFlow)
os.system("python MelodyRain.py --no-chrome --sheet-renderer lilypond --midi /kaggle/input/song/song.mid --audio /kaggle/input/song/song.mp3 --output /kaggle/working/output/")
```

---

### 2.3 Hugging Face Spaces (ZeroGPU, for Light Tasks)

| Item | Free Version | Pro Version ($9/month) |
|------|-------------|------------------------|
| **GPU** | None (CPU only) | ZeroGPU A100 (40GB) |
| **CPU** | 2 vCPU | 8 vCPU |
| **Memory** | 16 GB | 32 GB |
| **ZeroGPU Quota** | None | 5 min/day (free) -> 40 min/day (Pro) |
| **Storage** | 100 GB | 1 TB |

**Use Cases:**
- Free version: Only suitable for MIDI parsing and mood analysis (no GPU rendering)
- Pro version: Suitable for single video quick preview and testing

---

### 2.4 GitHub Codespaces (CPU Only, for Development)

| Item | Specification |
|------|--------------|
| **CPU** | 4 cores / 8 cores / 16 cores (optional) |
| **Memory** | 8 GB / 16 GB / 32 GB |
| **GPU** | None |
| **Disk** | 32 GB |
| **Duration** | 120 hours/month (free) |

**Use Cases:**
- Code development and debugging (no GPU rendering)
- Using CPU fallback mode to test Pipeline
- Collaborative development and version control

---

## 3. Budget Options

### 3.1 Vast.ai (Cheapest Market GPU Rental)

| GPU Type | Price/Hour | Recommendation | Notes |
|----------|------------|----------------|-------|
| RTX 3090 24GB | $0.15-$0.30 | First Choice | Best cost-effectiveness, sufficient VRAM |
| RTX 4090 24GB | $0.27-$0.53 | Recommended | Fast, suitable for 1080p60 |
| RTX 3060 12GB | $0.10-$0.20 | Economy | Budget-conscious first choice |
| A100 40GB | $0.67-$1.89 | Alternative | Large VRAM, but expensive |
| A100 80GB | $1.00-$2.67 | Not Recommended | Over-configured |

**Platform Features:**
- P2P market model, prices fluctuate significantly
- Can bid for lower prices
- Host reliability varies (choose high-rated ones)
- Supports Docker image deployment
- Per-second billing, start/stop anytime

**Use Cases:**
- Monthly output 10-50 videos, budget <$50/month
- Elastic demand, no need for 24/7 operation
- Can accept occasional host interruptions (need to save intermediate results)

**Monthly Cost Estimation (RTX 3090):**
- 10 videos (30 seconds 1080p): about 50 minutes GPU time = $0.15-$0.30
- 50 videos: about 4 hours GPU time = $0.60-$1.20
- 100 videos: about 8 hours GPU time = $1.20-$2.40

---

### 3.2 RunPod Community Cloud (Stable + Cheap)

| GPU Type | Price/Hour | Features |
|----------|------------|----------|
| RTX 4090 24GB | $0.34/hr | Community host, good cost-effectiveness |
| RTX A5000 24GB | $0.36/hr | Professional card, good stability |
| A100 80GB | $1.64/hr | Large VRAM, suitable for 4K |
| H100 80GB | $1.99/hr | Flagship performance |

**Platform Features:**
- More stable than Vast.ai, hosts are screened
- Supports Serverless (per-second billing, auto scaling)
- Supports Network Storage (data persistence)
- Has Web UI and CLI tools

**Serverless Mode (Recommended):**
```python
# Use RunPod Serverless API
# 1. Package MelodyRain as Docker image
# 2. Deploy to RunPod Serverless
# 3. Submit tasks via API, billed per second

# Cost per call: about $0.01-$0.05 (30-second video)
# 1000 calls: about $10-$50
```

---

### 3.3 TensorDock (Global Nodes, Low Price)

| GPU Type | Price/Hour |
|----------|------------|
| RTX 3090 | $0.30-$0.50 |
| RTX 4090 | $0.50-$0.80 |
| A100 80GB | $1.63-$2.00 |
| H100 | $2.25-$3.00 |

**Features:**
- Global multi-nodes, can choose lowest latency region
- Supports custom configuration (CPU, memory, disk)
- Suitable for users with specific regional needs

---

### 3.4 Hyperstack (Startup Friendly, SLA Guaranteed)

| GPU Type | Price/Hour |
|----------|------------|
| RTX A6000 48GB | $0.50 |
| H100 SXM | $2.40 |
| A100 SXM | $1.60 |

**Features:**
- Cheapest SLA guaranteed option
- Suitable for production environments requiring stability
- Startup friendly, has discount programs

---

## 4. Pay-as-you-go Options

### 4.1 AWS EC2 / GCP / Azure (Major Cloud Providers)

| Platform | Instance Type | GPU | Price/Hour | Features |
|----------|--------------|-----|------------|----------|
| AWS | g4dn.xlarge | T4 16GB | $0.526 | Entry first choice |
| AWS | g5.xlarge | A10G 24GB | $1.006 | Cost-effective |
| AWS | g5.2xlarge | A10G 24GB | $1.212 | More CPU |
| GCP | n1-standard-4 + T4 | T4 16GB | $0.35-$0.50 | Flexible config |
| GCP | a2-highgpu-1g | A100 40GB | $3.67 | High performance |
| Azure | NC6s v3 | V100 16GB | $1.08 | Stable |
| Azure | NC24ads A100 v4 | A100 80GB | $3.60 | Large VRAM |

**Spot Instance Prices (Recommended):**

| Platform | GPU | Spot Price | Discount |
|----------|-----|------------|----------|
| AWS | T4 | $0.15-$0.25/hr | 70% |
| AWS | A10G | $0.30-$0.50/hr | 70% |
| GCP | T4 | $0.10-$0.20/hr | 80% |
| GCP | A100 | $1.00-$1.50/hr | 70% |
| Azure | V100 | $0.30-$0.50/hr | 70% |

**Use Cases:**
- Existing cloud accounts, utilizing free credits
- Need integration with other cloud services
- Can accept Spot instance interruptions (need checkpoint)

---

### 4.2 Lambda Labs (AI Dedicated Cloud, No Egress Fees)

| GPU Type | Price/Hour |
|----------|------------|
| A100 40GB | $1.29-$1.99 |
| A100 80GB | $2.49 |
| H100 SXM | $2.99-$4.29 |
| H100 PCIe | $3.29 |

**Features:**
- No egress fees (free data transfer out)
- 1-Click Clusters support multi-GPU
- Academic research discounts
- Suitable for long-running training tasks

---

### 4.3 Alibaba Cloud / Tencent Cloud / Huawei Cloud (China Domestic)

| Platform | GPU Type | Price/Hour |
|----------|----------|------------|
| Alibaba Cloud | V100 16GB | 8-12 RMB |
| Alibaba Cloud | A10 24GB | 6-10 RMB |
| Alibaba Cloud | A100 40GB | 15-25 RMB |
| Tencent Cloud | V100 16GB | 8-10 RMB |
| Tencent Cloud | A100 40GB | 15-20 RMB |
| Huawei Cloud | V100 16GB | 8-12 RMB |

**Features:**
- Domestic network, low latency
- Support pay-as-you-go and annual/monthly packages
- Student discounts and new user free credits

---

## 5. Comparison and Recommendations

### 5.1 By Usage Scenario

| Scenario | Recommended Option | Monthly Cost | Monthly Output |
|----------|-------------------|--------------|----------------|
| Learning/Testing | Google Colab / Kaggle | $0 | 1-5 |
| Personal Creation | Vast.ai RTX 3090 | $1-$5 | 10-50 |
| Small Studio | RunPod Community / Vast.ai | $10-$50 | 50-200 |
| Medium Studio | RunPod Secure / AWS Spot | $50-$200 | 200-1000 |
| Large Factory | AWS Spot + Self-built | $200-$1000 | 1000+ |
| Enterprise | AWS / GCP / Azure SLA | $500+ | Unlimited |

### 5.2 By Budget

| Budget | Option | Output Capacity |
|--------|--------|-----------------|
| $0 | Colab + Kaggle | 10-20/month |
| $10 | Vast.ai RTX 3090 | 100-200/month |
| $50 | RunPod Community RTX 4090 | 500-1000/month |
| $100 | AWS Spot A10G | 1000-2000/month |
| $500 | Hybrid (Cloud + Self-built) | 5000+/month |

### 5.3 Decision Flowchart

```
Start
 |
 +-- Budget = $0? --> Yes --> Colab / Kaggle (free quota)
 |                   |
 |                   No
 |                   v
 +-- Budget < $10/month? --> Yes --> Vast.ai RTX 3090/3060
 |                        |
 |                        No
 |                        v
 +-- Budget < $50/month? --> Yes --> RunPod Community / Vast.ai RTX 4090
 |                        |
 |                        No
 |                        v
 +-- Need SLA guarantee? --> Yes --> AWS Spot / GCP Spot / Hyperstack
 |                        |
 |                        No
 |                        v
 +-- Need domestic node? --> Yes --> Alibaba Cloud / Tencent Cloud / Huawei Cloud
 |                        |
 |                        No
 |                        v
 +-- Output > 1000/month? --> Yes --> Consider hybrid self-built + cloud
 |                          |
 |                          No
 |                          v
 |                    RunPod Secure / AWS On-Demand
```

---

## 6. Deployment Guides

### 6.1 Universal Docker Deployment (for all cloud platforms)

```dockerfile
# Dockerfile
FROM nvidia/cuda:12.0-devel-ubuntu22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium-browser \
    nodejs \
    npm \
    python3.10 \
    python3-pip \
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Install Node.js dependencies
COPY js/package.json js/
RUN cd js && npm install

# Copy project code
COPY . /app
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99
ENV CHROME_BIN=/usr/bin/chromium-browser

# Entry point
ENTRYPOINT ["python3", "MelodyRain.py"]
```

### 6.2 Vast.ai Deployment Script

```bash
#!/bin/bash
# deploy_vastai.sh

# 1. Search for RTX 3090/4090 on Vast.ai, choose host with rating >4.5
# 2. Create instance, select CUDA 12.0+ image
# 3. SSH connect and execute:

# Clone project
git clone https://github.com/your-repo/MelodyRain.git
cd MelodyRain

# Install dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg chromium-browser nodejs npm
pip install -r requirements.txt
cd js && npm install && cd ..

# Upload MIDI and audio files (via scp or wget)
mkdir -p input output
# scp -r your-local-midi-folder/ root@instance-ip:/root/MelodyRain/input/

# Run batch processing
python MelodyRain.py --batch ./input/ --output ./output/ --mood auto --workers 4

# Download results
# scp -r root@instance-ip:/root/MelodyRain/output/ ./local-output/

# Destroy instance after completion (operate in Vast.ai console)
```

### 6.3 AWS Spot Instance Deployment (Most Economical Production Option)

```python
# aws_spot_launcher.py
import boto3

def launch_spot_instance(gpu_type='g4dn.xlarge', max_price=0.20):
    ec2 = boto3.client('ec2')

    # Request Spot instance
    response = ec2.request_spot_instances(
        InstanceCount=1,
        LaunchSpecification={
            'ImageId': 'ami-xxxxxxxxxxxxx',  # Deep Learning AMI
            'InstanceType': gpu_type,
            'KeyName': 'your-key-pair',
            'SecurityGroupIds': ['sg-xxxxxxxx'],
            'SubnetId': 'subnet-xxxxxxxx',
            'IamInstanceProfile': {'Arn': 'arn:aws:iam::xxx:instance-profile/xxx'},
            'UserData': '''#!/bin/bash
                # Auto install and run MelodyRain
                apt-get update
                apt-get install -y ffmpeg nodejs npm
                cd /home/ubuntu && git clone https://github.com/your-repo/MelodyRain.git
                cd MelodyRain && pip install -r requirements.txt
                cd js && npm install
                # Download input files from S3
                aws s3 sync s3://your-bucket/input/ ./input/
                # Run
                python MelodyRain.py --batch ./input/ --output ./output/ --workers 4
                # Upload results to S3
                aws s3 sync ./output/ s3://your-bucket/output/
                # Auto shutdown
                shutdown -h now
            '''
        },
        SpotPrice=str(max_price),
        Type='one-time'
    )

    return response['SpotInstanceRequests'][0]['SpotInstanceRequestId']
```

---

## 7. Cost Estimation

### 7.1 Single Video Cost (30 seconds 1080p60)

| Platform | GPU | Render Time | Unit Price | Single Video Cost |
|----------|-----|-------------|------------|-------------------|
| Colab | T4 | 15-20 min | $0 | $0 |
| Kaggle | T4 | 10-15 min | $0 | $0 |
| Vast.ai | RTX 3090 | 3-5 min | $0.20/hr | $0.01-$0.02 |
| Vast.ai | RTX 4090 | 2-3 min | $0.40/hr | $0.01-$0.02 |
| RunPod | RTX 4090 | 2-3 min | $0.34/hr | $0.01-$0.02 |
| AWS Spot | T4 | 5-8 min | $0.20/hr | $0.02-$0.03 |
| AWS Spot | A10G | 2-3 min | $0.40/hr | $0.01-$0.02 |
| Lambda | A100 | 1-2 min | $2.49/hr | $0.04-$0.08 |

### 7.2 Monthly Cost Estimation (by Output Volume)

| Monthly Output | Recommended Option | Monthly Cost | Annual Cost |
|----------------|-------------------|--------------|-------------|
| 10 | Colab / Kaggle | $0 | $0 |
| 50 | Vast.ai RTX 3090 | $1-$2 | $12-$24 |
| 100 | Vast.ai RTX 4090 | $2-$4 | $24-$48 |
| 500 | RunPod Community RTX 4090 | $10-$20 | $120-$240 |
| 1000 | AWS Spot A10G | $20-$40 | $240-$480 |
| 5000 | AWS Spot + Automation | $100-$200 | $1200-$2400 |
| 10000 | Hybrid (Self-built + Cloud) | $200-$400 | $2400-$4800 |

### 7.3 Comparison with Self-built Option

| Option | Initial Investment | Monthly Cost (1000 videos) | 3-Year Total Cost | Flexibility |
|--------|-------------------|---------------------------|-------------------|-------------|
| Pure Cloud (Vast.ai) | $0 | $20-$40 | $720-$1440 | High |
| Pure Cloud (AWS Spot) | $0 | $20-$40 | $720-$1440 | High |
| Self-built RTX 3060 | $1500 | $5 (electricity) | $1680 | Low |
| Self-built RTX 4090 | $4000 | $10 (electricity) | $4360 | Low |
| Hybrid (Self-built + Cloud) | $1500 | $15 | $2040 | Medium |

**Conclusion:**
- Monthly output < 600: Cloud is cheaper
- Monthly output > 600: Self-built becomes cost-effective
- Monthly output 1000+: Hybrid option is optimal

---

## 8. Limitations and Notes

### 8.1 Free Tier Limitations

| Platform | Main Limitation | Workaround |
|----------|----------------|------------|
| Colab | 12-hour timeout, no Chrome | Use LilyPond instead, run in segments |
| Kaggle | 30-40 hours GPU/week | Multiple accounts, or upgrade to Pro |
| HF Spaces | 5-40 minutes GPU/day | Only for testing, not for production |
| GitHub Codespaces | No GPU | Only CPU fallback mode |

### 8.2 General Cloud Limitations

| Issue | Impact | Solution |
|-------|--------|----------|
| No persistent storage | Data lost after instance destruction | Use cloud storage (S3/GCS) or Network Storage |
| Network latency | Slow upload/download | Choose nearby region, use object storage |
| No GUI | Cannot preview | Use headless mode, download and view after output |
| Slow dependency installation | Need to reinstall every startup | Create custom image, pre-install all dependencies |
| GPU driver issues | Some platforms have incomplete drivers | Use CUDA official image, or choose well-supported platforms |

### 8.3 Performance Optimization Recommendations

| Optimization | Method | Effect |
|--------------|--------|--------|
| Parallel rendering | Multiple instances processing different videos simultaneously | Linear improvement |
| Cache reuse | Same MIDI directly reuse cache | Reduce 50% time |
| Degraded rendering | Preview at 720p30, final at 1080p60 | Save 70% time |
| Batch upload | Upload multiple files at once | Reduce network waiting |
| Auto shutdown | Automatically destroy instance after task completion | Save idle costs |

---

## Appendix

### A. Quick Start Commands

```bash
# Vast.ai one-click launch (RTX 3090)
vastai create instance --image nvidia/cuda:12.0-devel-ubuntu22.04 \
    --gpu rtx3090 --disk 50 --onstart-cmd "git clone https://github.com/your-repo/MelodyRain.git && cd MelodyRain && bash setup.sh"

# RunPod one-click launch
runpodctl create pod --gpuType "NVIDIA RTX 4090" --imageName "your-registry/MelodyRain:latest" --volumeSize 50

# AWS Spot one-click launch
python aws_spot_launcher.py --gpu g4dn.xlarge --max-price 0.20 --batch-size 10
```

### B. Cloud-Optimized Configuration Template

```json
{
  "render": {
    "use_gpu": true,
    "gpu_backend": "cuda",
    "parallel_rendering": true,
    "max_workers": 4,
    "cache_intermediate": false,
    "ffthreads": 8
  },
  "animation": {
    "fps": 60,
    "resolution": [1920, 1080],
    "note_approach_time": 1.5
  },
  "effects": {
    "particles": true,
    "curves": true,
    "nature_elements": false,
    "staff_floating": true
  },
  "cloud": {
    "auto_upload": true,
    "auto_shutdown": true,
    "storage_provider": "s3",
    "bucket": "your-bucket"
  }
}
```

---

**Document Version:** v1.0  
**Last Updated:** 2026-07-09  
**Maintainer:** [TBD]

---

*This document is used in conjunction with the MelodyRain Vibe Coding Requirements Document and Hardware Requirements Specification.*
