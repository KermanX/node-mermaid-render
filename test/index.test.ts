import { renderMermaid, runNodeMermaid } from "../src";

describe("node-mermaid", () => {
  test("mermaid.render", async () => {
    console.log(await renderMermaid("graph TD;A-->B"));
  });
});
