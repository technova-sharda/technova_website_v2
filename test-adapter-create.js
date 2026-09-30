import { SupabaseAdapter } from "@auth/supabase-adapter";

const adapter = SupabaseAdapter({
  url: "https://example.com",
  secret: "secret"
});

console.log(adapter.createUser.toString());
