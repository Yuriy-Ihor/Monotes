import { useCallback, useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';

let sharedCtx = null;

/** One AudioContext for the whole app, created/resumed inside a user gesture. */
function audioContext() {
  if (!sharedCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

export const INSTRUMENTS = [
  { program: 0, uk: 'Фортепіано', en: 'Piano' },
  { program: 19, uk: 'Церковний орган', en: 'Church organ' },
  { program: 52, uk: 'Хор', en: 'Choir' },
  { program: 48, uk: 'Струнні', en: 'Strings' },
  { program: 73, uk: 'Флейта', en: 'Flute' },
  { program: 21, uk: 'Акордеон', en: 'Accordion' },
];

/**
 * Plays a rendered abcjs visual object and reports the currently sounding note.
 * Audio (CreateSynth) and the visual cursor (TimingCallbacks) are started at the same
 * offset so playback can begin at any note.
 */
export function usePlayer(visualObj, { tempoFactor = 1, transpose = 0, program = 0, loop = false, voicesOff, onEvent }) {
  const [status, setStatus] = useState('idle'); // idle | loading | playing | paused
  const synthRef = useRef(null);
  const timerRef = useRef(null);
  const preparedKey = useRef(null);
  const onEventRef = useRef(onEvent);
  const loopRef = useRef(loop);
  const startSecRef = useRef(0);
  onEventRef.current = onEvent;
  loopRef.current = loop;

  const settingsKey = JSON.stringify({ tempoFactor, transpose, program, voicesOff });

  const teardown = useCallback(() => {
    if (timerRef.current) timerRef.current.stop();
    if (synthRef.current) {
      try { synthRef.current.stop(); } catch (e) { /* not started */ }
    }
    timerRef.current = null;
    synthRef.current = null;
    preparedKey.current = null;
  }, []);

  // Any change of tune or settings invalidates the prepared audio buffer.
  useEffect(() => {
    teardown();
    setStatus('idle');
    if (onEventRef.current) onEventRef.current(null);
  }, [visualObj, settingsKey, teardown]);

  useEffect(() => teardown, [teardown]);

  const bpm = useCallback(() => {
    return Math.max(10, Math.round(visualObj.getBpm() * tempoFactor));
  }, [visualObj, tempoFactor]);

  const prepare = useCallback(async () => {
    if (preparedKey.current === settingsKey && synthRef.current) return;
    teardown();
    const ctx = audioContext();
    const synth = new abcjs.synth.CreateSynth();
    const qpm = bpm();
    await synth.init({
      audioContext: ctx,
      visualObj,
      millisecondsPerMeasure: visualObj.millisecondsPerMeasure(qpm),
      options: { program, midiTranspose: transpose, voicesOff, chordsOff: true },
    });
    await synth.prime();
    const timer = new abcjs.TimingCallbacks(visualObj, {
      qpm,
      beatSubdivisions: 2,
      eventCallback: (ev) => {
        if (ev) {
          if (onEventRef.current) onEventRef.current(ev);
          return undefined;
        }
        // Reached the end.
        if (loopRef.current) {
          setTimeout(() => playFromRef.current(startSecRef.current), 0);
          return 'continue';
        }
        if (synthRef.current) {
          try { synthRef.current.stop(); } catch (e) { /* ignore */ }
        }
        setStatus('idle');
        if (onEventRef.current) onEventRef.current(null);
        return undefined;
      },
    });
    synthRef.current = synth;
    timerRef.current = timer;
    preparedKey.current = settingsKey;
  }, [settingsKey, teardown, bpm, visualObj, program, transpose, voicesOff]);

  /** Start playing from `sec` seconds into the tune. */
  const playFrom = useCallback(async (sec = 0) => {
    if (!abcjs.synth.supportsAudio()) {
      alert('Audio is not supported in this browser.');
      return;
    }
    audioContext();
    setStatus('loading');
    try {
      await prepare();
    } catch (e) {
      console.error(e);
      setStatus('idle');
      alert('Audio error: ' + (e.message || e));
      return;
    }
    const synth = synthRef.current;
    const timer = timerRef.current;
    startSecRef.current = sec;
    try { synth.stop(); } catch (e) { /* ignore */ }
    timer.stop();
    synth.seek(sec, 'seconds');
    synth.start();
    if (sec > 0) timer.start(sec, 'seconds'); else timer.start(0);
    setStatus('playing');
  }, [prepare]);

  const playFromRef = useRef(playFrom);
  playFromRef.current = playFrom;

  const pause = useCallback(() => {
    if (status !== 'playing') return;
    synthRef.current.pause();
    timerRef.current.pause();
    setStatus('paused');
  }, [status]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    audioContext();
    synthRef.current.resume();
    timerRef.current.start();
    setStatus('playing');
  }, [status]);

  const stop = useCallback(() => {
    if (timerRef.current) timerRef.current.stop();
    if (synthRef.current) {
      try { synthRef.current.stop(); } catch (e) { /* ignore */ }
    }
    setStatus('idle');
    if (onEventRef.current) onEventRef.current(null);
  }, []);

  /** Millisecond offset of the first timing event that contains `startChar`. */
  const msForChar = useCallback((startChar) => {
    const qpm = bpm();
    const timings = visualObj.setTiming(qpm, 0);
    const ev = timings.find((t) => t.type === 'event' && (t.startChar === startChar
      || (t.startCharArray && t.startCharArray.includes(startChar))));
    return ev ? ev.milliseconds : null;
  }, [visualObj, bpm]);

  return { status, playFrom, pause, resume, stop, msForChar };
}

/** Play a single short note (used by the keyboards). */
export function previewNote(midi, program = 0) {
  if (!abcjs.synth.supportsAudio()) return;
  audioContext();
  abcjs.synth.playEvent([{ pitch: midi, volume: 90, start: 0, duration: 0.4, instrument: program, gap: 0 }], [], 1000)
    .catch(() => {});
}
