/** 불러오는 중 자리. 목록 줄 모양 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="mt-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-12 items-center gap-3 border-b py-3">
          <div className="skeleton h-5 w-5 rounded-md" />
          <div className="skeleton h-3.5" style={{ width: `${45 + ((i * 23) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}
