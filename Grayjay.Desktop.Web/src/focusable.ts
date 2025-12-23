import { Accessor, onCleanup, onMount, createEffect } from "solid-js";
import { useFocus } from "./FocusProvider";
import type { FocusableOptions } from "./nav";

type RegResult = "registered" | "no-options" | "no-scope";

export function focusable(el: HTMLElement, accessor: Accessor<FocusableOptions | undefined>) {
  const focus = useFocus();
  if (!focus) {
    console.warn("Focusable not inside FocusProvider", el);
    return;
  }

  let nodeId: string | null = null;
  let sid: string | null = null;
  let disposed = false;

  const unregister = () => {
    if (!nodeId) return;
    focus.unregisterNode(nodeId);
    nodeId = null;
    sid = null;
  };

  onCleanup(() => {
    disposed = true;
    unregister();
  });

  const resolveSid = (): string | null => {
    const host = el.closest("[data-focus-scope]") as HTMLElement | null;
    if (host) return focus.resolveScopeId(host) ?? null;
    return focus.getActiveScope?.() ?? null;
  };

  const registerIntoScope = (options: FocusableOptions | undefined): RegResult => {
    if (!options) {
      unregister();
      return "no-options";
    }

    const next = resolveSid();
    if (!next) {
      unregister();
      return "no-scope";
    }

    if (nodeId && sid !== next) unregister();

    if (!nodeId) {
      nodeId = focus.registerNode(el, next, options);
      sid = next;
    } else {
      focus.setNodeOptions(nodeId, options);
    }

    return "registered";
  };

  const scheduleNoScopeWarning = () => {
    queueMicrotask(() => {
      if (disposed) return;

      const r1 = registerIntoScope(accessor());
      if (r1 !== "no-scope") return;

      requestAnimationFrame(() => {
        if (disposed) return;

        const r2 = registerIntoScope(accessor());
        if (r2 !== "no-scope") return;
        console.warn("focusable: no focus scope found for element", el);
      });
    });
  };

  onMount(() => {
    const r = registerIntoScope(accessor());
    if (r === "no-scope") scheduleNoScopeWarning();
  });

  createEffect(() => {
    const options = accessor();
    focus.getActiveScope?.();
    registerIntoScope(options);
  });
}
