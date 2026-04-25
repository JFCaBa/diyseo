import {
  getSearchCountryLabel,
  getSearchLanguageLabel,
  normalizeSearchCountry,
  normalizeSearchLanguage
} from "@/lib/search-locale";

type SerperOrganicResult = {
  link?: string;
  position?: number;
};

type SerperSearchResponse = {
  organic?: SerperOrganicResult[];
};

export type LiveSerpCheckResult = {
  checkedAt: string;
  checkedDomain: string;
  countryCode: string;
  countryLabel: string;
  keyword: string;
  languageCode: string;
  languageLabel: string;
  position: number | null;
  rankingUrl: string | null;
  topDomains: string[];
};

function normalizeHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

function getDomainHost(domain: string) {
  try {
    return normalizeHost(new URL(domain).hostname);
  } catch {
    return normalizeHost(domain.replace(/^https?:\/\//, "").split("/")[0] ?? "");
  }
}

function getResultHost(link: string) {
  try {
    return normalizeHost(new URL(link).hostname);
  } catch {
    return null;
  }
}

function matchesDomain(checkedHost: string, resultHost: string) {
  return resultHost === checkedHost || resultHost.endsWith(`.${checkedHost}`);
}

export async function runLiveSerpCheck(keyword: string, siteDomain: string, country: string, language: string) {
  const apiKey = process.env.SERPER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not configured.");
  }

  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return null;
  }

  const checkedHost = getDomainHost(siteDomain);

  if (!checkedHost) {
    throw new Error("The site domain is not valid for SERP matching.");
  }

  const normalizedCountry = normalizeSearchCountry(country);
  const normalizedLanguage = normalizeSearchLanguage(language);

  const requestBody = {
    q: normalizedKeyword,
    gl: normalizedCountry,
    hl: normalizedLanguage,
    num: 10
  } satisfies Record<string, unknown>;

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    },
    body: JSON.stringify(requestBody),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Serper search failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as SerperSearchResponse;
  const organic = (payload.organic ?? []).slice(0, 10);
  const matchedResult =
    organic.find((result) => {
      const link = result.link;

      if (!link) {
        return false;
      }

      const resultHost = getResultHost(link);
      return resultHost ? matchesDomain(checkedHost, resultHost) : false;
    }) ?? null;

  return {
    keyword: normalizedKeyword,
    checkedDomain: checkedHost,
    countryCode: normalizedCountry,
    countryLabel: getSearchCountryLabel(normalizedCountry),
    languageCode: normalizedLanguage,
    languageLabel: getSearchLanguageLabel(normalizedLanguage),
    position: matchedResult?.position ?? null,
    rankingUrl: matchedResult?.link ?? null,
    topDomains: organic
      .map((result) => {
        if (!result.link) {
          return null;
        }

        return getResultHost(result.link);
      })
      .filter((value): value is string => Boolean(value)),
    checkedAt: new Date().toISOString()
  } satisfies LiveSerpCheckResult;
}
