import fs from "node:fs";
import path from "node:path";

export function readAppVersion(projectRoot: string): string {
  const packagePath = path.join(projectRoot, "package.json");
  const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`package.json 缺少有效版本号：${packagePath}`);
  }
  return parsed.version;
}
