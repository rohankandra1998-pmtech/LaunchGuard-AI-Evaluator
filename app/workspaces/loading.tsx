export default function WorkspacesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-40 animate-pulse rounded bg-guard-surfaceStrong" />
      <div className="mt-4 h-10 w-72 animate-pulse rounded bg-guard-surfaceStrong" />
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl border border-guard-line bg-white shadow-card" />)}
      </div>
    </div>
  );
}
