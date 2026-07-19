import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { matchProjectFolderAssets, type MatchedProjectAssets } from "../lib/asset-folder";
import {
  canReadFolder,
  canRememberFolder,
  chooseAssetFolder,
  filesInFolder,
  lastRememberedAssetFolder,
  rememberAssetFolder,
  type RememberedDirectoryHandle,
} from "../lib/remembered-folder";
import { parseMidi, type MidiSummary } from "../lib/midi";
import { extractMusicXml, summarizeMusicXml, type ScoreSummary } from "../lib/mxl";
import {
  PROJECT_SETTINGS_FILE_NAME,
  findProjectSettingsFile,
  parseProjectSettings,
  serializeProjectSettings,
  type ProjectSettings,
} from "../lib/project-settings";

export interface LoadedProject {
  label: string;
  musicXml: string;
  score: ScoreSummary;
  midi: MidiSummary;
  audioUrl: string;
  backgrounds: File[];
  settings?: ProjectSettings;
  revokeAudioUrl?: boolean;
}

interface UseProjectLoaderOptions {
  onProjectLoaded(project: LoadedProject): void;
  onSettingsLoaded(settings: ProjectSettings): void;
}

async function readScoreFile(file: File): Promise<string> {
  return file.name.toLowerCase().endsWith(".mxl")
    ? extractMusicXml(await file.arrayBuffer())
    : file.text();
}

