import { AuthForm } from "@/components/auth-form";
import { Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-guard-bg px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-300">Log in to continue your human evaluation workflow.</p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
      </Card>
    </main>
  );
}
