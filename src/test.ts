const code = `
graph LR;
A-->B
B-->C
C-->D
D-->A
`;

import { renderToSVG } from "./index.js";

(async () => {
    const svg = await renderToSVG(code);
    console.log(svg.data.toString());
    }
)();