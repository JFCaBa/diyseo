import { getAIGenerationService } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { GenerateBrandDNARequestSchema } from "@/lib/validations";

function normalizeListText(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeSingleLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function generateBrandDNAForSite(siteId: string, input: unknown) {
  const request = GenerateBrandDNARequestSchema.parse(input);
  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      domain: true,
      brandProfile: {
        select: {
          id: true
        }
      }
    }
  });

  if (!site) {
    throw new Error("Site not found.");
  }

  const generator = getAIGenerationService();
  const generated = await generator.generateBrandDNA({
    site: {
      name: site.name,
      domain: site.domain
    },
    businessDescription: request.businessDescription
  });

  const normalized = {
    businessType: normalizeSingleLine(generated.businessType),
    brandVoiceTone: generated.brandVoiceTone.trim(),
    targetAudience: generated.targetAudience.trim(),
    serviceArea: normalizeSingleLine(generated.serviceArea),
    keyThemes: normalizeListText(generated.keyThemes),
    topicsToAvoid: normalizeListText(generated.topicsToAvoid),
    customImageInstructions: generated.customImageInstructions.trim(),
    imageStyle: normalizeSingleLine(generated.imageStyle)
  };

  if (site.brandProfile) {
    await prisma.brandProfile.update({
      where: { siteProjectId: site.id },
      data: normalized
    });
  } else {
    await prisma.brandProfile.create({
      data: {
        siteProjectId: site.id,
        ...normalized
      }
    });
  }

  return normalized;
}
