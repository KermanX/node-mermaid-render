# node-mermaid-render

Render Mermaid charts in Node.js environment.

Also can be seen as a simplified version of [mermaid-cli](https://github.com/mermaid-js/mermaid-cli/) with better API support.

Most of its core code is from [mermaid-cli](https://github.com/mermaid-js/mermaid-cli/).

## Install

```bash
npm install node-mermaid-render
```

## Usage

```typescript
import { NodeMermaidRender } from "node-mermaid-render";

const mermaidRender = new NodeMermaidRender();

(async () => {
  // Initialize mermaid render.
  // If don't call this method, it will be called automatically when calling rendering method.
  // Remember to call it with `await` keyword.
  await mermaidRender.initialize();

  const svg = await mermaidRender.renderToSVG(`
    graph TD;
      A-->B;
      A-->C;
      B-->D;
      C-->D;
  `).data.toString();
})();
```
