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
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 128;
const MAX_SINGLE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_SIGNATURE = 0x02014b50;

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
    throw new Error("MusicXML custom entity declarations are not allowed / MusicXML 不允许声明自定义实体");
  }
  const parsed = xmlParser.parse(xml) as unknown;
  const record = asRecord(parsed);
  if (Object.keys(record).length === 0) throw new Error("MusicXML is empty or cannot be parsed / MusicXML 内容为空或无法解析");
  return record;
}

function validateArchivePath(path: string): void {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`MXL contains an unsafe path / MXL 包含不安全路径：${path}`);
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === bytes.byteLength) return offset;
  }
  throw new Error("MXL/ZIP central directory is missing / MXL/ZIP 缺少中央目录");
}

function validateArchiveMetadata(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("MXL archive exceeds the 25 MB safety limit / MXL 压缩文件超过 25 MB 安全限制");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes, view);
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const fileCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  if (fileCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("MXL does not support ZIP64 containers / MXL 不支持 ZIP64 容器");
  }
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== fileCount) {
    throw new Error("MXL does not support split ZIP containers / MXL 不支持分卷 ZIP 容器");
  }
  if (fileCount > MAX_ARCHIVE_FILES) throw new Error(`MXL contains more than ${MAX_ARCHIVE_FILES} files / MXL 包含超过 ${MAX_ARCHIVE_FILES} 个文件`);
  if (centralDirectoryOffset + centralDirectorySize > endOffset) throw new Error("Invalid MXL/ZIP central directory / MXL/ZIP 中央目录无效");

  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < fileCount; index += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_FILE_SIGNATURE) {
      throw new Error("Invalid MXL/ZIP central directory entry / MXL/ZIP 中央目录条目无效");
    }
    const compressedBytes = view.getUint32(offset + 20, true);
    const uncompressedBytes = view.getUint32(offset + 24, true);
    if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff) {
      throw new Error("MXL does not support ZIP64 file entries / MXL 不支持 ZIP64 文件条目");
    }
    if (uncompressedBytes > MAX_SINGLE_FILE_BYTES) throw new Error("MXL contains a file larger than 16 MB / MXL 包含超过 16 MB 的单个文件");
    if (uncompressedBytes > 0 && (compressedBytes === 0 || uncompressedBytes / compressedBytes > MAX_COMPRESSION_RATIO)) {
      throw new Error("MXL contains a file with an abnormal compression ratio / MXL 包含异常压缩比的文件");
    }
    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) throw new Error("Uncompressed MXL exceeds the 20 MB safety limit / MXL 解压后超过 20 MB 安全限制");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== centralDirectoryOffset + centralDirectorySize) throw new Error("MXL/ZIP central directory size mismatch / MXL/ZIP 中央目录大小不一致");
}

function findRootFile(containerXml: string): string {
  const parsed = parseXml(containerXml);
  const container = asRecord(parsed.container);
  const rootfiles = asRecord(container.rootfiles);
  const rootfile = asArray(rootfiles.rootfile)[0];
  const path = text(asRecord(rootfile)["@_full-path"]);
  if (!path) throw new Error("MXL is missing the rootfile declaration in META-INF/container.xml / MXL 中缺少 META-INF/container.xml 的 rootfile 声明");
  validateArchivePath(path);
  return path;
}

export function extractMusicXml(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const signature = bytes.subarray(0, Math.min(4, bytes.byteLength));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error("Not a valid MXL/ZIP container / 文件不是有效的 MXL/ZIP 容器");

  validateArchiveMetadata(bytes);
  const files = unzipSync(bytes);
  let totalBytes = 0;
  for (const [path, content] of Object.entries(files)) {
    validateArchivePath(path);
    totalBytes += content.byteLength;
  }
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new Error("Uncompressed MXL exceeds the 20 MB safety limit / MXL 解压后超过 20 MB 安全限制");

  const container = files["META-INF/container.xml"];
  if (!container) throw new Error("MXL is missing META-INF/container.xml / MXL 中缺少 META-INF/container.xml");

  const rootPath = findRootFile(decoder.decode(container));
  const score = files[rootPath];
  if (!score) throw new Error(`Score file not found in MXL / MXL 中找不到乐谱文件：${rootPath}`);

  const xml = decoder.decode(score);
  const parsed = parseXml(xml);
  if (!parsed["score-partwise"] && !parsed["score-timewise"]) {
    throw new Error("MXL root file is not a MusicXML score / MXL 根文件不是 MusicXML 乐谱");
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
    title: text(work["work-title"]) || text(score["movement-title"]) || credits[0] || "Untitled score / 未命名乐谱",
    composer:
      text(creators.find((creator) => text(creator["@_type"]).toLowerCase() === "composer")) ||
      credits.find((value) => /^(by|composer|作曲)/i.test(value)) ||
      "Unknown composer / 未知作曲者",
    partNames: parts.map((part) => text(part["part-name"])).filter(Boolean),
    measureCount: asArray(firstPart.measure).length,
    sourceSoftware: text(asArray(encoding.software)[0]) || "Unknown / 未知",
  };
}
