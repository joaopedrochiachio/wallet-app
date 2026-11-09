import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Bundle isolado de componentes reais, com dependências de dados substituídas pelo teste. */
export async function buildFixture(name: string, entry: string, mocks: Record<string, string>) {
  const root = process.cwd();
  const require = createRequire(path.join(root, "package.json"));
  const directory = path.join(root, "node_modules/.cache", name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "entry.tsx"), entry);
  const loader = path.join(directory, "loader.cjs");
  await writeFile(loader, `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
  const aliases: Record<string, string> = {};
  let index = 0;
  for (const [module, source] of Object.entries(mocks)) {
    const file = path.join(directory, `mock-${index++}.tsx`);
    await writeFile(file, source);
    aliases[`${module}$`] = file;
  }
  const imageMock = path.join(directory, "next-image.tsx");
  await writeFile(imageMock, 'import React from "react"; export default function Image({fill,priority,unoptimized,...props}) { return <img {...props}/>; }');
  aliases["next/image$"] = imageMock;
  aliases["@"] = root;
  const webpack = require("next/dist/compiled/webpack/webpack").webpack;
  await new Promise<void>((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, entry: path.join(directory, "entry.tsx"), output: { path: directory, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: aliases }, module: { rules: [{ test: /\.tsx?$/, use: loader }] } });
    compiler.run((error: Error | null, stats: { hasErrors(): boolean; toString(options: object): string }) => {
      compiler.close(() => {});
      if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
      else resolve();
    });
  });
  const postcss = require("postcss");
  const tailwind = require("@tailwindcss/postcss");
  const stylesheet = await postcss([tailwind()]).process(await readFile(path.join(root, "app/globals.css"), "utf8"), { from: path.join(root, "app/globals.css") });
  return { directory, bundle: await readFile(path.join(directory, "bundle.js"), "utf8"), css: `:root{--font-sf-pro:system-ui;--font-sf-mono:monospace;}\n${stylesheet.css}` };
}
