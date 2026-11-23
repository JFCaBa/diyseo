/**
 * English UI strings: every value is the exact English the app showed before i18n.
 * One namespace per screen group; `errors` is the closed catalog that `localizeMessage`
 * reverse-looks-up (Zod and static lib/* messages), so its English values must be unique.
 */
export const en = {
  common: {
    greeting: "Hello, {name}"
  },
  nav: {
    blog: "Blog",
    dashboard: "Dashboard",
    brandDna: "Brand DNA",
    calendar: "Calendar",
    articles: "Articles",
    keywords: "Keywords",
    analytics: "Analytics",
    api: "API",
    settings: "Settings",
    account: "Account",
    team: "Team",
    billing: "Billing",
    admin: "Admin"
  },
  localeSwitcher: {
    label: "Language",
    en: "English",
    es: "Español"
  },
  errors: {
    // Zod defaults emitted by lib/validations.ts
    required: "Required",
    invalidInput: "Invalid input",
    invalidCuid: "Invalid cuid",
    invalidDate: "Invalid date",
    invalidDatetime: "Invalid datetime",
    expectedObjectReceivedNull: "Expected object, received null",
    expectedStringReceivedNumber: "Expected string, received number",
    expectedArrayReceivedString: "Expected array, received string",
    expectedArrayReceivedNumber: "Expected array, received number",
    expectedBooleanReceivedString: "Expected boolean, received string",
    expectedBooleanReceivedNumber: "Expected boolean, received number",
    expectedNumberReceivedNan: "Expected number, received nan",
    expectedTranslationLanguageReceivedNumber: "Expected 'en' | 'es' | 'fr' | 'it' | 'pt' | 'ru' | 'tr', received number",
    expectedSocialNetworkReceivedNumber: "Expected 'FACEBOOK' | 'INSTAGRAM' | 'X' | 'LINKEDIN', received number",
    expectedArticleStatusReceivedNumber: "Expected 'DRAFT' | 'PUBLISHED', received number",
    expectedResolveOutcomeReceivedNumber: "Expected 'published' | 'retry', received number",
    expectedSearchCountryReceivedNumber: "Expected 'es' | 'us' | 'uk' | 'fr' | 'de' | 'it' | 'pt', received number",
    expectedSearchLanguageReceivedNumber: "Expected 'es' | 'en' | 'fr' | 'de' | 'it' | 'pt', received number",
    expectedWidgetThemeReceivedNumber: "Expected 'light' | 'dark', received number",
    stringMin1: "String must contain at least 1 character(s)",
    stringMax50: "String must contain at most 50 character(s)",
    stringMax100: "String must contain at most 100 character(s)",
    stringMax200: "String must contain at most 200 character(s)",
    stringMax250: "String must contain at most 250 character(s)",
    stringMax254: "String must contain at most 254 character(s)",
    stringMax500: "String must contain at most 500 character(s)",
    stringMax1000: "String must contain at most 1000 character(s)",
    stringMax1500: "String must contain at most 1500 character(s)",
    stringMax1800: "String must contain at most 1800 character(s)",
    stringMax2000: "String must contain at most 2000 character(s)",
    stringMax3000: "String must contain at most 3000 character(s)",
    numberMin1: "Number must be greater than or equal to 1",
    numberMax100: "Number must be less than or equal to 100",
    // Custom messages in lib/validations.ts
    generatedKeywordsShape: "Generated keywords must be short phrases of 2 to 5 words.",
    siteNameMin: "Name must be at least 2 characters",
    siteDomainUrl: "Must be a valid URL (e.g., https://example.com)",
    contentLanguageRequired: "Content language is required",
    invalidArticleId: "Invalid Article ID",
    invalidSiteId: "Invalid Site ID",
    invalidKeyId: "Invalid key ID",
    keywordTermRequired: "Keyword term is required",
    propertySelectionRequired: "Property selection is required",
    coverImageEmpty: "Cover image must not be empty.",
    coverImageTooLong: "Cover image must be 2000 characters or less.",
    coverImageInvalid: "Cover image must be a valid URL or a site-relative path.",
    articlesPerWeekWhole: "Articles per week must be a whole number.",
    articlesPerWeekMin: "Articles per week must be at least 1.",
    articlesPerWeekMax: "Articles per week must be 50 or less.",
    transferEmailInvalid: "Enter a valid user email.",
    inviteEmailInvalid: "Enter a valid email.",
    apiKeyLabelRequired: "Key label is required.",
    apiKeyLabelTooLong: "Key label must be 80 characters or less.",
    deleteSiteConfirmName: "Type the site name to confirm deletion.",
    titleRequired: "Title is required",
    titleTooLong: "Title must be 200 characters or less.",
    contentRequired: "Content is required",
    seoTitleTooLong: "SEO Title should be under 60 characters",
    seoDescriptionTooLong: "SEO Description should be under 160 characters",
    slugTooLong: "Slug must be 120 characters or less.",
    excerptTooLong: "Excerpt must be 2000 characters or less.",
    contentMarkdownRequired: "contentMarkdown is required",
    contentMarkdownTooLarge: "contentMarkdown is too large.",
    coverImageAndGenerateBoth: "Cannot set both coverImageUrl and generateCoverImage. Provide one or the other.",
    patchBodyEmpty: "Request body must include at least one field to update.",
    instagramHashtags: "instagram needs 3 to 8 hashtags",
    metaPageIdNumeric: "Enter the numeric Page ID.",
    metaAccessTokenShort: "Paste the full access token."
  }
} as const;

type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

/** Shape every locale must fill: same keys as `en`, string leaves. */
export type Messages = DeepStrings<typeof en>;
