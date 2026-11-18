export const MATCH_TABS = [
  "Overview",
  "Lineup",
  "Stats",
  "Ratings",
  "Events",
] as const;
export type MatchTab = (typeof MATCH_TABS)[number];
export function MatchTabs({
  tab,
  onChange,
}: {
  tab: MatchTab;
  onChange: (tab: MatchTab) => void;
}) {
  return (
    <div className="mc-tabs" role="tablist" aria-label="Match sections">
      {MATCH_TABS.map((name, i) => (
        <button
          key={name}
          role="tab"
          id={`tab-${name}`}
          aria-controls={`panel-${name}`}
          aria-selected={tab === name}
          tabIndex={tab === name ? 0 : -1}
          onClick={() => onChange(name)}
          onKeyDown={(e) => {
            let index = i;
            if (e.key === "ArrowRight") index = (i + 1) % 5;
            else if (e.key === "ArrowLeft") index = (i + 4) % 5;
            else if (e.key === "Home") index = 0;
            else if (e.key === "End") index = 4;
            else return;
            e.preventDefault();
            onChange(MATCH_TABS[index]);
            (
              e.currentTarget.parentElement?.children[
                index
              ] as HTMLButtonElement
            ).focus();
          }}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
