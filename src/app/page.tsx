import { Button, Hero, Screen } from "@/components/ui";

/** Placeholder until the Today screen is built from the engine and store. */
export default function Home() {
  return (
    <Screen>
      <Hero title="8020jacked" subline="Test version. The app is being built." />
      <Button href="/dev" variant="secondary">
        See the parts
      </Button>
    </Screen>
  );
}
