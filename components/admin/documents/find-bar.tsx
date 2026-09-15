"use client";

import { useEffect, useRef } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { CaseSensitive, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { searchKey } from "./search-replace";

/** The find & replace strip under the ribbon (Ctrl+F / Ctrl+H). */
export function FindBar({
  editor,
  onClose,
  focusReplace = false,
}: {
  editor: Editor;
  onClose: () => void;
  focusReplace?: boolean;
}) {
  const findRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const st = searchKey.getState(e.state);
      return {
        term: st?.term ?? "",
        replace: st?.replace ?? "",
        caseSensitive: st?.caseSensitive ?? false,
        count: st?.matches.length ?? 0,
        index: st?.index ?? 0,
      };
    },
  });

  useEffect(() => {
    (focusReplace ? replaceRef : findRef).current?.focus();
    findRef.current?.select();
  }, [focusReplace]);

  function close() {
    editor.commands.setSearch({ term: "" });
    onClose();
    editor.commands.focus();
  }

  const empty = s.count === 0;
  return (
    <div
      role="search"
      className="border-border bg-muted/40 flex flex-wrap items-center gap-2 border-b px-3 py-1.5"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
    >
      <Input
        ref={findRef}
        value={s.term}
        onChange={(e) => editor.commands.setSearch({ term: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) editor.commands.prevMatch();
            else editor.commands.nextMatch();
          }
        }}
        placeholder="Find"
        aria-label="Find"
        className="h-7 w-44 text-xs"
      />
      <span
        className={cn(
          "w-16 text-xs tabular-nums",
          empty && s.term ? "text-destructive" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {s.term ? (empty ? "No matches" : `${s.index + 1} of ${s.count}`) : ""}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous match"
            disabled={empty}
            onClick={() => editor.commands.prevMatch()}
          >
            <ChevronUp className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous (Shift+Enter)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next match"
            disabled={empty}
            onClick={() => editor.commands.nextMatch()}
          >
            <ChevronDown className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next (Enter)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={s.caseSensitive ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Match case"
            aria-pressed={s.caseSensitive}
            onClick={() =>
              editor.commands.setSearch({ caseSensitive: !s.caseSensitive })
            }
          >
            <CaseSensitive className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Match case</TooltipContent>
      </Tooltip>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <Input
        ref={replaceRef}
        value={s.replace}
        onChange={(e) => editor.commands.setSearch({ replace: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor.commands.replaceMatch();
          }
        }}
        placeholder="Replace with"
        aria-label="Replace with"
        className="h-7 w-44 text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={empty || !editor.isEditable}
        onClick={() => editor.commands.replaceMatch()}
      >
        Replace
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={empty || !editor.isEditable}
        onClick={() => editor.commands.replaceAllMatches()}
      >
        Replace all
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Close find"
        className="ml-auto"
        onClick={close}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
