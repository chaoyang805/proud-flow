"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";

export function ProudFlowQueryProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

