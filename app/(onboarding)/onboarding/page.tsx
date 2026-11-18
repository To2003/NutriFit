import { redirect } from "next/navigation";
import { getMe } from "@/lib/data/me";

export default async function OnboardingIndex() {
  const me = await getMe();
  if (!me) redirect("/login");
  redirect(me.details.onboarding_step > 10 ? "/onboarding/objetivos" : `/onboarding/${me.details.onboarding_step}`);
}
