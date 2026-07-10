export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return { url, key };
}

export function getOpenAIEnv() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local or your Vercel environment variables to use AI features."
    );
  }

  return {
    apiKey,
    productModel: process.env.OPENAI_PRODUCT_MODEL || "gpt-4.1",
    reasoningModel: process.env.OPENAI_REASONING_MODEL || "gpt-5"
  };
}
