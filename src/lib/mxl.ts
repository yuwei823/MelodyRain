import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";

const decoder = new TextDecoder("utf-8", { fatal: true });
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  processEntities: false,
  trimValues: true,
});

const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;

type XmlRecord = Record<string, unknown>;

function asRecord(value: unknown): XmlRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as XmlRecord) : {};
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  const record = asRecord(value);
  return typeof record["#text"] === "string" ? record["#text"].trim() : "";
}

function parseXml(xml: string): XmlRecord {
  if (/<!ENTITY\s/i.test(xml)) {
    throw new Error("MusicXML 不允许声明自定义实体");
  }
  const parsed = xmlParser.parse(xml) as unknown;
  const record = asRecord(parsed);
  if (Object.keys(record).length === 0) throw new Error("MusicXML 内容为空或无法解析");
  return record;
}

function validateArchivePath(path: string): void {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`MXL 包含不安全路径：${path}`);
  }
}

function findRootFile(containerXml: string): string {
  const parsed = parseXml(containerXml);
  const container = asRecord(parsed.container);
  const rootfiles = asRecord(container.rootfiles);
  const rootfile = asArray(rootfiles.rootfile)[0];
  const path = text(asRecord(rootfile)["@_full-path"]);
  if (!path) throw new Error("MXL 中缺少 META-INF/container.xml 的 rootfile 声明");
  validateArchivePath(path);
  return path;
}

export function extractMusicXml(buffer: ArrayBuffer): string {
  const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error("文件不是有效的 MXL/ZIP 容器");

  const files = unzipSync(new Uint8Array(buffer));
  let totalBytes = 0;
  for (const [path, content] of Object.entries(files)) {
    validateArchivePath(path);
    totalBytes += content.byteLength;
  }
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new Error("MXL 解压后超过 20 MB 安全限制");

  const container = files["META-INF/container.xml"];
  if (!container) throw new Error("MXL 中缺少 META-INF/container.xml");

  const rootPath = findRootFile(decoder.decode(container));
  const score = files[rootPath];
  if (!score) throw new Error(`MXL 中找不到乐谱文件：${rootPath}`);

  const xml = decoder.decode(score);
  const parsed = parseXml(xml);
  if (!parsed["score-partwise"] && !parsed["score-timewise"]) {
    throw new Error("MXL 根文件不是 MusicXML 乐谱");
  }
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
  const parsed = parseXml(xml);
  const score = asRecord(parsed["score-partwise"] ?? parsed["score-timewise"]);
  const work = asRecord(score.work);
  const identification = asRecord(score.identification);
  const encoding = asRecord(identification.encoding);
  const creators = asArray(identification.creator).map(asRecord);
  const credits = asArray(score.credit).flatMap((credit) =>
    asArray(asRecord(credit)["credit-words"]).map(text).filter(Boolean),
  );
  const partList = asRecord(score["part-list"]);
  const parts = asArray(partList["score-part"]).map(asRecord);
  const firstPart = asRecord(asArray(score.part)[0]);

  return {
    title: text(work["work-title"]) || text(score["movement-title"]) || credits[0] || "未命名乐谱",
    composer:
      text(creators.find((creator) => text(creator["@_type"]).toLowerCase() === "composer")) ||
      credits.find((value) => /^(by|composer|作曲)/i.test(value)) ||
      "未知作曲者",
    partNames: parts.map((part) => text(part["part-name"])).filter(Boolean),
    measureCount: asArray(firstPart.measure).length,
    sourceSoftware: text(asArray(encoding.software)[0]) || "未知",
  };
}
