import { useEffect, useState } from "react";

function parseDate(str: string): Date {
  return new Date(str.endsWith("Z") ? str : str + "Z");
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function useCountdown(createdAt: string, expiredAt: string): string {
  const [timeLeft, setTimeLeft] = useState(() => {
    const created = parseDate(createdAt);
    const expired = parseDate(expiredAt);
    const totalDuration = expired.getTime() - created.getTime();
    const now = new Date();
    const elapsed = now.getTime() - created.getTime();
    const remaining = totalDuration - elapsed;

    return remaining <= 0 ? "Expired" : formatTime(remaining);
  });

  useEffect(() => {
    const created = parseDate(createdAt);
    const expired = parseDate(expiredAt);
    const totalDuration = expired.getTime() - created.getTime();

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - created.getTime();
      const remaining = totalDuration - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft("Expired");
      } else {
        setTimeLeft(formatTime(remaining));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt, expiredAt]);

  return timeLeft;
}
