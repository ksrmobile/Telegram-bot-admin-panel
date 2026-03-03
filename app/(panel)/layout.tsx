import { Sidebar } from "../../components/sidebar";
import { getSession } from "../../lib/auth";
import { ThemeToggle } from "../../components/theme-toggle";
import { CommandPalette } from "../../components/command-palette";

export default async function PanelLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await getSession(); // ensure server-only import; auth enforced by middleware

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground dark:bg-gradient-to-br dark:from-[#0B0B10] dark:via-[#0F0F16] dark:to-[#190B28]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Ctrl+K</span>
            <ThemeToggle />
          </div>
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}

