import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MidiTimeline } from "../lib/midi";
import { MediaTransport, TRANSPORT_PRE_ROLL_MS, type TransportSnapshot } from "../lib/transport";
import type { LoadedProject } from "./use-project-loader";

const EMPTY_SNAPSHOT: TransportSnapshot = {
  state: "idle", sourceTimeMs: -TRANSPORT_PRE_ROLL_MS - 1, durationMs: 0,
  scoreQuarter: 0, tempoScale: 1, effectiveBpm: 120, progress: 0,
  activeNoteIds: [],
};
const PLAYING_UI_REFRESH_INTERVAL_MS = 50;

export function useMediaTransport(project: LoadedProject | null, onFrame: (snapshot: TransportSnapshot) => void) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transportRef = useRef<MediaTransport | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => { setSnapshot(EMPTY_SNAPSHOT); }, [project]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !project) return;
    transportRef.current?.dispose();
    audio.src = project.audioUrl;
    audio.load();
    const transport = new MediaTransport(audio, new MidiTimeline(project.midi));
    transportRef.current = transport;
    let lastPublishedAt = Number.NEGATIVE_INFINITY;
    let lastPublishedState: TransportSnapshot["state"] | null = null;
    let lastPublishedTempoScale = 0;
    const unsubscribe = transport.subscribe((nextSnapshot) => {
      onFrameRef.current(nextSnapshot);
      const now = performance.now();
      const controlsChanged = nextSnapshot.state !== lastPublishedState || nextSnapshot.tempoScale !== lastPublishedTempoScale;
      if (nextSnapshot.state !== "playing" || controlsChanged || now - lastPublishedAt >= PLAYING_UI_REFRESH_INTERVAL_MS) {
        lastPublishedAt = now;
        lastPublishedState = nextSnapshot.state;
        lastPublishedTempoScale = nextSnapshot.tempoScale;
        setSnapshot(nextSnapshot);
      }
    });
    return () => {
      unsubscribe();
      transport.dispose();
      if (transportRef.current === transport) transportRef.current = null;
    };
  }, [project]);

  // The id->event map only changes with the project, so it stays memoized
  // across the 50ms UI refreshes; only the tiny id lookup list rebuilds.
  const eventsById = useMemo(
    () => new Map(project?.midi.events.map((event) => [event.id, event]) ?? []),
    [project],
  );
  const activeNotes = useMemo(
    () => snapshot.activeNoteIds.flatMap((id) => eventsById.get(id) ?? []),
    [eventsById, snapshot.activeNoteIds],
  );
  const currentSourceTimeMs = useCallback(() => transportRef.current?.snapshot().sourceTimeMs ?? -TRANSPORT_PRE_ROLL_MS - 1, []);

  return { snapshot, activeNotes, audioRef, currentSourceTimeMs,
    toggle: () => transportRef.current?.toggle(), rewind: () => transportRef.current?.rewind(),
    seek: (progress: number) => transportRef.current?.seek(progress),
    setTempoScale: (scale: number) => transportRef.current?.setTempoScale(scale) };
}
