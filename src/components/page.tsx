/** 페이지 머리: 손글씨 제목 + 한 줄 요약 */
export function PageHeader({ title, sub, children }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="relative mb-8 pr-12">
      <h1 className="page-title">{title}</h1>
      {sub && <p className="mt-2 text-sm text-pencil">{sub}</p>}
      {children}
    </header>
  );
}

export function Section({
  title,
  aside,
  tone,
  className = "mb-10",
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  tone?: "blue" | "navy";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h2 className="section-head" data-tone={tone}>
        <span>{title}</span>
        {aside !== undefined && <span className="aside">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

export function AddIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
