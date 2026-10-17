// All secrets come from the environment (.env.local locally, GitHub secrets in CI).

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  // SEC requires a descriptive User-Agent with a contact email.
  // https://www.sec.gov/os/accessing-edgar-data
  get secUserAgent(): string {
    return `OnRecord AI filings scanner ${required("SEC_CONTACT_EMAIL")}`;
  },
  // Everyone else gets a UA without the contact email.
  webUserAgent: "OnRecord AI filings scanner (+https://github.com/owenocall/on-record)",
  get supabaseUrl(): string {
    return required("SUPABASE_URL");
  },
  get supabaseServiceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  model: process.env.CLASSIFIER_MODEL ?? "claude-opus-5-5",
};
