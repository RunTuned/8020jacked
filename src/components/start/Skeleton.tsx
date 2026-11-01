/** Bento-shaped placeholder while the store loads: a title and three soft cards. */
export function Skeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto flex min-h-dvh w-full max-w-[40rem] flex-col gap-6 box-border"
      style={{ padding: "var(--page-top) var(--page-right) var(--page-bottom) var(--page-left)" }}
    >
      <div className="h-12 w-12 rounded-full bg-neutral" />
      <div className="h-10 w-2/3 rounded-full bg-neutral" />
      <div className="flex flex-col gap-3">
        <div className="h-40 rounded-card bg-neutral" />
        <div className="h-28 rounded-card bg-neutral" />
        <div className="h-20 rounded-card bg-neutral" />
      </div>
    </main>
  );
}
