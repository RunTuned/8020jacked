"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type TabId = "today" | "train" | "food" | "progress";

export const tabs: ReadonlyArray<{ id: TabId; label: string; href: string; icon: IconName }> = [
  { id: "today", label: "Today", href: "/", icon: "today" },
  { id: "train", label: "Train", href: "/train", icon: "train" },
  { id: "food", label: "Food", href: "/food", icon: "food" },
  { id: "progress", label: "Progress", href: "/progress", icon: "progress" },
];

function tabFromPath(path: string | null): TabId | null {
  if (!path) return null;
  if (path === "/") return "today";
  const hit = tabs.find((t) => t.href !== "/" && (path === t.href || path.startsWith(t.href + "/")));
  return hit?.id ?? null;
}

export type TabBarProps = {
  /** Which tab is current. Defaults to the one matching the URL. */
  current?: TabId;
  /** Override hrefs (the /dev gallery points them at its own mocks). */
  hrefs?: Partial<Record<TabId, string>>;
  /** Float over the page (default) or sit in the flow (gallery). */
  position?: "fixed" | "static";
};

/**
 * The floating ink capsule: Today · Train · Food · Progress. Each tab is an icon over a 15px label;
 * the current one sits on a white rounded rectangle with aria-current="page". Its measured height is
 * written to --bar-h so screens keep their last item clear of it. Wraps to two rows at very large text.
 * Hidden while a text field has focus (on-screen keyboard).
 */
export function TabBar({ current, hrefs, position = "fixed" }: TabBarProps) {
  const path = usePathname();
  const active = current ?? tabFromPath(path);
  const ref = useRef<HTMLElement>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (position !== "fixed") return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => {
      root.style.setProperty("--bar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [position]);

  useEffect(() => {
    if (position !== "fixed") return;
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "TEXTAREA" ||
        t.isContentEditable ||
        (t.tagName === "INPUT" &&
          !["button", "checkbox", "radio", "range", "submit", "reset", "file"].includes((t as HTMLInputElement).type)));
    const onIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, [position]);

  return (
    <nav
      ref={ref}
      aria-label="Main"
      hidden={typing || undefined}
      className={cx(
        "on-bar z-40 box-border rounded-[2rem] bg-bar p-2",
        position === "fixed" ? "fixed max-w-[38rem] mx-auto" : "relative w-full",
      )}
      style={
        position === "fixed"
          ? {
              left: "max(16px, env(safe-area-inset-left))",
              right: "max(16px, env(safe-area-inset-right))",
              bottom: "calc(16px + env(safe-area-inset-bottom))",
            }
          : undefined
      }
    >
      <ul className="m-0 flex list-none flex-wrap items-stretch gap-1 p-0">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className="flex min-w-[4.75rem] flex-[1_0_0]">
              <Link
                href={hrefs?.[t.id] ?? t.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "box-border flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[20px] px-0.5 py-1.5 text-label font-semibold leading-[1.2] no-underline",
                  on ? "bg-bar-item-active text-on-bar-item-active" : "text-on-bar",
                )}
              >
                <Icon name={t.icon} size={24} />
                <span className="[overflow-wrap:normal]">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
