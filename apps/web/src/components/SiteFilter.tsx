import { useId } from "react";
import {
  KIND_LABEL,
  NO_FILTER,
  isFiltered,
  resultText,
  type Filter,
  type Kind,
  type KindFilter,
  type TerrainFilter,
} from "../lib/siteFilter";

const field = "min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink";

/** Search box plus kind and terrain filters. All native controls, so keyboard access is free. */
export function SiteFilter({
  value,
  onChange,
  kinds,
  shown,
  total,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  kinds: Kind[];
  shown: number;
  total: number;
}) {
  const id = useId();
  return (
    <div role="search" aria-label="Filter sites" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1 text-sm text-muted">
          <label htmlFor={`${id}-q`}>Search by name or id</label>
          <input
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
            className={field}
          />
        </div>
        {kinds.length > 1 && (
          <div className="flex flex-col gap-1 text-sm text-muted">
            <label htmlFor={`${id}-k`}>Kind</label>
            <select
              id={`${id}-k`}
              value={value.kind}
              onChange={(e) => onChange({ ...value, kind: e.target.value as KindFilter })}
              className={field}
            >
              <option value="any">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1 text-sm text-muted">
          <label htmlFor={`${id}-t`}>Terrain</label>
          <select
            id={`${id}-t`}
            value={value.terrain}
            onChange={(e) => onChange({ ...value, terrain: e.target.value as TerrainFilter })}
            className={field}
          >
            <option value="any">Any terrain state</option>
            <option value="full">Terrain complete</option>
            <option value="partial">Terrain incomplete</option>
            <option value="none">No terrain (flat horizon)</option>
          </select>
        </div>
        <button
          type="button"
          disabled={!isFiltered(value)}
          onClick={() => onChange(NO_FILTER)}
          className="min-h-11 rounded-cell border border-white/20 px-4 text-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear filters
        </button>
      </div>
      <p role="status" className="m-0 text-xs text-muted">
        {resultText(shown, total)}
      </p>
    </div>
  );
}
