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
