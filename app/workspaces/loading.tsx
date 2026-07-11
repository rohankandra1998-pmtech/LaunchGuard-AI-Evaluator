export default function WorkspacesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-40 rounded bg-white/10" />
      <div className="mt-4 h-10 w-72 rounded bg-white/10" />
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-64 rounded-lg border border-white/10 bg-white/[0.04]" />)}
      </div>
    </div>
  );
}
