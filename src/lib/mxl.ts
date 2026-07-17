import { unzipSync } from "fflate";

const decoder = new TextDecoder("utf-8");

function parseXml(xml: string): XMLDocument {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const error = document.querySelector("parsererror");
  if (error) {
    throw new Error(`MusicXML 解析失败：${error.textContent?.trim() ?? "未知错误"}`);
  }
  return document;
}

function findRootFile(containerXml: string): string {
  const document = parseXml(containerXml);
  const path = document.querySelector("rootfile")?.getAttribute("full-path");
  if (!path) {
    throw new Error("MXL 中缺少 META-INF/container.xml 的 rootfile 声明");
  }
  return path;
}

export function extractMusicXml(buffer: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const container = files["META-INF/container.xml"];
  if (!container) {
    throw new Error("MXL 中缺少 META-INF/container.xml");
  }

  const rootPath = findRootFile(decoder.decode(container));
  const score = files[rootPath];
  if (!score) {
    throw new Error(`MXL 中找不到乐谱文件：${rootPath}`);
  }

  const xml = decoder.decode(score);
  parseXml(xml);
  return xml;
}

export interface ScoreSummary {
  title: string;
  composer: string;
  partNames: string[];
  measureCount: number;
  sourceSoftware: string;
}

export function summarizeMusicXml(xml: string): ScoreSummary {
  const document = parseXml(xml);
  const title =
    document.querySelector("work-title")?.textContent?.trim() ||
    document.querySelector("movement-title")?.textContent?.trim() ||
    document.querySelector("credit-words")?.textContent?.trim() ||
    "未命名乐谱";
  const composer =
    document.querySelector('creator[type="composer"]')?.textContent?.trim() ||
    [...document.querySelectorAll("credit-words")]
      .map((element) => element.textContent?.trim() ?? "")
      .find((value) => /^(by|composer|作曲)/i.test(value)) ||
    "未知作曲者";

  return {
    title,
    composer,
    partNames: [...document.querySelectorAll("score-part > part-name")]
      .map((element) => element.textContent?.trim() ?? "")
      .filter(Boolean),
    measureCount: document.querySelectorAll("part:first-of-type > measure").length,
    sourceSoftware: document.querySelector("identification encoding software")?.textContent?.trim() || "未知",
  };
}
