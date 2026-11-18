"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { seed, type Store, type Match } from "@/lib/domain";
import { demoRepository } from "@/lib/repository";
export const Context = createContext<null | {
  s: Store;
  live?: boolean;
  organizer?: boolean;
  update: (fn: (s: Store) => void) => void;
  mutate: (id: string, fn: (m: Match, s: Store) => void) => void;
  notice: string;
  notify: (s: string) => void;
}>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [s, set] = useState(seed);
  const [ready, setReady] = useState(false);
  const [notice, notify] = useState("");
  useEffect(() => {
    let mounted = true;
    demoRepository
      .load()
      .then((data) => {
        if (mounted) set(data);
      })
      .catch(() => {
        if (mounted)
          notify("Saved data could not be read. Sample data loaded.");
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  function update(fn: (s: Store) => void) {
    try {
      const next = structuredClone(s);
      fn(next);
      set(next);
      try {
        demoRepository.save(next);
      } catch {
        notify(
          "Browser storage unavailable. Changes last only for this session.",
        );
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Unable to save.");
    }
  }
  return (
    <Context.Provider
      value={{
        s,
        update,
        mutate: (id, fn) =>
          update((s) => {
            const m = s.matches.find((m) => m.id === id);
            if (m) fn(m, s);
          }),
        notice,
        notify,
      }}
    >
      {ready ? children : <div className="loading">Opening the clubhouse…</div>}
    </Context.Provider>
  );
}
export function useClub() {
  const c = useContext(Context);
  if (!c) throw Error("Missing club provider");
  return c;
}
