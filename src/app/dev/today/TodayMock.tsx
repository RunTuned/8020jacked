"use client";

import { useState } from "react";
import { Button, Card, CardActions, Hero, Screen, Stack, Subline, Switch, TabBar, TopRow } from "@/components/ui";

const devTabs = { today: "/dev/today", train: "/dev", food: "/dev", progress: "/dev" } as const;

/** Copy and numbers here are fixed mock text from the Main board, not engine output. */
export function TodayMock() {
  const [big, setBig] = useState(false);
  return (
    <>
      <Screen withTabBar>
        <div className="flex flex-col gap-1.5">
          <TopRow label="Thursday 29 October" you={{ href: "/dev" }}>
            <Hero title="Training day." />
          </TopRow>
          <Subline>Full body A · about 15 minutes</Subline>
        </div>
        <Stack>
          <Card tone="blue" icon="train" title="5 moves" label="Workout">
            <Button href="/dev" block>
              Start
            </Button>
            <CardActions>
              <Button variant="text" href="/dev">
                8-minute version
              </Button>
              <Button variant="text" href="/dev">
                Not today
              </Button>
            </CardActions>
            <Switch
              label="Big screen mode"
              description="Big text you can see from across the room"
              checked={big}
              onChange={setBig}
              showState
            />
          </Card>
          <Card
            tone="lime"
            icon="food"
            label="Next meal"
            eyebrow="Next meal · Meal 2"
            title="Butter-chicken-style bowl"
            detail="From the fridge, 2 minutes to heat"
            headingExtra={
              <Button variant="text" small className="-my-[13px] -ml-1 self-start">
                Meal 3 instead
              </Button>
            }
          >
            <Button block>Ate the plan</Button>
            <CardActions>
              <Button variant="text">Something like it</Button>
              <Button variant="text" href="/dev">
                Something else
              </Button>
            </CardActions>
          </Card>
          <Card tone="pink" icon="calendar" eyebrow="This week" title="2 of 3 workouts · 3 walks to go" href="/dev" />
        </Stack>
      </Screen>
      <TabBar current="today" hrefs={devTabs} />
    </>
  );
}
