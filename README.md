# 🧪 Google Labs & Flow MCP Server (`google-labs-mcp`)

> **The first open-source Model Context Protocol (MCP) bridge connecting Antigravity (AGY) and AI coding agents directly to Google Labs and Google Flow.**  
> Harness DeepMind's bleeding-edge creative models—**Imagen 3 (ImageFX)**, **Lyria (MusicFX)**, and **Gemini Omni Flash / Veo (VideoFX)**—directly from your coding environment.

![Google Flow Output Showcase](assets/showcase.jpg)
*Above: High-resolution 16:9 cinematic concept art generated autonomously by Antigravity through this MCP server on Google Flow.*

---

## ⚡ Why This Matters

AI coding assistants are typically confined to writing text files and code snippets. When designing games, websites, or apps, developers are forced to manually switch between browser tabs, generate assets on web playgrounds, download files, and copy them into their project trees.

**`google-labs-mcp` closes that gap.** It equips your agent with direct, autonomous programmatic hooks into `labs.google` and `flow.google.com`:
- 🎨 **Instant Concept Art & Textures**: Request high-resolution imagery via Imagen 3 directly during coding sessions.
- 🎵 **Dynamic Soundtracks & Stems**: Prompt Lyria for custom looping background music and combat SFX.
- 🎬 **Cinematic Video & Cutscenes**: Orchestrate video generation models for trailers, cutscenes, and animated backgrounds.
- 🔑 **Zero-Friction Authentication**: Automatically attaches to your active Chrome browser session (inheriting Google One / Ultra plan privileges) with zero OAuth hassle or API quota surcharges.

---

## 🛠️ Tools Exposed to MCP Clients

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `labs_generate_image` | `prompt`, `aspectRatio` (`1:1`, `16:9`, etc.), `outputPath` | Generates uncompressed imagery via **Imagen 3** on Google Flow / ImageFX and saves it locally. |
| `labs_generate_music` | `prompt`, `outputPath`, `loop` | Prompts DeepMind's **Lyria (MusicFX)** to generate full audio tracks and stems. |
| `labs_open_session` | `url` | Opens Chrome to `labs.google/fx/` with the dedicated MCP profile for visual inspection or one-time sign-in. |
| `labs_status` | *(none)* | Returns active browser connection status, CDP port, and profile path. |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ (Tested on v24)
- Google Chrome browser installed
- A Google account (works with standard accounts, with full prioritized compute on **Ultra / Google One**)

### 2. Installation

```bash
git clone https://github.com/ssfdre38/google-labs-mcp.git
cd google-labs-mcp
npm install
```

### 3. One-Click Session Launch
Run the session launcher:
```cmd
start_labs_session.bat
```
This launches Chrome with `--remote-debugging-port=9222` and a dedicated profile (`~/.gemini/labs_chrome_profile`). Log into your Google account once in this window, and your session remains permanently preserved!

### 4. Register in Your MCP Client

#### For Google Antigravity (`~/.gemini/config/mcp_config.json`):
```json
{
  "mcpServers": {
    "google-labs": {
      "command": "node",
      "args": ["C:\\path\\to\\google-labs-mcp\\index.js"]
    }
  }
}
```

#### For Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "google-labs": {
      "command": "node",
      "args": ["C:\\path\\to\\google-labs-mcp\\index.js"]
    }
  }
}
```

---

## 🏗️ Architecture

```
google-labs-mcp/
├── index.js               # MCP Server entrypoint & CDP Puppeteer controller
├── start_labs_session.bat # Chrome launcher with remote debugging enabled
├── package.json           # Dependencies (@modelcontextprotocol/sdk, puppeteer-core)
├── assets/
│   └── showcase.jpg       # Autonomous generation proof of concept
└── README.md              # Documentation & integration guides
```

---

## 👥 Contributors & Credits

- **Concept & Architecture**: Conceived and built autonomously by **Antigravity (Google DeepMind)**.
- **Patron & Visionary**: **Daniel Elliott ([@ssfdre38](https://github.com/ssfdre38))** — *Barrer Software*.
- **Special Thanks**: Google DeepMind for creating the incredible generative models powering `labs.google` and `flow.google.com`.

---

## 📜 License
MIT License. Open source and free for the developer community.
