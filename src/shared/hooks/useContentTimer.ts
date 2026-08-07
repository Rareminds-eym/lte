import { useCallback, useEffect, useRef } from "react";

export interface UseContentTimerParams {
  contentId: string | null | undefined;
  enabled?: boolean;
  onTimerEnd: (
    durationSeconds: number,
    reason: "content-change" | "page-exit",
  ) => void | Promise<void>;
}

const getNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export function useContentTimer({ contentId, enabled = true, onTimerEnd }: UseContentTimerParams) {
  const onTimerEndRef = useRef(onTimerEnd);
  const activeStartedAtRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const reportedSecondsRef = useRef(0);

  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
  }, [onTimerEnd]);

  const pause = useCallback(() => {
    if (activeStartedAtRef.current === null) return;

    elapsedMsRef.current += getNow() - activeStartedAtRef.current;
    activeStartedAtRef.current = null;
  }, []);

  const resume = useCallback(() => {
    if (!enabled || !contentId || document.visibilityState === "hidden") return;
    if (activeStartedAtRef.current !== null) return;

    activeStartedAtRef.current = getNow();
  }, [contentId, enabled]);

  const flush = useCallback(
    (reason: "content-change" | "page-exit" = "content-change") => {
      pause();

      const totalSeconds = Math.floor(elapsedMsRef.current / 1000);
      const durationSeconds = totalSeconds - reportedSecondsRef.current;

      if (durationSeconds <= 0) return;

      reportedSecondsRef.current = totalSeconds;
      void onTimerEndRef.current(durationSeconds, reason);
    },
    [pause],
  );

  useEffect(() => {
    elapsedMsRef.current = 0;
    reportedSecondsRef.current = 0;
    activeStartedAtRef.current = null;
    resume();

    return () => {
      flush("content-change");
    };
  }, [contentId, flush, resume]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush("content-change");
        return;
      }

      resume();
    };

    const handlePageHide = () => {
      flush("page-exit");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [flush, resume]);
}
