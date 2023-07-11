import puppeteer, {
  type Viewport,
  type Browser,
  type PuppeteerLaunchOptions,
} from "puppeteer";
import type { MermaidConfig, Mermaid } from "mermaid";

import * as path from "node:path";
import * as url from "node:url";

interface RenderResult {
  title: string | null;
  desc: string | null;
  data: Buffer;
}

async function renderMermaid(
  browser: Browser,
  definition: string,
  outputFormat: "svg" | "png" | "pdf",
  viewport?: Viewport,
  backgroundColor: string = "white",
  mermaidConfig: MermaidConfig = {},
  myCSS?: string,
  pdfFit: boolean = false
): Promise<RenderResult> {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    console.log(msg.text());
  });
  try {
    if (viewport) {
      await page.setViewport(viewport);
    }
    const dirname =
      __dirname ?? url.fileURLToPath(new url.URL(".", import.meta.url));
    const mermaidHTMLPath = path.join(dirname, "index.html");
    await page.goto(url.pathToFileURL(mermaidHTMLPath).href);
    await page.$eval(
      "body",
      (body, backgroundColor) => {
        body.style.background = backgroundColor;
      },
      backgroundColor
    );
    const metadata = await page.$eval(
      "#container",
      async (container, definition, mermaidConfig, myCSS, backgroundColor) => {
        const { mermaid } = globalThis as any as { mermaid: Mermaid };
        mermaid.initialize({ startOnLoad: false, ...mermaidConfig });

        // should throw an error if mmd diagram is invalid
        const { svg: svgText } = await mermaid.render(
          "my-svg",
          definition,
          container
        );
        container.innerHTML = svgText;

        const svg = container.getElementsByTagName?.("svg")?.[0];
        if (svg?.style) {
          svg.style.backgroundColor = backgroundColor;
        } else {
          // ("svg not found. Not applying background color.")
        }
        if (myCSS) {
          // add CSS as a <svg>...<style>... element
          // see https://developer.mozilla.org/en-US/docs/Web/API/SVGStyleElement
          const style = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "style"
          );
          style.appendChild(document.createTextNode(myCSS));
          svg.appendChild(style);
        }

        // Finds SVG metadata for accessibility purposes
        /** SVG title */
        let title = null;
        // If <title> exists, it must be the first child Node,
        // see https://www.w3.org/TR/SVG11/struct.html#DescriptionAndTitleElements
        /* global SVGTitleElement, SVGDescElement */ // These exist in browser-based code
        if (svg.firstChild instanceof SVGTitleElement) {
          title = svg.firstChild.textContent;
        }
        /** SVG description. According to SVG spec, we should use the first one we find */
        let desc = null;
        for (const svgNode of svg.children) {
          if (svgNode instanceof SVGDescElement) {
            desc = svgNode.textContent;
          }
        }
        return {
          title,
          desc,
        };
      },
      definition,
      mermaidConfig,
      myCSS,
      backgroundColor
    );

    if (outputFormat === "svg") {
      const svgXML = await page.$eval("svg", (svg) => {
        // SVG might have HTML <foreignObject> that are not valid XML
        // E.g. <br> must be replaced with <br/>
        // Luckily the DOM Web API has the XMLSerializer for this
        // eslint-disable-next-line no-undef
        const xmlSerializer = new XMLSerializer();
        return xmlSerializer.serializeToString(svg);
      });
      return {
        ...metadata,
        data: Buffer.from(svgXML, "utf8"),
      };
    } else if (outputFormat === "png") {
      const clip = await page.$eval("svg", (svg) => {
        const react = svg.getBoundingClientRect();
        return {
          x: Math.floor(react.left),
          y: Math.floor(react.top),
          width: Math.ceil(react.width),
          height: Math.ceil(react.height),
        };
      });
      await page.setViewport({
        ...viewport,
        width: clip.x + clip.width,
        height: clip.y + clip.height,
      });
      return {
        ...metadata,
        data: await page.screenshot({
          clip,
          omitBackground: backgroundColor === "transparent",
        }),
      };
    } else {
      // pdf
      if (pdfFit) {
        const clip = await page.$eval("svg", (svg) => {
          const react = svg.getBoundingClientRect();
          return {
            x: react.left,
            y: react.top,
            width: react.width,
            height: react.height,
          };
        });
        return {
          ...metadata,
          data: await page.pdf({
            omitBackground: backgroundColor === "transparent",
            width: Math.ceil(clip.width) + clip.x * 2 + "px",
            height: Math.ceil(clip.height) + clip.y * 2 + "px",
            pageRanges: "1-1",
          }),
        };
      } else {
        return {
          ...metadata,
          data: await page.pdf({
            omitBackground: backgroundColor === "transparent",
          }),
        };
      }
    }
  } finally {
    await page.close();
  }
}

export class NodeMermaidRender {
  protected browser: Browser | null = null;

  constructor(
    public puppeteerConfig: PuppeteerLaunchOptions = {
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }
  ) {}

  public async launch() {
    if (this.browser) {
      return;
    }
    this.browser = await puppeteer.launch(this.puppeteerConfig);
  }

  public async close() {
    if (!this.browser) {
      return;
    }
    await this.browser.close();
  }

  public async renderToSVG(
    definition: string,
    viewport?: Viewport,
    backgroundColor: string | "transparent" = "white",
    mermaidConfig: MermaidConfig = {},
    myCSS?: CSSStyleDeclaration["cssText"]
  ): Promise<RenderResult> {
    await this.launch();
    return await renderMermaid(
      this.browser,
      definition,
      "svg",
      viewport,
      backgroundColor,
      mermaidConfig,
      myCSS
    );
  }

  public async renderToPDF(
    definition: string,
    viewport?: Viewport,
    backgroundColor: string | "transparent" = "white",
    mermaidConfig: MermaidConfig = {},
    myCSS?: CSSStyleDeclaration["cssText"],
    pdfFit = false
  ): Promise<RenderResult> {
    await this.launch();
    return await renderMermaid(
      this.browser,
      definition,
      "pdf",
      viewport,
      backgroundColor,
      mermaidConfig,
      myCSS,
      pdfFit
    );
  }

  public async renderToPNG(
    definition: string,
    viewport?: Viewport,
    backgroundColor: string | "transparent" = "white",
    mermaidConfig: MermaidConfig = {},
    myCSS?: CSSStyleDeclaration["cssText"]
  ): Promise<RenderResult> {
    await this.launch();
    return await renderMermaid(
      this.browser,
      definition,
      "png",
      viewport,
      backgroundColor,
      mermaidConfig,
      myCSS
    );
  }
}
