import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";

/**
 * Get the current authenticated user session on the server
 * @returns Session object with user information or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const session = await getServerSession(authOptions);
    return session?.user || null;
  } catch (error) {
    console.error("Error getting server session:", error);
    return null;
  }
}
