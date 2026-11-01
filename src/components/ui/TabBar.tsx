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
 * written to --bar-h so screens keep their last item clear of it. Always one row: when the labels no
 * longer fit (large text, e.g. 200%), they are hidden visually and kept as each tab's aria-label.
 * Hidden while a text field has focus (on-screen keyboard).
 */
export function TabBar({ current, hrefs, position = "fixed" }: TabBarProps) {
  const path = usePathname();
  const active = current ?? tabFromPath(path);
  const ref = useRef<HTMLElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [typing, setTyping] = useState(false);
  const [compact, setCompact] = useState(false);

  // Labels need about 4.75rem a tab. The probe is that wide, so it resizes when the text size changes.
  useEffect(() => {
    const el = ref.current;
    const p = probe.current;
    if (!el || !p || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const ul = el.querySelector("ul");
      const gap = ul ? parseFloat(getComputedStyle(ul).columnGap) || 0 : 0;
      const room = (ul?.clientWidth ?? el.clientWidth) - gap * (tabs.length - 1);
      setCompact(p.getBoundingClientRect().width * tabs.length > room + 0.5);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    ro.observe(p);
    fit();
    return () => ro.disconnect();
  }, []);

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
      <span
        ref={probe}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 h-0 w-[4.75rem] overflow-hidden"
      />
      <ul className="m-0 flex list-none flex-nowrap items-stretch gap-1 p-0">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className={cx("flex flex-[1_0_0]", compact ? "min-w-0" : "min-w-[4.75rem]")}>
              <Link
                href={hrefs?.[t.id] ?? t.href}
                aria-label={compact ? t.label : undefined}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "box-border flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[20px] px-0.5 py-1.5 text-label font-semibold leading-[1.2] no-underline",
                  on ? "bg-bar-item-active text-on-bar-item-active" : "text-on-bar",
                )}
              >
                <Icon name={t.icon} size={24} />
                <span className={compact ? "sr-only" : "[overflow-wrap:normal]"}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
