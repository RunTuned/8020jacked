"use client";

import { useId, useRef, useState } from "react";
import { Banner, Button, Card, Hero, Screen, Sheet, Stack, Switch, TopRow } from "@/components/ui";
import { selectPhotos } from "@/lib/store";
import { BentoSkeleton, useHydrated, useStore } from "./parts";
import { compressPhoto, PhotoImage } from "./photo";

/** P3: progress photos. Off by default; private, on this phone only (IndexedDB). */
export function PhotosScreen() {
  const hydrated = useHydrated();
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [askOff, setAskOff] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pick, setPick] = useState<{ a: string; b: string } | null>(null);
  const aId = useId();
  const bId = useId();

  const back = { href: "/progress?view=photos", label: "Back to Progress" };
  if (!hydrated)
    return (
      <Screen>
        <BentoSkeleton />
      </Screen>
    );

  const p = selectPhotos(s);
  const viewed = p.list.find((x) => x.id === viewing) ?? null;
  const ids = new Set(p.list.map((x) => x.id));
  const cmp = pick && ids.has(pick.a) && ids.has(pick.b) ? pick : p.compareDefault;

  const onSwitch = (on: boolean) => {
    if (on) void s.setPhotosOn(true);
    else if (p.count) setAskOff(true);
    else void s.setPhotosOn(false);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setProblem(null);
    try {
      await s.addPhoto(await compressPhoto(f));
    } catch {
      setProblem("That photo couldn't be saved. Try another one.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const select = (label: string, id: string, value: string, set: (v: string) => void) => (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-label font-semibold">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="min-h-12 w-full rounded-field border-2 border-solid border-ink-muted bg-canvas px-3 text-ink"
      >
        {p.list.map((x) => (
          <option key={x.id} value={x.id}>
            {x.dateText}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Screen>
      <TopRow back={back} />
      <Hero title="Photos" />
      <Stack>
        <Card tone="lime" label="Progress photos">
          <Switch
            label="Progress photos"
            description="Private, on this phone only. Off until you turn it on. Turning it off asks first, then deletes your photos."
            checked={p.on}
            onChange={onSwitch}
            showState
          />
        </Card>

        {p.on ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button block onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? "Saving…" : "Take or choose a photo"}
            </Button>
            <p className="m-0 text-label text-ink-muted">Never saved to the phone gallery.</p>
            {p.nudge ? <p className="m-0 text-body">{p.nudge}</p> : null}
            {problem ? (
              <Banner tone="error" role="alert">
                {problem}
              </Banner>
            ) : null}

            {cmp ? (
              <Card tone="neutral" title="Compare" detail="Pick two dates side by side." label="Compare">
                <div className="grid grid-cols-2 gap-3">
                  {select("First", aId, cmp.a, (a) => setPick({ ...cmp, a }))}
                  {select("Second", bId, cmp.b, (b) => setPick({ ...cmp, b }))}
                  <PhotoImage id={cmp.a} alt="First photo" className="aspect-[3/4] w-full rounded-[20px] object-cover" />
                  <PhotoImage id={cmp.b} alt="Second photo" className="aspect-[3/4] w-full rounded-[20px] object-cover" />
                </div>
              </Card>
            ) : null}

            {p.count ? (
              <Card tone="neutral" title="Your photos" detail="Tap a photo to view or delete it." label="Your photos">
                <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
                  {p.list.map((x) => (
                    <li key={x.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setViewing(x.id);
                          setConfirmDelete(false);
                        }}
                        className="flex w-full flex-col gap-1 border-0 bg-transparent p-0 text-left"
                      >
                        <PhotoImage id={x.id} alt="" className="aspect-[3/4] w-full rounded-2xl object-cover" />
                        <span className="text-label">{x.dateText}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        ) : null}
      </Stack>

      <Sheet open={askOff} onClose={() => setAskOff(false)} title="Turn off photos?">
        <p className="m-0 text-body">This deletes your {p.count === 1 ? "photo" : `${p.count} photos`} from this phone.</p>
        <Button
          block
          onClick={async () => {
            await s.setPhotosOn(false);
            setAskOff(false);
          }}
        >
          Turn off and delete
        </Button>
        <Button variant="text" onClick={() => setAskOff(false)}>
          Keep them
        </Button>
      </Sheet>

      <Sheet open={!!viewed} onClose={() => setViewing(null)} title={viewed ? viewed.dateText : ""}>
        {viewed ? (
          <>
            <PhotoImage id={viewed.id} alt={`Photo from ${viewed.dateText}`} className="max-h-[60dvh] w-full rounded-[20px] object-contain" />
            {confirmDelete ? (
              <>
                <p className="m-0 text-body">Delete this photo? This can&apos;t be undone.</p>
                <Button
                  block
                  onClick={async () => {
                    await s.deletePhoto(viewed.id);
                    setViewing(null);
                  }}
                >
                  Delete
                </Button>
                <Button variant="text" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button variant="text" onClick={() => setConfirmDelete(true)}>
                Delete this photo
              </Button>
            )}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
