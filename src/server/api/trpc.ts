/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { TRPCError, initTRPC } from "@trpc/server";
import type { NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { VerifyJWT } from "~/jwt";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "~/server/db";
import { Entries, Quizes } from "../db/schema";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

interface CreateContextOptions {
  req: NextRequest;
  entry?: {
    id: string;
    name: string;
    quizID: string;
    lastname: string;
    class: string;
    score: number;
  };
  quiz?: {
    id: string;
    name: string;
  };
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    req: opts.req,
    db,
    entry: opts.entry,
    quiz: opts.quiz,
  };
};
/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = (opts: { req: NextRequest}) => {
  // Fetch stuff that depends on the request

  return createInnerTRPCContext({
    req: opts.req,
  });
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure
  .use(async(opts)=>{
    const cookie = cookies().get("Authorization")
    if(!cookie) throw new TRPCError({code:'UNAUTHORIZED', message:"Authorization missing"})
    if(await VerifyJWT(cookie.value)) return opts.next()
    cookies().delete("Authorization")
    throw new TRPCError({code:'UNAUTHORIZED', message:"Authorization incorrect"})
  });
export const quizStartProcedure = t.procedure
  .use(async(opts)=>{
    const cookie = cookies().get("quizID")
    if(!cookie) throw new TRPCError({code:'BAD_REQUEST', message:"Quiz missing"})
    const quiz = (await opts.ctx.db.select().from(Quizes).where(eq(Quizes.id, cookie.value)))[0]
    if(quiz){
      opts.ctx.quiz = quiz
      return opts.next()
    }
    throw new TRPCError({code:'BAD_REQUEST', message:"Quiz incorrect"})
  });
export const quizProcedure = quizStartProcedure
  .use(async(opts)=>{
    const cookie = cookies().get("entryID")
    if(!cookie) throw new TRPCError({code:'BAD_REQUEST', message:"Entry missing"})
    const entry = (await opts.ctx.db.select().from(Entries).where(eq(Entries.id, cookie.value)))[0]
    if(entry){
      opts.ctx.entry = entry
      return opts.next()
    }
    throw new TRPCError({code:'BAD_REQUEST', message:"Quiz incorrect"})
  });