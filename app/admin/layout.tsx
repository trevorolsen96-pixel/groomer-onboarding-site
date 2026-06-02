export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bypass the root layout (no site header/footer)
  return <>{children}</>;
}
