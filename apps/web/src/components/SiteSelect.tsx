import { useId } from "react";
import type { SiteList } from "../lib/data";
import { toSiteInfo } from "../lib/site";

export function SiteSelect({
  sites,
  value,
  onChange,
}: {
  sites: SiteList;
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 text-sm text-muted">
      <label htmlFor={id}>Site</label>
      <select
        id={id}
        className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {sites.sites.map((s) => (
          <option key={s.id} value={s.id}>
            {toSiteInfo(s).name}
          </option>
        ))}
      </select>
    </div>
  );
}
