export function Container({
  children,
  size = "read",
  className = "",
}: {
  children: React.ReactNode;
  size?: "read" | "wide";
  className?: string;
}) {
  const width = size === "wide" ? "max-w-6xl" : "max-w-3xl";
  return <div className={`mx-auto w-full ${width} px-4 sm:px-6 ${className}`}>{children}</div>;
}
