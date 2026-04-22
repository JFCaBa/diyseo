type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/80 p-10 text-center shadow-panel">
      <div className="mx-auto max-w-xl space-y-3">
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}
