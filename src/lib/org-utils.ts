import { prisma } from "@/lib/prisma";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrgLookup {
  id: string;
  slug: string;
}

/**
 * Slugify a string for URL: lowercase, replace spaces/special chars with hyphens.
 */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "org";
}

/**
 * Generate a unique slug for an organization. If base slug is taken, appends -1, -2, etc.
 */
export async function generateUniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 0;
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

/**
 * Resolve organization by slug or by id (for backwards compatibility with UUID in URL).
 * Returns { id, slug } or null if not found.
 */
export async function getOrgBySlugOrId(slugOrId: string): Promise<OrgLookup | null> {
  if (!slugOrId) return null;

  const isUuid = UUID_REGEX.test(slugOrId);

  const org = await prisma.organization.findFirst({
    where: isUuid ? { id: slugOrId } : { slug: slugOrId },
    select: { id: true, slug: true },
  });

  if (!org) return null;
  // If slug is null (legacy org), use id as slug for URL consistency
  const slug = org.slug ?? org.id;
  return { id: org.id, slug };
}
