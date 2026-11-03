"use client";

import { useState, type ReactNode } from "react";
import {
  Banner,
  BigNumber,
  Button,
  Card,
  CardActions,
  ChoicePills,
  Hero,
  Icon,
  iconNames,
  Option,
  OptionGroup,
  ProgressBar,
  Screen,
  Segmented,
  Sheet,
  Stack,
  Stepper,
  Switch,
  TabBar,
  TextField,
  TopRow,
  UndoToast,
  type CardTone,
} from "@/components/ui";
import { formatClock, useCountdown } from "@/lib/device";
import { createWorkoutAudio, shareOrCopy } from "@/lib/device";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`g-${title}`}>
      <h2 id={`g-${title}`} className="m-0 text-title font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const tones: CardTone[] = ["blue", "lime", "aqua", "pink", "butter", "neutral"];
const audio = typeof window === "undefined" ? null : createWorkoutAudio();

export function Gallery() {
  const [goal, setGoal] = useState("strong");
  const [agree, setAgree] = useState(false);
  const [sw, setSw] = useState(false);
  const [sw2, setSw2] = useState(true);
  const [reps, setReps] = useState(8);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [rating, setRating] = useState<"easy" | "right" | "hard" | null>(null);
  const [sheet, setSheet] = useState(false);
  const [toastKey, setToastKey] = useState(1);
  const [toastMsg, setToastMsg] = useState<string | null>("Set 2 saved: 8 reps");
  const [shared, setShared] = useState<string>("");
  const rest = useCountdown(45_000);

  return (
    <>
      <Screen withTabBar>
        <TopRow back={{ href: "/" }} end="Parts list · test only" />
        <Hero title="The parts" subline="Every component, in each state. Dark mode follows the phone." />

        <Section title="Top row">
          <TopRow label="Thursday 29 October" you={{ href: "/dev" }}>
            <Hero title="Training day." />
          </TopRow>
          <TopRow back={{ href: "/dev" }} end="Step 1 of 6 · Saved as you go" />
        </Section>

        <Section title="Cards">
          <Stack>
            {tones.map((t) => (
              <Card
                key={t}
                tone={t}
                icon="calendar"
                eyebrow={`Eyebrow · ${t}`}
                title="Card title that can wrap onto a second line"
                status="Status line"
                href="/dev"
              />
            ))}
            <Card tone="blue" icon="train" title="5 moves" label="Workout">
              <Button block>Start</Button>
              <CardActions>
                <Button variant="text">8-minute version</Button>
                <Button variant="text">Not today</Button>
              </CardActions>
            </Card>
            <Card tone="aqua" icon="train" eyebrow="Next week" title="One more set of each move" detail="Meals stay the same.">
              <Button block>Sounds good</Button>
              <CardActions spread={false}>
                <Button variant="text">Not this week</Button>
              </CardActions>
            </Card>
          </Stack>
        </Section>

        <Section title="Buttons">
          <Button block>Primary</Button>
          <Button block icon="play">
            Primary with icon
          </Button>
          <Button block disabled aria-describedby="why-off">
            Next
          </Button>
          <p id="why-off" className="m-0 -mt-2 text-center text-label text-ink-muted">
            Pick a goal and tick the box to go on.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">Weigh in</Button>
            <Button variant="secondary" icon="bigscreen">
              Big screen mode
            </Button>
            <Button variant="outline" icon="swap">
              Hurts? Swap this move
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="text">Text button</Button>
            <Button variant="text" small>
              Small text button
            </Button>
          </div>
          <Button variant="quiet">Report this</Button>
        </Section>

        <Section title="Options">
          <OptionGroup label="Your goal">
            {[
              ["strong", "Get stronger"],
              ["lose", "Lose some weight"],
              ["steady", "Keep steady"],
            ].map(([v, l]) => (
              <Option key={v} checked={goal === v} onChange={() => setGoal(v)}>
                {l}
              </Option>
            ))}
          </OptionGroup>
          <Option kind="checkbox" checked={agree} onChange={setAgree}>
            I agree to the terms and privacy note
          </Option>
          <Option kind="checkbox" checked onChange={() => {}} hint="Selected, with a hint line">
            Nuts (tree)
          </Option>
          <Option checked={false} onChange={() => {}} disabled>
            Disabled option
          </Option>
          <ChoicePills
            label="That set was"
            value={rating}
            onChange={setRating}
            options={[
              { value: "easy", label: "Too easy" },
              { value: "right", label: "Just right" },
              { value: "hard", label: "Too hard" },
            ]}
          />
          <Segmented
            label="Weight in"
            outlined
            value={unit}
            onChange={setUnit}
            options={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ]}
          />
        </Section>

        <Section title="Switches">
          <Card tone="blue">
            <Switch
              label="Big screen mode"
              description="Big text you can see from across the room"
              checked={sw}
              onChange={setSw}
              showState
            />
          </Card>
          <Switch variant="boxed" label="I'd rather not weigh myself" checked={sw2} onChange={setSw2} />
        </Section>

        <Section title="Stepper">
          <Card tone="blue" icon="train" title="Set 2 of 3" detail="Reps each leg · Last time 8" label="This set">
            <Stepper value={reps} onChange={setReps} min={0} max={50} unit="reps" />
            <Button block>Done set</Button>
          </Card>
        </Section>

        <Section title="Fields">
          <TextField label="Age" inputMode="numeric" defaultValue="44" />
          <TextField label="Height" inputMode="numeric" defaultValue="165" unit="cm" hint="Not sure? We use an average." />
          <TextField label="Weight" inputMode="decimal" defaultValue="" unit={unit} error="Type a number, like 72." />
        </Section>

        <Section title="Banners">
          <Banner role="note">Stop if you get chest pain, feel dizzy, or a joint hurts sharply.</Banner>
          <Banner icon="heart" action={<Button variant="secondary">See why</Button>}>
            Meals are a little bigger this week.
          </Banner>
          <Banner tone="error" role="alert" action={<Button variant="secondary">Try again</Button>}>
            That didn&apos;t save. Your last set is still on the phone.
          </Banner>
        </Section>

        <Section title="Progress bar">
          <ProgressBar value={7} max={15} label="Workout progress" valueText="7 of 15 sets done" />
          <ProgressBar value={1} max={6} label="Step 1 of 6" />
        </Section>

        <Section title="Undo">
          {toastMsg ? (
            <UndoToast
              id={toastKey}
              message={toastMsg}
              onUndo={() => setToastMsg("Undone.")}
              onExpire={() => setToastMsg(null)}
            />
          ) : (
            <p className="m-0 text-ink-muted">The undo has gone.</p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setToastMsg("Meal 2 logged");
              setToastKey((k) => k + 1);
            }}
          >
            Show undo again
          </Button>
        </Section>

        <Section title="Big numbers">
          <Card tone="blue" className="items-center text-center">
            <h3 className="m-0 text-[2.75rem] font-extrabold leading-[1.05] tracking-[-0.02em]">Split squat</h3>
            <BigNumber value="8" unit="reps each leg" label="8 reps each leg" />
            <div className="text-title font-semibold">Set 2 of 3</div>
          </Card>
          <Card tone="neutral" eyebrow="Rest" label="Rest">
            <BigNumber
              timer
              size="timer"
              align="start"
              value={rest.clock}
              label={`${formatClock(rest.remainingMs)} of rest left`}
            />
            <CardActions spread={false}>
              <Button
                variant="text"
                onClick={() => {
                  void audio?.unlock();
                  if (rest.status === "running") rest.pause();
                  else if (rest.status === "paused") rest.resume();
                  else {
                    rest.reset(45_000);
                    rest.start(45_000);
                  }
                }}
              >
                {rest.status === "running" ? "Pause" : rest.status === "paused" ? "Carry on" : "Start rest"}
              </Button>
              <Button variant="text" onClick={() => rest.add(15_000)}>
                +15 sec
              </Button>
              <Button variant="text" onClick={() => audio?.beep()}>
                Beep
              </Button>
              <Button variant="text" onClick={() => audio?.speak("Rest over. Next set.")}>
                Speak
              </Button>
            </CardActions>
          </Card>
        </Section>

        <Section title="Sheet and share">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open a sheet
          </Button>
          <Button
            variant="secondary"
            icon="share"
            onClick={async () => {
              const r = await shareOrCopy({ title: "Shopping list", text: "Eggs\nOats\nSpinach" });
              setShared(r === "copied" ? "Copied" : r === "shared" ? "Shared" : r === "failed" ? "Couldn't copy" : "");
            }}
          >
            Share the list
          </Button>
          <p role="status" className="m-0 text-label text-ink-muted">
            {shared}
          </p>
        </Section>

        <Section title="Icons">
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3 p-0">
            {iconNames.map((n) => (
              <li key={n} className="flex flex-col items-center gap-1 rounded-[20px] bg-neutral p-3">
                <Icon name={n} />
                <span className="text-label">{n}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tab bar">
          <TabBar position="static" current="progress" hrefs={{ today: "/dev/today", train: "/dev", food: "/dev", progress: "/dev" }} />
          <Button variant="text" href="/dev/today">
            See the Today mock
          </Button>
        </Section>
      </Screen>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Swap this meal">
        <p className="m-0 text-ink-muted">Same meal type, your favourites first.</p>
        <OptionGroup label="Meals">
          <Option checked onChange={() => {}}>
            Butter-chicken-style bowl
          </Option>
          <Option checked={false} onChange={() => {}}>
            Tuna pasta bake
          </Option>
        </OptionGroup>
        <Button block onClick={() => setSheet(false)}>
          Swap
        </Button>
      </Sheet>

      <TabBar current="today" hrefs={{ today: "/dev/today", train: "/dev", food: "/dev", progress: "/dev" }} />
    </>
  );
}
