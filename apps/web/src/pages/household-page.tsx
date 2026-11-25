import { JoinHouseholdSchema, UpdateHouseholdSchema, UpdateMemberSchema } from '@app/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  householdQueryOptions,
  useJoinHousehold,
  useNewInviteCode,
  useUpdateHousehold,
  useUpdateMe,
} from '@/features/household/queries';
import { ApiRequestError } from '@/lib/api';
import { memberName } from '@/lib/format';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card space-y-3 rounded-xl border p-4 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A one-field form: a label, an input and a save button, validated by a shared schema. */
function InlineForm({
  id,
  label,
  initial,
  onSave,
  validate,
  placeholder,
  submitLabel = 'Save',
}: {
  id: string;
  label: string;
  initial: string;
  onSave: (value: string) => Promise<unknown>;
  validate: (value: string) => string | null;
  placeholder?: string;
  submitLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(value);
    setError(problem);
    setSaved(false);
    if (problem) return;
    try {
      await onSave(value);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Something went wrong');
    }
  }

  return (
    <form className="space-y-1.5" noValidate onSubmit={(event) => void submit(event)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant="secondary">
          {saved ? <Check aria-hidden /> : null}
          {saved ? 'Saved' : submitLabel}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : (result.error?.issues[0]?.message ?? 'Invalid value');

export function HouseholdPage() {
  const { data: household } = useSuspenseQuery(householdQueryOptions);
  const updateHousehold = useUpdateHousehold();
  const updateMe = useUpdateMe();
  const join = useJoinHousehold();
  const newCode = useNewInviteCode();
  const [copied, setCopied] = useState(false);
  const me = household.members.find((m) => m.userId === household.me);
  const alone = household.members.length === 1;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">{household.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {household.members.map((m) => memberName(m, household.me)).join(' & ')} · Times in{' '}
          {household.timeZone.replaceAll('_', ' ')}
        </p>
      </div>

      <Section
        title="Invite your partner"
        description="Share this code. When they enter it under “Join a household”, you’ll plan the same week."
      >
        <div className="flex items-center gap-2">
          <code
            className="bg-secondary rounded-lg px-4 py-2 font-mono text-xl tracking-[0.25em]"
            aria-label="Your invite code"
          >
            {household.inviteCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy invite code"
            onClick={() => {
              void navigator.clipboard.writeText(household.inviteCode).then(() => setCopied(true));
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={newCode.isPending}
            onClick={() => {
              setCopied(false);
              newCode.mutate(undefined);
            }}
          >
            <RefreshCw />
            New code
          </Button>
        </div>
      </Section>

      <Section title="You">
        <InlineForm
          id="display-name"
          label="Your name, as the household sees it"
          initial={me?.displayName ?? ''}
          placeholder="e.g. Alex"
          validate={(value) => firstError(UpdateMemberSchema.safeParse({ displayName: value }))}
          onSave={(displayName) => updateMe.mutateAsync({ displayName })}
        />
      </Section>

      <Section title="Household">
        <InlineForm
          id="household-name"
          label="Name"
          initial={household.name}
          validate={(value) => firstError(UpdateHouseholdSchema.safeParse({ name: value }))}
          onSave={(name) => updateHousehold.mutateAsync({ name })}
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium" id="week-start-label">
            Weeks start on
          </p>
          <div className="flex gap-2" role="group" aria-labelledby="week-start-label">
            {([1, 0] as const).map((day) => (
              <Button
                key={day}
                variant={household.weekStartsOn === day ? 'default' : 'outline'}
                size="sm"
                aria-pressed={household.weekStartsOn === day}
                onClick={() => updateHousehold.mutate({ weekStartsOn: day })}
              >
                {day === 1 ? 'Monday' : 'Sunday'}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Join a household"
        description={
          alone
            ? 'Got a code from your partner? Enter it to join their household. Your meals come with you.'
            : 'Entering another code moves you to that household.'
        }
      >
        <InlineForm
          id="invite-code"
          label="Their invite code"
          initial=""
          placeholder="ABCD2345"
          submitLabel="Join"
          validate={(value) => firstError(JoinHouseholdSchema.safeParse({ inviteCode: value }))}
          onSave={(inviteCode) => join.mutateAsync({ inviteCode })}
        />
      </Section>
    </div>
  );
}
