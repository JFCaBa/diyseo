import { CreateSiteForm } from "@/components/create-site-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function NewSitePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <PageHeader
        title="Add Website"
        description="Create a new website, set its domain and primary content language, then continue directly into its dashboard."
      />
      <div className="mt-8">
        <CreateSiteForm backHref="/settings" />
      </div>
    </main>
  );
}
