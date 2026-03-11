"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface OrgContextValue {
  orgId: string;
  slug: string;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  orgId,
  slug,
  children,
}: {
  orgId: string;
  slug: string;
  children: ReactNode;
}) {
  return (
    <OrgContext.Provider value={{ orgId, slug }}>{children}</OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

export function useOrgOptional(): OrgContextValue | null {
  return useContext(OrgContext);
}
