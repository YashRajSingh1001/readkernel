import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const stubs = {
  "server-only": "export {};",
  "next/cache": "export function cacheLife() {}",
};

export function resolve(specifier, context, nextResolve) {
  if (specifier in stubs) {
    return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  }
  const local = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), root)
    : specifier.startsWith(".") && context.parentURL?.startsWith(root.href)
      ? new URL(specifier, context.parentURL)
      : null;
  if (local) {
    for (const suffix of ["", ".ts", ".tsx"]) {
      const url = new URL(local.href + suffix);
      if (existsSync(url)) return nextResolve(url.href, context);
    }
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url.startsWith(root.href) && !url.includes("/node_modules/")) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")}`, shortCircuit: true };
    }
    if (/\.tsx?$/.test(url)) {
      const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        fileName: fileURLToPath(url),
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
