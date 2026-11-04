/** Re-mounts on navigation, so each new page fades in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
