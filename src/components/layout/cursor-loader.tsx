"use client";

import dynamic from "next/dynamic";
import { useFinePointer, useMediaQuery } from "@/hooks/use-media-query";

// Touch devices never download the follower (or the Motion springs behind it).
const Cursor = dynamic(() => import("./cursor").then((mod) => mod.Cursor), { ssr: false });

/**
 * Keep the native pointer where the follower would hurt: forced colours (Windows High Contrast)
 * paint its white dot black on black, and "increase contrast" users get their OS-sized pointer.
 */
const NATIVE_POINTER_QUERY = "(forced-colors: active), (prefers-contrast: more)";

export function CursorLoader() {
  const fine = useFinePointer();
  const nativePointer = useMediaQuery(NATIVE_POINTER_QUERY);
  return fine && !nativePointer ? <Cursor /> : null;
}
