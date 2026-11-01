import { Button, Card } from "@/components/ui";

/** T8: once the plan has ended (S8d), this one card replaces Today's cards (and Train's and Food's). */
export function LockedCard() {
  return (
    <Card tone="neutral" icon="flag" title="Your plan has ended. Your progress is kept." label="Plan ended">
      <Button href="/you/subscription" block>
        Pay
      </Button>
      <Button href="/you" variant="secondary" block>
        You
      </Button>
    </Card>
  );
}
