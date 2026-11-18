import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardingPath } from "@/lib/data/me";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const det = await supabase.from("profile_details").select("onboarded_at, onboarding_step").eq("user_id", data.user.id).maybeSingle();
      const target = det.data?.onboarded_at ? next : onboardingPath(det.data?.onboarding_step ?? 1);
      return NextResponse.redirect(`${origin}${target}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
