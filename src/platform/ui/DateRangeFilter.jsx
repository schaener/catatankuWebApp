import { datePresets } from '../date.js';

export default function DateRangeFilter({ value, onChange }) {
  const presets = datePresets();
  return (
    <div className="date-range">
      <div className="date-inputs">
        <label>
          Dari
          <input
            type="date"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
        </label>
        <label>
          Sampai
          <input
            type="date"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </label>
      </div>
      <div className="chips">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`chip ${p.from === value.from && p.to === value.to ? 'chip-active' : ''}`}
            onClick={() => onChange({ from: p.from, to: p.to })}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
