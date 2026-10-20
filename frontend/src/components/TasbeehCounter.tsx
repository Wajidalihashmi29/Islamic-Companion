import { useState } from "react";
import type { CSSProperties } from "react";
import { Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import TasbeehIcon from "./icons/TasbeehIcon";

interface ZikrPreset {
  id: string;
  label: string;
  text: string;
  target: number;
  custom?: boolean;
}

interface SavedTasbeeh {
  preset?: string;
  count?: number;
  rounds?: number;
  target?: number;
  totalCount?: number;
  customPresets?: ZikrPreset[];
}

const PRESETS: ZikrPreset[] = [
  { id: "subhanallah", label: "SubhanAllah", text: "سُبْحَانَ اللّٰهِ", target: 33 },
  { id: "alhamdulillah", label: "Alhamdulillah", text: "اَلْحَمْدُ لِلّٰهِ", target: 33 },
  { id: "allahu-akbar", label: "Allahu Akbar", text: "اَللّٰهُ أَكْبَرُ", target: 34 },
  { id: "salawat", label: "Salawat", text: "اَللّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ", target: 100 },
];

export default function TasbeehCounter({ storageKey }: { storageKey: string }) {
  const stateKey = `${storageKey}.tasbeeh`;
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(stateKey) || "{}") as SavedTasbeeh; }
    catch { return {}; }
  })();
  const initialCustom = Array.isArray(saved.customPresets)
    ? saved.customPresets
      .filter(item => item?.id && item.label && item.text && item.target > 0)
      .map(item => ({ ...item, target: Math.min(1000, item.target) }))
    : [];
  const [customPresets, setCustomPresets] = useState<ZikrPreset[]>(initialCustom);
  const initialPresets = [...PRESETS, ...initialCustom];
  const initialPreset = initialPresets.find(item => item.id === saved.preset) ?? PRESETS[0];
  const initialTarget = Math.min(1000, Math.max(1, saved.target ?? initialPreset.target));
  const initialCount = Math.min(Math.max(0, saved.count ?? 0), initialTarget - 1);
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [count, setCount] = useState(initialCount);
  const [rounds, setRounds] = useState(saved.rounds ?? 0);
  const [totalCount, setTotalCount] = useState(saved.totalCount ?? (saved.rounds ?? 0) * initialTarget + initialCount);
  const [target, setTarget] = useState(initialTarget);
  const [targetInput, setTargetInput] = useState(String(initialTarget));
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customText, setCustomText] = useState("");
  const [customTarget, setCustomTarget] = useState(33);
  const allPresets = [...PRESETS, ...customPresets];
  const preset = allPresets.find(item => item.id === presetId) ?? PRESETS[0];

  const persist = (
    nextCount: number,
    nextRounds = rounds,
    nextTarget = target,
    nextPreset = presetId,
    nextCustom = customPresets,
    nextTotal = totalCount,
  ) => {
    localStorage.setItem(stateKey, JSON.stringify({
      preset: nextPreset,
      count: nextCount,
      rounds: nextRounds,
      target: nextTarget,
      totalCount: nextTotal,
      customPresets: nextCustom,
    }));
  };

  const increment = () => {
    const completed = count + 1 >= target;
    const nextCount = completed ? 0 : count + 1;
    const nextRounds = completed ? rounds + 1 : rounds;
    const nextTotal = totalCount + 1;
    setCount(nextCount);
    setRounds(nextRounds);
    setTotalCount(nextTotal);
    persist(nextCount, nextRounds, target, presetId, customPresets, nextTotal);
    navigator.vibrate?.(completed ? [45, 45, 80] : 25);
  };

  const selectPreset = (id: string) => {
    const next = allPresets.find(item => item.id === id) ?? PRESETS[0];
    setPresetId(next.id);
    setTarget(next.target);
    setTargetInput(String(next.target));
    setCount(0);
    persist(0, rounds, next.target, next.id);
  };

  const addCustomPreset = (event: React.FormEvent) => {
    event.preventDefault();
    const label = customLabel.trim();
    const text = customText.trim();
    if (!label || !text) return;
    const nextPreset: ZikrPreset = {
      id: `custom-${Date.now()}`,
      label,
      text,
      target: Math.min(1000, Math.max(1, customTarget)),
      custom: true,
    };
    const nextCustom = [...customPresets, nextPreset];
    setCustomPresets(nextCustom);
    setPresetId(nextPreset.id);
    setTarget(nextPreset.target);
    setTargetInput(String(nextPreset.target));
    setCount(0);
    setCustomLabel("");
    setCustomText("");
    setCustomTarget(33);
    setShowCustomForm(false);
    persist(0, rounds, nextPreset.target, nextPreset.id, nextCustom);
  };

  const removeCustomPreset = (id: string) => {
    const nextCustom = customPresets.filter(item => item.id !== id);
    setCustomPresets(nextCustom);
    if (presetId === id) {
      setPresetId(PRESETS[0].id);
      setTarget(PRESETS[0].target);
      setTargetInput(String(PRESETS[0].target));
      setCount(0);
      persist(0, rounds, PRESETS[0].target, PRESETS[0].id, nextCustom);
    } else {
      persist(count, rounds, target, presetId, nextCustom);
    }
  };
  const applyTarget = (value: string) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.min(1000, Math.max(1, Math.round(parsed))) : target;
    setTarget(next);
    setTargetInput(String(next));
    setCount(current => {
      const nextCount = Math.min(current, next - 1);
      persist(nextCount, rounds, next);
      return nextCount;
    });
  };
  const undo = () => {
    if (totalCount <= 0) return;
    const previousRound = count === 0 && rounds > 0;
    const nextCount = previousRound ? target - 1 : Math.max(0, count - 1);
    const nextRounds = previousRound ? rounds - 1 : rounds;
    const nextTotal = totalCount - 1;
    setCount(nextCount);
    setRounds(nextRounds);
    setTotalCount(nextTotal);
    persist(nextCount, nextRounds, target, presetId, customPresets, nextTotal);
  };
  const beadCount = Math.min(target, 100);
  const completedBeads = Math.floor(count / target * beadCount);
  const beadSize = beadCount > 66 ? 7 : beadCount > 40 ? 9 : 14;

  return <section className="faith-panel tasbeeh-experience">
    <div className="faith-intro"><span className="faith-icon"><TasbeehIcon /></span>
      <div><h2>Digital Tasbeeh</h2></div>
    </div>
    <div className="tasbeeh-studio">
      <aside className="tasbeeh-zikr-panel">
        <span>Dhikr</span>
        <div>{allPresets.map(item => <div className="tasbeeh-zikr-option" key={item.id}>
          <button type="button" className={item.id === presetId ? "is-active" : ""} onClick={() => selectPreset(item.id)}>
            <strong>{item.label}</strong><small>{item.target}</small>
          </button>
          {item.custom && <button type="button" className="tasbeeh-zikr-delete" aria-label={`Delete ${item.label}`}
            onClick={() => removeCustomPreset(item.id)}><Trash2 size={14} /></button>}
        </div>)}</div>
        <button type="button" className="tasbeeh-add-custom" onClick={() => setShowCustomForm(value => !value)}>
          <Plus size={16} /> {showCustomForm ? "Cancel custom Zikr" : "Add custom Zikr"}
        </button>
        {showCustomForm && <form className="tasbeeh-custom-form" onSubmit={addCustomPreset}>
          <label><span>Zikr name</span><input value={customLabel} onChange={event => setCustomLabel(event.target.value)}
            placeholder="e.g. Istighfar" maxLength={50} required /></label>
          <label><span>Text to recite</span><input value={customText} onChange={event => setCustomText(event.target.value)}
            placeholder="e.g. Astaghfirullah" maxLength={160} required /></label>
          <label><span>Target</span><input type="number" min="1" max="1000" value={customTarget}
            onChange={event => setCustomTarget(Number(event.target.value))} required /></label>
          <button type="submit">Save Zikr</button>
        </form>}
      </aside>
      <div className="tasbeeh-ring-panel">
        <strong className="tasbeeh-arabic" data-no-translate data-preserve-font lang="ar" dir="rtl">{preset.text}</strong>
        <small>{preset.label}</small>
        <button type="button" className="tasbeeh-ring" onClick={increment} aria-label="Count one remembrance">
          {Array.from({ length: beadCount }, (_, index) => {
            const angle = index / beadCount * Math.PI * 2 - Math.PI / 2;
            return <i className={`${index < completedBeads ? "is-complete " : ""}${index === completedBeads ? "is-current" : ""}`}
              key={index} style={{
                "--bead-x": `${50 + Math.cos(angle) * 46}%`,
                "--bead-y": `${50 + Math.sin(angle) * 46}%`,
                "--bead-size": `${beadSize}px`,
              } as CSSProperties} />;
          })}
          <span><strong>{count}</strong><small>of {target}</small></span>
        </button>
        <div className="tasbeeh-ring-actions">
          <button type="button" onClick={undo} disabled={totalCount === 0}><Undo2 size={17} /> Undo</button>
          <button type="button" onClick={() => {
            setCount(0); setRounds(0); setTotalCount(0); persist(0, 0, target, presetId, customPresets, 0);
          }}><RotateCcw size={17} /> Reset counter</button>
        </div>
      </div>
      <aside className="tasbeeh-stats-panel">
        <div><span>Rounds completed</span><strong>{rounds}</strong></div>
        <div><span>Total count</span><strong>{totalCount}</strong></div>
        <section><span>Target</span><div>
          {[33, 99, 100].map(value => <button type="button" className={target === value ? "is-active" : ""}
            key={value} onClick={() => applyTarget(String(value))}>{value}</button>)}
        </div><input aria-label="Custom target" type="number" min="1" max="1000" inputMode="numeric" value={targetInput}
          onChange={event => setTargetInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={() => applyTarget(targetInput)}
          onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></section>
      </aside>
    </div>
  </section>;
}
