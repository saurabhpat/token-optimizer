export default function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-4 shadow-soft transition-transform duration-300 hover:-translate-y-0.5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

