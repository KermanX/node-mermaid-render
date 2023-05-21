import Mermaid from "mermaid";
import { JSDOM } from "jsdom";
import JSSVG from "jssvg";

import * as vm from "node:vm";

type MermaidFunctions = {
  [K in keyof typeof Mermaid]: (typeof Mermaid)[K] extends (
    ...args: any[]
  ) => any
    ? (typeof Mermaid)[K]
    : never;
};

export function runNodeMermaid<FN extends keyof MermaidFunctions>(
  name: FN,
  ...args: Parameters<MermaidFunctions[FN]>
) {
  const { window } = new JSDOM("");

  // Patch the Element constructor which is inherited by SVGElement to contain
  // the getBBox method to avoid runtime errors with mermaid.
  /**@ts-ignore */
  //window.Element.prototype.getBBox = JSSVG.SVGGraphicsElement.prototype.getBBox;

  const ctx = {
    document: window.document,
    window,
    Mermaid,
    args,
    result: undefined as ReturnType<MermaidFunctions[FN]>,
    test(){
      console.log(document)
    }
  };
  vm.runInNewContext(
    `
    result=Mermaid.${name}(...args);
`,
    ctx
  );

  return ctx;
}

export async function renderMermaid(code: string): Promise<string> {
  const { result } = runNodeMermaid("render", "graphDiv", code);
  return (await result).svg;
}
