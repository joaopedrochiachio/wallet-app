"use client";

import { useEffect, useState } from "react";

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function useCalendarDay(): Date {
  const [day, setDay] = useState(todayKey);
  useEffect(() => {
    const refresh = () => setDay(todayKey());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return new Date(`${day}T12:00:00`);
}
