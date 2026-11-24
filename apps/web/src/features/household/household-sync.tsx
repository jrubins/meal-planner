import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';
import { householdQueryOptions, useUpdateHousehold, useUpdateMe } from './queries';

/**
 * Fills in what the browser knows and the household doesn't yet: its time zone (so chat
 * assistants know what "tonight" means) and the member's name from their sign-in.
 * Only replaces defaults, never a value someone chose. Renders nothing.
 */
export function HouseholdSync() {
  const { user, signInMode } = useSession();
  const { data: household } = useQuery(householdQueryOptions);
  const { mutate: updateHousehold } = useUpdateHousehold();
  const { mutate: updateMe } = useUpdateMe();

  const timeZone = household?.timeZone;
  useEffect(() => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone === 'UTC' && browserZone && browserZone !== 'UTC') {
      updateHousehold({ timeZone: browserZone });
    }
  }, [timeZone, updateHousehold]);

  const myName = household?.members.find((m) => m.userId === household.me)?.displayName;
  const signInName = signInMode === 'workos' ? user?.name?.split(' ')[0] : undefined;
  useEffect(() => {
    if (household && myName === null && signInName) updateMe({ displayName: signInName });
  }, [household, myName, signInName, updateMe]);

  return null;
}
