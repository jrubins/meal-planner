import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/lib/session';

interface UserMenuProps {
  user: SessionUser;
  onSignOut: () => void;
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden max-w-40 truncate sm:inline">
        {user.name ?? user.email ?? user.id}
      </span>
      <Button variant="ghost" size="sm" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}
