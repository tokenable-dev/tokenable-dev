import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

export function withFlushProp(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  return cloneElement(node as ReactElement<{ flush?: boolean }>, { flush: true });
}
