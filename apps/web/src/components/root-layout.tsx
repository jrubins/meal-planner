import { Link, Outlet, type ErrorComponentProps } from '@tanstack/react-router';
import { CalendarDays, CookingPot, Users } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { HouseholdSync } from '@/features/household/household-sync';
import { useSession } from '@/lib/session';
import { UserMenu } from './user-menu';

// Devtools are loaded only in development and never shipped in production bundles.
const Devtools = import.meta.env.DEV ? lazy(() => import('@/components/devtools')) : () => null;

const navLink =
  'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 [&.active]:bg-secondary [&.active]:text-foreground';

export function RootLayout() {
  const { user, signOut } = useSession();
  return (
    <div className="mx-auto min-h-screen max-w-[90rem] px-4 pt-5 pb-12 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/" search={{}} className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Dinner Plan</span>
        </Link>
        <nav
          aria-label="Main"
          className="order-last flex w-full gap-1 text-sm sm:order-none sm:w-auto"
        >
          <Link to="/" search={{}} className={navLink} activeOptions={{ includeSearch: false }}>
            <CalendarDays className="size-4" aria-hidden />
            Week
          </Link>
          <Link to="/meals" className={navLink}>
            <CookingPot className="size-4" aria-hidden />
            Meals
          </Link>
          <Link to="/household" className={navLink}>
            <Users className="size-4" aria-hidden />
            Household
          </Link>
        </nav>
        {user ? <UserMenu user={user} onSignOut={() => void signOut()} /> : null}
      </header>
      <main>
        <Outlet />
      </main>
      <HouseholdSync />
      <Suspense>
        <Devtools />
      </Suspense>
    </div>
  );
}

export function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="space-y-3">
      <p className="font-medium">Something went wrong.</p>
      <p className="text-muted-foreground text-sm">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

export function NotFound() {
  return <p className="text-muted-foreground">Page not found.</p>;
}
