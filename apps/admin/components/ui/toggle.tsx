interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
  accent?: string;
}

export function Toggle({ checked, onChange, size = 'md', accent }: ToggleProps) {
  const activeColor = accent ?? 'bg-emerald-500';
  const isSm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center rounded-full transition-colors focus:outline-none ${
        checked ? activeColor : 'bg-muted'
      } ${isSm ? 'h-5 w-9' : 'h-6 w-11'}`}
    >
      <span className={`inline-block transform rounded-full bg-white shadow transition-transform ${
        isSm
          ? `h-3.5 w-3.5 ${checked ? 'translate-x-5' : 'translate-x-1'}`
          : `h-4 w-4 ${checked ? 'translate-x-6' : 'translate-x-1'}`
      }`} />
    </button>
  );
}
