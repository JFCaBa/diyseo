type PageHeaderProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  eyebrow?: string;
};

export function PageHeader({ title, description, action, eyebrow = "Admin" }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="max-w-2xl text-sm text-slate-600">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
