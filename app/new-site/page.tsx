import { AppI18n } from "@/components/app-i18n";
import { CreateSiteForm } from "@/components/create-site-form";
import { PageHeader } from "@/components/page-header";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const t = await getT();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <PageHeader
        title={t("onboarding.addWebsiteTitle")}
        description={t("onboarding.addWebsiteDescription")}
      />
      <div className="mt-8">
        <AppI18n>
          <CreateSiteForm backHref="/settings" />
        </AppI18n>
      </div>
    </main>
  );
}
