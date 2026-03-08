# Ollama Local LLM Setup Guide

This guide will help you set up Ollama to run local LLMs with Flowmatics.

---

## What is Ollama?

**Ollama** is an easy-to-use platform for running open-source large language models (LLMs) locally on your machine. With Ollama, you can:

- 🔒 **Keep your data private** - No cloud API calls
- 💰 **Save money** - No API fees
- ⚡ **Work offline** - No internet required after model download
- 🎛️ **Choose your model** - llama3, mistral, codellama, phi3, and more

---

## Installation

### macOS / Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Download the installer from [ollama.com](https://ollama.com/download)

---

## Quick Start

### 1. Pull a Model
Download a recommended model for data analysis:

```bash
# Llama 3 (Best quality, 4.7GB)
ollama pull llama3

# OR Mistral (Faster, 4.1GB)
ollama pull mistral

# OR Phi-3 (Smallest, 2.3GB)
ollama pull phi3
```

### 2. Test It
```bash
ollama run llama3
```

Type a message and press Enter. Type `/bye` to exit.

### 3. Start Ollama Server
```bash
ollama serve
```

> **Note**: The server runs on `http://localhost:11434` by default.

---

## Flowmatics Configuration

### Option 1: Use .env File
Create or edit `backend/.env`:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

### Option 2: Runtime Switching
Use the **LLM Selector** in the AI Insights view (top-right corner) to switch between Cloud (Gemini) and Local (Ollama) on the fly.

---

## Recommended Models

| Model | Size | Best For | Speed |
|-------|------|----------|-------|
| **llama3** | 4.7GB | General analysis | Medium |
| **mistral** | 4.1GB | Balanced performance | Fast |
| **codellama** | 3.8GB | Code generation | Medium |
| **phi3** | 2.3GB | Quick queries | Very Fast |

---

## Troubleshooting

### "Ollama not available"
1. Ensure Ollama is running: `ollama serve`
2. Check the server is accessible: `curl http://localhost:11434/api/tags`
3. Verify the model is pulled: `ollama list`

### Slow responses
- Use a smaller model (phi3 instead of llama3)
- Ensure your machine has enough RAM (8GB+ recommended)
- Close other heavy applications

### Port conflicts
Change the Ollama port:
```bash
OLLAMA_HOST=127.0.0.1:11435 ollama serve
```

Then update `backend/.env`:
```env
OLLAMA_BASE_URL=http://localhost:11435
```

---

## Advanced Usage

### Custom System Prompts
Edit `backend/localprocessing/local_agent_service.py` to customize the AI personas for Ollama.

### Model Parameters
Adjust temperature, context size, and other parameters in `backend/localprocessing/ollama_client.py`.

---

## Need Help?

- **Ollama Docs**: https://ollama.com/docs
- **Flowmatics Issues**: [GitHub Issues](https://github.com)
- **Model Library**: https://ollama.com/library

---

**Happy local LLM processing!** 🦙
