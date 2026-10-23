"use client";

import { useCallback, useEffect, useState } from "react";

/** Observe element layout size — avoids ECharts init when clientWidth/Height are 0. */
export function useElementSize(): {
  ref: (node: HTMLElement | null) => void;
  width: number;
  height: number;
  ready: boolean;
} {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const measure = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(element);
    return () => ro.disconnect();
  }, [element]);

  return {
    ref,
    ...size,
    ready: size.width > 0 && size.height > 0,
  };
}
