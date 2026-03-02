// lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import NextAuth, { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Apple from "next-auth/providers/apple";
import Atlassian from "next-auth/providers/atlassian";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // ✅ OAuth Providers
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
    Atlassian({
      clientId: process.env.ATLASSIAN_ID!,
      clientSecret: process.env.ATLASSIAN_SECRET!,
      authorization: {
        params: {
          scope: "read:me read:account",
          prompt: "consent",
        },
      }
    }),

    // ✅ Credentials Provider
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        // Email verification check
        if (!user.emailVerified) {
          throw new Error("Please verify your email before logging in");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Update lastActive on successful login (ignore if column not yet migrated)
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastActive: new Date() } as { lastActive: Date },
          });
        } catch {
          // Ignore: lastActive column may not exist yet or Prisma client may be stale
        }

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/auth", // Custom login page
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        // Update lastActive when JWT is created/refreshed (on login)
        if (user.id) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastActive: new Date() } as { lastActive: Date },
            });
          } catch {
            // Ignore: lastActive column may not exist yet or Prisma client may be stale
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        // Load name, email, image from DB so session always reflects saved profile (survives logout/login)
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { name: true, email: true, image: true },
          });
          if (dbUser) {
            session.user.name = dbUser.name ?? session.user.name ?? null;
            session.user.email = dbUser.email ?? session.user.email ?? null;
            session.user.image = dbUser.image ?? session.user.image ?? null;
          }
        } catch {
          // Keep existing session values if DB read fails
        }
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // After login redirect - preserve invite token if present
      if (url.startsWith("/")) return baseUrl + url;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },

    async signIn({ user, account, profile }) {
      // Handle OAuth account linking for existing users
      if (account?.provider !== "credentials" && user.email && account) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });
        
        if (dbUser) {
          // User exists - check if account is already linked
          const existingAccount = dbUser.accounts.find(
            (acc) => acc.provider === account.provider && acc.providerAccountId === account.providerAccountId
          );

          if (!existingAccount) {
            // Account not linked - link it now
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
            });
          }

          // Auto-verify email if not verified
          if (!dbUser.emailVerified) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { emailVerified: new Date() },
            });
          }

          // Update lastActive on OAuth sign-in (ignore if column not yet migrated)
          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { lastActive: new Date() } as { lastActive: Date },
            });
          } catch {
            // Ignore
          }
        } else if (user.id) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastActive: new Date() } as { lastActive: Date },
            });
          } catch {
            // Ignore
          }
        }
      }
      return true;
    },
  },

  events: {
    // ✅ Auto-verify OAuth users after creation
    async createUser({ user }) {
      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
};

export default NextAuth(authOptions);
