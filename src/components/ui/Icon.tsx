import type { ReactNode, SVGProps } from "react";

/** Outline icons, 24-unit grid, 2px rounded stroke, drawn for 8020jacked. */
const paths = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  train: <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />,
  food: (
    <>
      <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M2 10h20M9 6c0-1 1-2 1-3M14 6c0-1 1-2 1-3" />
    </>
  ),
  progress: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="m8 15 3-4 3 2 5-6" />
    </>
  ),
  you: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
    </>
  ),
  back: <path d="m15 5-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pause: <path d="M9 6v12M15 6v12" />,
  play: <path d="M8 5.5v13a.5.5 0 0 0 .77.42l10-6.5a.5.5 0 0 0 0-.84l-10-6.5A.5.5 0 0 0 8 5.5z" />,
  swap: <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />,
  hurts: (
    <>
      <path d="M10.3 4.1 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  scale: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.5-1.5" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
  ),
  share: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  bigscreen: <path d="M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6" />,
  smallscreen: <path d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5" />,
  sound: (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;
export const iconNames = Object.keys(paths) as IconName[];

export type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
  /** Give a label only when the icon stands alone and means something; otherwise it is hidden from screen readers. */
  label?: string;
};

export function Icon({ name, size = 24, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
