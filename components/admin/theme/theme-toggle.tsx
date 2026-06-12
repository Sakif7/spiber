"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminTheme } from "./admin-theme-provider";

/**
 * Light/dark toggle. The icon swap is CSS-driven off the `.dark` class (sun
 * rotates out, moon rotates in), so there's no theme-dependent render to cause
 * a hydration mismatch. The click reads the resolved theme at call time.
 */
export function ThemeToggle() {
  const { theme, setPref } = useAdminTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground relative"
      aria-label="Toggle theme"
      title="Toggle light / dark"
      onClick={() => setPref(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-[1.15rem] scale-100 rotate-0 transition-transform duration-300 ease-out dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-[1.15rem] scale-0 rotate-90 transition-transform duration-300 ease-out dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
