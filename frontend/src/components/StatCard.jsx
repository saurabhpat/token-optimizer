export default function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-3 shadow-soft transition-transform duration-300 hover:-translate-y-0.5">
      <p className="min-h-8 text-xs font-medium leading-4 text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-semibold text-ink">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
