import { rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

await rm("dist", { force: true, recursive: true });

const common = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  loader: {
    ".png": "dataurl",
  },
  platform: "browser",
  target: ["es2020"],
  sourcemap: true,
  legalComments: "none",
};

await build({
  ...common,
  format: "iife",
  globalName: "PayIslandCheckout",
  outfile: "dist/payisland-checkout.js",
});

await build({
  ...common,
  format: "iife",
  globalName: "PayIslandCheckout",
  minify: true,
  sourcemap: false,
  outfile: "dist/payisland-checkout.min.js",
});

await build({
  ...common,
  format: "esm",
  outfile: "dist/index.mjs",
});

await build({
  ...common,
  format: "cjs",
  outfile: "dist/index.cjs",
});

execFileSync(
  "npx",
  ["tsc", "-p", "tsconfig.build.json", "--emitDeclarationOnly"],
  {
    stdio: "inherit",
  },
);
