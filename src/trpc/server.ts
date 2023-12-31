import {
  createTRPCProxyClient,
  httpLink,
  loggerLink
} from "@trpc/client";
import { type AppRouter } from "~/server/api/root";
import { getUrl, transformer } from "./shared";

export const api = createTRPCProxyClient<AppRouter>({
  transformer,
  links: [
    loggerLink({
      enabled: (op) =>
        process.env.NODE_ENV === "development" ||
        (op.direction === "down" && op.result instanceof Error),
    }),
    httpLink({
      url: getUrl(),
      headers() {
        return {
          "x-trpc-source": "rsc",
        };
      },
    }),
  ],
});