export function useProjectLoader({ onProjectLoaded, onSettingsLoaded }: UseProjectLoaderOptions) {
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [status, setStatus] = useState("Choose a media folder / 请选择素材文件夹");
  const [error, setError] = useState<string | null>(null);
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundFiles, setBackgroundFiles] = useState<File[]>([]);
  const [settingsFile, setSettingsFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const directoryHandleRef = useRef<RememberedDirectoryHandle | null>(null);
  const loadRequestRef = useRef(0);
  const remembersFolders = canRememberFolder();

  const adoptProject = useCallback((nextProject: LoadedProject) => {
    setProject(nextProject);
    onProjectLoaded(nextProject);
    setError(null);
  }, [onProjectLoaded]);

  const loadLocalFiles = useCallback(async (
    assets: MatchedProjectAssets<File>,
    projectSettingsFile: File | null,
    requestId: number,
  ) => {
    setStatus("Parsing local files… / 正在解析本地文件…");
    setError(null);
    try {
      const [musicXml, midiBuffer] = await Promise.all([
        readScoreFile(assets.score),
        assets.midi.arrayBuffer(),
      ]);
      if (requestId !== loadRequestRef.current) return;

      let settings: ProjectSettings | undefined;
      let settingsError: string | null = null;
      if (projectSettingsFile) {
        try {
          settings = parseProjectSettings(await projectSettingsFile.text());
        } catch (caught) {
          settingsError = caught instanceof Error ? caught.message : String(caught);
        }
      }
      if (requestId !== loadRequestRef.current) return;

      adoptProject({
        label: assets.score.name,
        musicXml,
        score: summarizeMusicXml(musicXml),
        midi: parseMidi(midiBuffer),
        audioUrl: URL.createObjectURL(assets.audio),
        backgrounds: assets.backgrounds,
        settings,
        revokeAudioUrl: true,
      });
      setStatus(settings ? "Media and settings loaded / 素材和参数已加载" : "Local media loaded / 本地素材已加载");
      if (settingsError) setError(`Media loaded, but settings could not be read / 素材已加载，但参数文件读取失败：${settingsError}`);
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setStatus("Parsing failed / 解析失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [adoptProject]);

  const selectAssetFolderFromFiles = useCallback((files: File[]) => {
    const requestId = ++loadRequestRef.current;
    setScoreFile(null);
    setMidiFile(null);
    setAudioFile(null);
    setBackgroundFiles([]);
    setSettingsFile(null);
    if (files.length === 0) {
      setStatus("No media folder selected / 尚未选择素材文件夹");
      return;
    }
    try {
      const matched = matchProjectFolderAssets(files);
      const nextSettingsFile = findProjectSettingsFile(files);
      setScoreFile(matched.score);
      setMidiFile(matched.midi);
      setAudioFile(matched.audio);
      setBackgroundFiles(matched.backgrounds);
      setSettingsFile(nextSettingsFile);
      setError(null);
      void loadLocalFiles(matched, nextSettingsFile, requestId);
    } catch (caught) {
      setStatus("Media matching failed / 素材匹配失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loadLocalFiles]);

  const selectAssetFolder = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    directoryHandleRef.current = null;
    setFolderName(files?.[0]?.webkitRelativePath.split("/")[0] ?? null);
    selectAssetFolderFromFiles(files ? [...files] : []);
  }, [selectAssetFolderFromFiles]);

  const loadExportJob = useCallback(async (jobId: string) => {
    setStatus("Loading export project… / 正在加载导出项目…");
    try {
      const response = await fetch(`/api/export/jobs/${encodeURIComponent(jobId)}/manifest`);
      if (!response.ok) throw new Error(`Export project unavailable (${response.status}) / 导出项目不可用`);
      const manifest = await response.json() as {
        assets: Array<{ field: string; name: string; url: string }>;
      };
      const files = await Promise.all(manifest.assets.map(async (asset) => {
        const assetResponse = await fetch(asset.url);
        if (!assetResponse.ok) throw new Error(`Unable to load ${asset.name} / 无法加载素材`);
        return new File([await assetResponse.blob()], asset.name, {
          type: assetResponse.headers.get("content-type") ?? "application/octet-stream",
        });
      }));
      setFolderName("Export job / 导出任务");
      selectAssetFolderFromFiles(files);
    } catch (caught) {
      setStatus("Export project failed / 导出项目加载失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [selectAssetFolderFromFiles]);

  const loadRememberedFolder = useCallback(async () => {
    try {
      const handle = await lastRememberedAssetFolder();
      if (!handle) return;
      setFolderName(handle.name);
      if (!await canReadFolder(handle)) {
        setStatus(`Remembered “${handle.name}”; select it again to grant access. / 已记住“${handle.name}”，请重新选择以授权读取。`);
        return;
      }
      directoryHandleRef.current = handle;
      setStatus(`Reloading “${handle.name}”… / 正在重新读取“${handle.name}”…`);
      selectAssetFolderFromFiles(await filesInFolder(handle));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [selectAssetFolderFromFiles]);

  useEffect(() => {
    if (remembersFolders) void loadRememberedFolder();
  }, [loadRememberedFolder, remembersFolders]);

  const chooseAndLoadAssetFolder = useCallback(async () => {
    if (!remembersFolders) {
      folderInputRef.current?.click();
      return;
    }
    try {
      const handle = await chooseAssetFolder();
      await rememberAssetFolder(handle);
      directoryHandleRef.current = handle;
      setFolderName(handle.name);
      selectAssetFolderFromFiles(await filesInFolder(handle));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [remembersFolders, selectAssetFolderFromFiles]);

  const applySettingsFile = useCallback(async (file: File) => {
    try {
      const settings = parseProjectSettings(await file.text());
      setSettingsFile(file);
      onSettingsLoaded(settings);
      setStatus(`Settings loaded / 参数已读取：${file.name}`);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [onSettingsLoaded]);

  const readProjectSettings = useCallback(() => {
    if (settingsFile) {
      void applySettingsFile(settingsFile);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void applySettingsFile(file);
    }, { once: true });
    input.click();
  }, [applySettingsFile, settingsFile]);

  const saveProjectSettings = useCallback(async (settings: ProjectSettings) => {
    const content = serializeProjectSettings(settings);
    const handle = directoryHandleRef.current;
    try {
      if (handle?.getFileHandle) {
        let permission = await handle.queryPermission?.({ mode: "readwrite" });
        if (permission !== "granted") permission = await handle.requestPermission?.({ mode: "readwrite" });
        if (permission !== "granted") throw new Error("No write access to the media folder / 未获得素材文件夹写入权限");
        const fileHandle = await handle.getFileHandle(PROJECT_SETTINGS_FILE_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        setSettingsFile(new File([content], PROJECT_SETTINGS_FILE_NAME, { type: "application/json" }));
        setStatus(`Settings saved to media folder / 参数已保存到素材文件夹：${PROJECT_SETTINGS_FILE_NAME}`);
      } else {
        const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = PROJECT_SETTINGS_FILE_NAME;
        link.click();
        URL.revokeObjectURL(url);
        setStatus(`Settings exported; place ${PROJECT_SETTINGS_FILE_NAME} in the media folder / 参数文件已导出，请将 ${PROJECT_SETTINGS_FILE_NAME} 放入素材文件夹`);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const saveVideoToAssetFolder = useCallback(async (blob: Blob, fileName: string): Promise<boolean> => {
    const handle = directoryHandleRef.current;
    if (!handle?.getFileHandle) return false;
    let permission = await handle.queryPermission?.({ mode: "readwrite" });
    if (permission !== "granted") permission = await handle.requestPermission?.({ mode: "readwrite" });
    if (permission !== "granted") return false;
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }, []);

  useEffect(
    () => () => {
      if (project?.revokeAudioUrl) URL.revokeObjectURL(project.audioUrl);
    },
    [project],
  );

  return {
    project,
    status,
    error,
    setStatus,
    setError,
    scoreFile,
    midiFile,
    audioFile,
    backgroundFiles,
    settingsFile,
    folderName,
    folderInputRef,
    remembersFolders,
    selectAssetFolder,
    chooseAndLoadAssetFolder,
    readProjectSettings,
    saveProjectSettings,
    saveVideoToAssetFolder,
    loadExportJob,
  };
}
