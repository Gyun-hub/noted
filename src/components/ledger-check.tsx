export function LedgerCheck({
  checked,
  onChange,
  children,
  tone,
  className = "",
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  /** blue = 반복 할 일 */
  tone?: "blue";
  className?: string;
}) {
  return (
    <label className={`pen-check ${className}`} data-tone={tone}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="box">
        <svg className="tick" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M5 15.5c2 1.6 3.8 3.4 5.4 5.6C14 14 18.6 8.4 25 3.5" />
        </svg>
      </span>
      <span className="label">{children}</span>
    </label>
  );
}
