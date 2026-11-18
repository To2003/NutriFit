"use client";
import { ErrorView } from "@/components/app/error-view";

export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
