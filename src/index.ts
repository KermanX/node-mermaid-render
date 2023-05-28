import Mermaid from "mermaid";
import { JSDOM } from "jsdom";
import * as SVGDOM from "svgdom";

import * as vm from "node:vm";
import * as path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type MermaidFunctionKeys = {
  [K in keyof typeof Mermaid]: (typeof Mermaid)[K] extends (
    ...args: any[]
  ) => any
    ? K
    : never;
}[keyof typeof Mermaid];

type MermaidFunctions = {
  [K in MermaidFunctionKeys]: (typeof Mermaid)[K];
};

export async function runNodeMermaidAsync<FN extends keyof MermaidFunctions>(
  name: FN,
  ...args: Parameters<MermaidFunctions[FN]>
): Promise<ReturnType<MermaidFunctions[FN]>> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const mermaidSrc = path.join(__dirname, "../assets", "mermaid.min.js");

  const jsdom = new JSDOM(
    `
    <!DOCTYPE html>
    <html>
    <head>
    <script type='text/javascript'>
    ${await readFile(mermaidSrc, "utf-8")}
    </script>
    </head>
    <body>
    </body>
    </html>
  `,
    {
      //resources: //new MermaidLoader(),
      runScripts: "dangerously", //"outside-only",
    }
  );

  // Patch the Element constructor which is inherited by SVGElement to contain
  // the getBBox method to avoid runtime errors with mermaid.
  // (borrowed from https://github.com/tbranyen/diffhtml/)
  /**@ts-ignore */
  jsdom.window.Element.prototype.getBBox =
    SVGDOM.SVGGraphicsElement.prototype.getBBox;

  // Patch `jsdom.window.NodeList.prototype.reduce`, which is used in SVGDOM.
  Object.defineProperties(jsdom.window.NodeList.prototype, {
    reduce: {
      value: jsdom.window.Array.prototype.reduce,
      configurable: true,
      enumerable: true,
      writable: true,
    },
  });

  // Unfortunately this patching has to occur in order for the sanitize method
  // to return the input and not break under mermaid. Would be great to have
  // a fix that didn't involve this.
  // (borrowed from https://github.com/tbranyen/diffhtml/)
  /**@ts-ignore */
  Object.defineProperties(jsdom.window.Object, {
    sanitize: {
      value: function (x: any) {
        return x;
      },
      configurable: true,
      enumerable: true,
      writable: true,
    },
  });

  const argsKey = "__node_mermaid_args";
  const resultKey = "__node_mermaid_result";

  const vmCtx = jsdom.getInternalVMContext();
  const script = new vm.Script(`
    window.${resultKey}=mermaid.${name}(...${argsKey})
  `);

  vmCtx[argsKey] = args;
  script.runInContext(vmCtx);

  /**@ts-ignore */
  return await vmCtx[resultKey];
}

export async function render(code: string): Promise<string> {
  const result = await runNodeMermaidAsync("render", "graphDiv", code);
  return result.svg as string;
}
