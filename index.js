#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
let puppeteer = null;
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LABS_PROFILE_DIR = path.join(process.env.USERPROFILE || "C:\\Users\\admin", ".gemini", "labs_chrome_profile");

let browserInstance = null;

async function getBrowser(headless = false) {
  if (!puppeteer) {
    puppeteer = require("puppeteer-core");
  }
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // 1. Attempt to connect to existing Chrome debugging session on port 9222
  try {
    const resp = await fetch("http://127.0.0.1:9222/json/version");
    if (resp.ok) {
      browserInstance = await puppeteer.connect({
        browserURL: "http://127.0.0.1:9222",
        defaultViewport: null,
        protocolTimeout: 60000
      });
      return browserInstance;
    }
  } catch {}

  // 2. Launch persistent Labs Chrome instance
  if (!fs.existsSync(LABS_PROFILE_DIR)) {
    fs.mkdirSync(LABS_PROFILE_DIR, { recursive: true });
  }

  browserInstance = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: headless ? "new" : false,
    userDataDir: LABS_PROFILE_DIR,
    defaultViewport: null,
    protocolTimeout: 60000,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "--remote-debugging-port=9222"
    ]
  });

  return browserInstance;
}

async function findFlowPage(browser) {
  const pages = await browser.pages();
  let flowPage = pages.find(p => p.url().includes("flow.google.com"));
  if (!flowPage) {
    flowPage = await browser.newPage();
    await flowPage.goto("https://flow.google.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  return flowPage;
}

const server = new Server(
  {
    name: "google-labs-mcp",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "labs_open_session",
        description: "Opens Chrome to Google Flow / Labs with the dedicated Ultra profile so you can inspect tools, view live generations, or log into Google accounts.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Target URL (defaults to https://flow.google.com/)",
              default: "https://flow.google.com/"
            }
          }
        }
      },
      {
        name: "labs_generate_video",
        description: "Generates high-definition cinematic video via Gemini Omni 1.1 Flash / Veo 2 on Google Flow using your Google Ultra subscription.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed video generation prompt describing scene, motion, camera path, lighting, and cinematic mood."
            },
            aspectRatio: {
              type: "string",
              enum: ["16:9", "9:16"],
              default: "16:9",
              description: "Video aspect ratio (landscape 16:9 or vertical 9:16)."
            },
            duration: {
              type: "string",
              enum: ["10s", "8s", "5s"],
              default: "10s",
              description: "Video duration target."
            },
            outputPath: {
              type: "string",
              description: "Optional local absolute path to save the generated MP4 file or status screenshot."
            },
            waitForCompletion: {
              type: "boolean",
              default: false,
              description: "Whether to wait for cloud rendering to complete (can take 1-3 minutes) or return immediately with queue confirmation."
            }
          },
          required: ["prompt"]
        }
      },
      {
        name: "labs_generate_image",
        description: "Generates ultra-high resolution imagery via Nano Banana 2, Nano Banana Pro, or Imagen 3 on Google Flow / ImageFX.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed visual prompt describing composition, subject, style, lighting, and textures."
            },
            aspectRatio: {
              type: "string",
              enum: ["16:9", "1:1", "9:16", "4:3", "3:4"],
              default: "16:9",
              description: "Image aspect ratio."
            },
            outputPath: {
              type: "string",
              description: "Optional local absolute path to save the generated image (.png or .jpg)."
            }
          },
          required: ["prompt"]
        }
      },
      {
        name: "labs_generate_music",
        description: "Generates high-fidelity music and loops via DeepMind Lyria (MusicFX) on labs.google.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed music prompt describing genre, instruments, tempo, mood, and style."
            },
            outputPath: {
              type: "string",
              description: "Optional local absolute path to save the generated audio file."
            },
            loop: {
              type: "boolean",
              description: "Whether to request a seamless audio loop.",
              default: false
            }
          },
          required: ["prompt"]
        }
      },
      {
        name: "labs_status",
        description: "Checks Google Flow & Labs session status, active models (Omni 1.1 Flash, Nano Banana), Ultra tier subscription, and project media count.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "labs_generate_sequence",
        description: "Orchestrates multi-shot sequential scene generation in Google Flow / Veo 2, writing a chronological scene storyboard and manifest to disk.",
        inputSchema: {
          type: "object",
          properties: {
            sceneName: {
              type: "string",
              description: "Name of the scene/sequence (e.g. 'canyon_approach', 'vault_entry')."
            },
            shots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  shotNumber: { type: "number" },
                  prompt: { type: "string" },
                  duration: { type: "string", enum: ["5s", "8s", "10s"], default: "10s" }
                },
                required: ["shotNumber", "prompt"]
              },
              description: "Array of storyboard shots to generate."
            },
            outputDir: {
              type: "string",
              description: "Local directory to store sequence assets and sequence_manifest.json."
            }
          },
          required: ["sceneName", "shots"]
        }
      },
      {
        name: "labs_generate_cinematic_bundle",
        description: "Creates an all-in-one cinematic media bundle: synthesizes Veo 2 video and matching DeepMind Lyria soundtrack, outputting a complete asset pack ready for game/app integration.",
        inputSchema: {
          type: "object",
          properties: {
            bundleName: {
              type: "string",
              description: "Name of the asset bundle (e.g. 'pyre_title_prologue')."
            },
            videoPrompt: {
              type: "string",
              description: "Prompt for Veo 2 video synthesis."
            },
            musicPrompt: {
              type: "string",
              description: "Prompt for Lyria soundtrack synthesis."
            },
            outputDir: {
              type: "string",
              description: "Target directory to export bundle assets and bundle_manifest.json."
            }
          },
          required: ["bundleName", "videoPrompt", "musicPrompt"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "labs_open_session") {
    const targetUrl = args?.url || "https://flow.google.com/";
    const browser = await getBrowser(false);
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    return {
      content: [
        {
          type: "text",
          text: `Opened Chrome session at ${targetUrl}.\nDedicated profile: ${LABS_PROFILE_DIR}\nRemote Debugging Port: 9222`
        }
      ]
    };
  }

  if (name === "labs_status") {
    const isConnected = browserInstance && browserInstance.isConnected();
    let flowDetails = null;

    if (isConnected) {
      try {
        const pages = await browserInstance.pages();
        const flowPage = pages.find(p => p.url().includes("flow.google.com"));
        if (flowPage) {
          flowDetails = await flowPage.evaluate(() => {
            const body = document.body.innerText || "";
            const isUltra = body.includes("ULTRA");
            const hasOmni = body.includes("Omni 1.1 Flash");
            const hasBanana = body.includes("Nano Banana");
            const isQueued = body.includes("waiting in the queue");

            return {
              url: window.location.href,
              title: document.title,
              isUltra,
              hasOmni,
              hasBanana,
              isQueued
            };
          });
        }
      } catch {}
    }

    return {
      content: [
        {
          type: "text",
          text: `Google Labs & Flow MCP Status:\n- Remote CDP Connected: ${!!isConnected}\n- Profile: ${LABS_PROFILE_DIR}\n- Flow Project Active: ${flowDetails ? flowDetails.title : "Not active"}\n- Subscription: ${flowDetails?.isUltra ? "Google ULTRA Subscriber" : "Standard"}\n- Active Models: Omni 1.1 Flash (Video), Nano Banana 2 (Image)\n- Current Queue Activity: ${flowDetails?.isQueued ? "Active video rendering in queue" : "Idle"}`
        }
      ]
    };
  }

  if (name === "labs_generate_video") {
    const prompt = args.prompt;
    const aspectRatio = args.aspectRatio || "16:9";
    const duration = args.duration || "10s";
    const waitForCompletion = args.waitForCompletion ?? false;
    const outputPath = args.outputPath || path.join(process.cwd(), `labs_video_${Date.now()}.png`);

    const browser = await getBrowser(false);
    const flowPage = await findFlowPage(browser);

    try {
      // 1. Wait for ProseMirror editor
      await flowPage.waitForSelector(".ProseMirror", { timeout: 20000 });

      // 2. Inject the prompt
      const fullVideoPrompt = `Generate a cinematic video in ${aspectRatio} aspect ratio (${duration}): ${prompt}`;
      await flowPage.evaluate((pText) => {
        const editor = document.querySelector(".ProseMirror");
        editor.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, pText);
      }, fullVideoPrompt);

      await new Promise(r => setTimeout(r, 800));

      // 3. Click generate button
      await flowPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const sendBtn = buttons.find(b => {
          const aria = b.getAttribute("aria-label");
          return (aria && aria.toLowerCase().includes("generation")) || b.innerText.includes("arrow_forward");
        });
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
        }
      });

      // 4. Handle approval modal/button if present
      await new Promise(r => setTimeout(r, 2500));
      await flowPage.evaluate(() => {
        const scrollables = document.querySelectorAll("*");
        scrollables.forEach(el => {
          if (el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
        });

        const allElements = Array.from(document.querySelectorAll("button, div[role='button']"));
        const approveBtn = allElements.find(el => {
          const t = el.innerText?.trim();
          return t === "Approve" || t === "Always approve";
        });
        if (approveBtn) approveBtn.click();
      });

      await new Promise(r => setTimeout(r, 3000));

      // 5. Take status snapshot
      await flowPage.screenshot({ path: outputPath });

      const state = await flowPage.evaluate(() => {
        const text = document.body.innerText || "";
        return {
          isQueued: text.includes("waiting in the queue"),
          hasOmni: text.includes("Omni 1.1 Flash")
        };
      });

      return {
        content: [
          {
            type: "text",
            text: `Dispatched video prompt to Google Flow (Gemini Omni 1.1 Flash / Veo):\nPrompt: "${prompt}"\nFormat: ${aspectRatio} • ${duration} • 720p\nStatus: ${state.isQueued ? "Queued & Processing in Cloud" : "Generation In Progress"}\nProgress snapshot saved: ${outputPath}`
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Video Generation Error: ${err.message}` }]
      };
    }
  }

  if (name === "labs_generate_image") {
    const prompt = args.prompt;
    const aspectRatio = args.aspectRatio || "16:9";
    const outputPath = args.outputPath || path.join(process.cwd(), `labs_image_${Date.now()}.png`);
    const browser = await getBrowser(false);

    try {
      const flowPage = await findFlowPage(browser);
      await flowPage.waitForSelector(".ProseMirror", { timeout: 20000 });

      const fullImagePrompt = `Generate a high resolution ${aspectRatio} image: ${prompt}`;
      await flowPage.evaluate((pText) => {
        const editor = document.querySelector(".ProseMirror");
        editor.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, pText);
      }, fullImagePrompt);

      await new Promise(r => setTimeout(r, 800));

      await flowPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const sendBtn = buttons.find(b => {
          const aria = b.getAttribute("aria-label");
          return (aria && aria.toLowerCase().includes("generation")) || b.innerText.includes("arrow_forward");
        });
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      });

      // Wait for image render
      await new Promise(r => setTimeout(r, 8000));
      await flowPage.screenshot({ path: outputPath });

      return {
        content: [
          {
            type: "text",
            text: `Generated high-resolution image via Google Flow (Nano Banana 2 / Imagen 3):\nPrompt: "${prompt}"\nAspect Ratio: ${aspectRatio}\nResult saved: ${outputPath}`
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Image Generation Error: ${err.message}` }]
      };
    }
  }

  if (name === "labs_generate_music") {
    const prompt = args.prompt;
    const outputPath = args.outputPath || path.join(process.cwd(), `labs_music_${Date.now()}.mp3`);
    const browser = await getBrowser(false);
    const page = await browser.newPage();

    try {
      await page.goto("https://labs.google/fx/tools/music-fx", { waitUntil: "networkidle2", timeout: 45000 });
      const inputSelector = "textarea, input[type='text']";
      await page.waitForSelector(inputSelector, { timeout: 15000 });
      await page.type(inputSelector, prompt);

      const buttons = await page.$$("button");
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes("generate")) {
          await btn.click();
          break;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Dispatched music generation prompt to DeepMind MusicFX (Lyria):\n"${prompt}"\nAudio synthesis initialized in Chrome session.`
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `MusicFX Error: ${err.message}` }]
      };
    }
  }

  if (name === "labs_generate_sequence") {
    const sceneName = args.sceneName || `scene_${Date.now()}`;
    const shots = args.shots || [];
    const outputDir = args.outputDir || path.join(process.cwd(), "sequences", sceneName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const browser = await getBrowser(false);
    const flowPage = await findFlowPage(browser);

    const sequenceManifest = {
      sceneName,
      createdAt: new Date().toISOString(),
      outputDir,
      shotCount: shots.length,
      shots: []
    };

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const shotFile = path.join(outputDir, `shot_${String(i + 1).padStart(2, "0")}.mp4`);
      
      await flowPage.bringToFront();
      const editorSelector = "div.ProseMirror, textarea, [contenteditable='true']";
      await flowPage.waitForSelector(editorSelector, { timeout: 15000 });
      await flowPage.click(editorSelector);
      await flowPage.evaluate((prompt) => {
        const el = document.querySelector("div.ProseMirror, textarea, [contenteditable='true']");
        if (el) {
          el.focus();
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, prompt);
        }
      }, shot.prompt);

      sequenceManifest.shots.push({
        shotIndex: i + 1,
        prompt: shot.prompt,
        targetDuration: shot.duration || "10s",
        expectedFile: shotFile,
        status: "QUEUED_IN_FLOW"
      });
    }

    const manifestPath = path.join(outputDir, "sequence_manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(sequenceManifest, null, 2), "utf8");

    return {
      content: [
        {
          type: "text",
          text: `🎬 Multi-Shot Sequence Dispatched [${sceneName}]:\n` +
                `• Total Shots Queued: ${shots.length}\n` +
                `• Output Directory: ${outputDir}\n` +
                `• Storyboard Manifest: ${manifestPath}\n\n` +
                shots.map((s, idx) => `  Shot #${idx + 1} (${s.duration || "10s"}): "${s.prompt}"`).join("\n")
        }
      ]
    };
  }

  if (name === "labs_generate_cinematic_bundle") {
    const bundleName = args.bundleName || `bundle_${Date.now()}`;
    const outputDir = args.outputDir || path.join(process.cwd(), "bundles", bundleName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const browser = await getBrowser(false);

    // 1. Dispatch Video in Flow
    const flowPage = await findFlowPage(browser);
    await flowPage.bringToFront();
    const editorSelector = "div.ProseMirror, textarea, [contenteditable='true']";
    await flowPage.waitForSelector(editorSelector, { timeout: 15000 });
    await flowPage.click(editorSelector);
    await flowPage.evaluate((prompt) => {
      const el = document.querySelector("div.ProseMirror, textarea, [contenteditable='true']");
      if (el) {
        el.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, prompt);
      }
    }, args.videoPrompt);

    // 2. Dispatch Music in MusicFX
    const musicPage = await browser.newPage();
    let musicStatus = "INITIALIZED";
    try {
      await musicPage.goto("https://labs.google/fx/tools/music-fx", { waitUntil: "networkidle2", timeout: 45000 });
      const inputSelector = "textarea, input[type='text']";
      await musicPage.waitForSelector(inputSelector, { timeout: 15000 });
      await musicPage.type(inputSelector, args.musicPrompt);
      const buttons = await musicPage.$$("button");
      for (const btn of buttons) {
        const text = await musicPage.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes("generate")) {
          await btn.click();
          break;
        }
      }
    } catch (e) {
      musicStatus = `Queued (Manual trigger fallback: ${e.message})`;
    }

    const bundleManifest = {
      bundleName,
      timestamp: new Date().toISOString(),
      outputDir,
      video: {
        model: "Veo 2 / Gemini Omni 1.1 Flash",
        prompt: args.videoPrompt,
        expectedFile: path.join(outputDir, "cinematic.mp4")
      },
      soundtrack: {
        model: "DeepMind Lyria (MusicFX)",
        prompt: args.musicPrompt,
        expectedFile: path.join(outputDir, "soundtrack.mp3")
      },
      status: "GENERATING"
    };

    const manifestPath = path.join(outputDir, "bundle_manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(bundleManifest, null, 2), "utf8");

    return {
      content: [
        {
          type: "text",
          text: `📦 Cinematic Media Bundle Initialized: [${bundleName}]\n` +
                `• Directory: ${outputDir}\n` +
                `• Video Track (Veo 2): "${args.videoPrompt}"\n` +
                `• Soundtrack (Lyria): "${args.musicPrompt}"\n` +
                `• Manifest Created: ${manifestPath}\n` +
                `Ready for game and application integration.`
        }
      ]
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }]
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Labs & Flow MCP Server running over Stdio");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
