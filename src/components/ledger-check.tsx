export function LedgerCheck({
  checked,
  onChange,
  children,
  className = "",
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`ledger-check ${className}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="box">
        <svg className="tick" viewBox="0 0 16 16">
          <path d="M3 8.5L6.5 12L13 4.5" />
        </svg>
      </span>
      <span className="label">{children}</span>
    </label>
  );
}
