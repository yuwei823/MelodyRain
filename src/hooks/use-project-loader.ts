import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { matchProjectFolderAssets, type MatchedProjectAssets } from "../lib/asset-folder";
import {
  canReadFolder,
  canRememberFolder,
  chooseAssetFolder,
  filesInFolder,
  lastRememberedAssetFolder,
  rememberAssetFolder,
} from "../lib/remembered-folder";
import { parseMidi, type MidiSummary } from "../lib/midi";
import { extractMusicXml, summarizeMusicXml, type ScoreSummary } from "../lib/mxl";

export interface LoadedProject {
  label: string;
  musicXml: string;
  score: ScoreSummary;
  midi: MidiSummary;
  audioUrl: string;
  backgrounds: File[];
  revokeAudioUrl?: boolean;
}

interface UseProjectLoaderOptions {
  onProjectLoaded(project: LoadedProject): void;
}

async function readScoreFile(file: File): Promise<string> {
  return file.name.toLowerCase().endsWith(".mxl")
    ? extractMusicXml(await file.arrayBuffer())
    : file.text();
}

export function useProjectLoader({ onProjectLoaded }: UseProjectLoaderOptions) {
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [status, setStatus] = useState("请选择素材文件夹");
  const [error, setError] = useState<string | null>(null);
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundFiles, setBackgroundFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const loadRequestRef = useRef(0);
  const remembersFolders = canRememberFolder();

  const adoptProject = useCallback((nextProject: LoadedProject) => {
    setProject(nextProject);
    onProjectLoaded(nextProject);
    setError(null);
  }, [onProjectLoaded]);

  const loadLocalFiles = useCallback(async (
    assets: MatchedProjectAssets<File>,
    requestId: number,
  ) => {
    setStatus("正在解析本地文件…");
    setError(null);
    try {
      const [musicXml, midiBuffer] = await Promise.all([
        readScoreFile(assets.score),
        assets.midi.arrayBuffer(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      adoptProject({
        label: assets.score.name,
        musicXml,
        score: summarizeMusicXml(musicXml),
        midi: parseMidi(midiBuffer),
        audioUrl: URL.createObjectURL(assets.audio),
        backgrounds: assets.backgrounds,
        revokeAudioUrl: true,
      });
      setStatus("本地文件已加载");
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setStatus("解析失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [adoptProject]);

  const selectAssetFolderFromFiles = useCallback((files: File[]) => {
    const requestId = ++loadRequestRef.current;
    setScoreFile(null);
    setMidiFile(null);
    setAudioFile(null);
    setBackgroundFiles([]);
    if (files.length === 0) {
      setStatus("尚未选择素材文件夹");
      return;
    }
    try {
      const matched = matchProjectFolderAssets(files);
      setScoreFile(matched.score);
      setMidiFile(matched.midi);
      setAudioFile(matched.audio);
      setBackgroundFiles(matched.backgrounds);
      setError(null);
      void loadLocalFiles(matched, requestId);
    } catch (caught) {
      setStatus("素材匹配失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loadLocalFiles]);

  const selectAssetFolder = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    setFolderName(files?.[0]?.webkitRelativePath.split("/")[0] ?? null);
    selectAssetFolderFromFiles(files ? [...files] : []);
  }, [selectAssetFolderFromFiles]);

  const loadRememberedFolder = useCallback(async () => {
    try {
      const handle = await lastRememberedAssetFolder();
      if (!handle) return;
      setFolderName(handle.name);
      if (!await canReadFolder(handle)) {
        setStatus(`已记住“${handle.name}”，请重新选择以授权读取。`);
        return;
      }
      setStatus(`正在重新读取“${handle.name}”…`);
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
      setFolderName(handle.name);
      selectAssetFolderFromFiles(await filesInFolder(handle));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [remembersFolders, selectAssetFolderFromFiles]);

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
    folderName,
    folderInputRef,
    remembersFolders,
    selectAssetFolder,
    chooseAndLoadAssetFolder,
  };
}
