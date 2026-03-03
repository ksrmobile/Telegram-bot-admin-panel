import { Suspense } from "react";
import { LoginPageClient } from "./LoginPageClient";

// Let Next.js statically render the shell, but wrap the client
// component (which uses useSearchParams) in Suspense so the build
// does not error with the CSR bailout warning.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageClient />
    </Suspense>
  );
}

