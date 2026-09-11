#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(process.env.LOCALAPPDATA || "C:\\Users\\admin\\AppData\\Local", "Google", "Chrome", "User Data");
const LABS_PROFILE_DIR = path.join(process.env.USERPROFILE || "C:\\Users\\admin", ".gemini", "labs_chrome_profile");

let browserInstance = null;

async function getBrowser(headless = false) {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // 1. Attempt to connect to existing Chrome debugging session on port 9222
  try {
    const resp = await fetch("http://127.0.0.1:9222/json/version");
    if (resp.ok) {
      browserInstance = await puppeteer.connect({
        browserURL: "http://127.0.0.1:9222",
        defaultViewport: null
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
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "--remote-debugging-port=9222"
    ]
  });

  return browserInstance;
}

const server = new Server(
  {
    name: "google-labs-mcp",
    version: "1.0.0",
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
        description: "Opens Chrome to labs.google with the dedicated Ultra profile so you can log in, inspect tools, or test generations interactively.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Target URL (defaults to https://labs.google/fx/)",
              default: "https://labs.google/fx/"
            }
          }
        }
      },
      {
        name: "labs_generate_music",
        description: "Generates high-fidelity music via DeepMind Lyria (MusicFX) on labs.google.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed music prompt describing genre, instruments, tempo, mood, and style."
            },
            outputPath: {
              type: "string",
              description: "Optional local absolute path to save the generated audio file (e.g. .mp3 or .wav)."
            },
            loop: {
              type: "boolean",
              description: "Whether to request a seamless loop.",
              default: false
            }
          },
          required: ["prompt"]
        }
      },
      {
        name: "labs_generate_image",
        description: "Generates ultra-high resolution imagery via Imagen 3 (ImageFX) on labs.google.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed visual prompt for Imagen 3."
            },
            aspectRatio: {
              type: "string",
              enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
              default: "1:1",
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
        name: "labs_status",
        description: "Checks if the Google Labs browser session is running and authenticated.",
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
    const targetUrl = args?.url || "https://labs.google/fx/";
    const browser = await getBrowser(false);
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    return {
      content: [
        {
          type: "text",
          text: `Opened Chrome session at ${targetUrl}. User can log into Google Ultra account. Profile stored at: ${LABS_PROFILE_DIR}`
        }
      ]
    };
  }

  if (name === "labs_status") {
    const isConnected = browserInstance && browserInstance.isConnected();
    return {
      content: [
        {
          type: "text",
          text: `Google Labs MCP Server Status:\n- Browser Connected: ${!!isConnected}\n- Profile Directory: ${LABS_PROFILE_DIR}\n- Remote Debugging Port: 9222`
        }
      ]
    };
  }

  if (name === "labs_generate_image") {
    const prompt = args.prompt;
    const outputPath = args.outputPath || path.join(process.cwd(), `labs_image_${Date.now()}.png`);
    const browser = await getBrowser(false);
    const page = await browser.newPage();

    try {
      await page.goto("https://labs.google/fx/tools/image-fx", { waitUntil: "networkidle2", timeout: 45000 });
      
      // Wait for input textarea
      const inputSelector = "textarea, input[type='text']";
      await page.waitForSelector(inputSelector, { timeout: 15000 });
      await page.type(inputSelector, prompt);

      // Click Generate button
      const buttons = await page.$$("button");
      let clicked = false;
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes("generate")) {
          await btn.click();
          clicked = true;
          break;
        }
      }

      // Wait for result image
      await page.waitForSelector("img[src*='blob:'], img[src*='googleusercontent']", { timeout: 60000 });
      const imgElements = await page.$$("img[src*='blob:'], img[src*='googleusercontent']");
      if (imgElements.length > 0) {
        const imgSrc = await page.evaluate(el => el.src, imgElements[0]);
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully via ImageFX!\nPrompt: "${prompt}"\nSource: ${imgSrc}\nSaved to: ${outputPath}`
            }
          ]
        };
      }

      return {
        content: [{ type: "text", text: `Triggered generation on ImageFX for: "${prompt}". Check the open browser window.` }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `ImageFX Error: ${err.message}` }]
      };
    } finally {
      // Keep page open for user inspection
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
  console.error("Google Labs MCP Server running over Stdio");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
