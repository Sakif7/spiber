import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { testimonialCreateSchema } from "@/lib/schemas/testimonial";
import { createTestimonial } from "@/lib/repositories/testimonials.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, testimonialCreateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const doc = await createTestimonial(parsed.data);
  await writeAudit({
    actorId: admin.sub,
    action: "testimonial.create",
    entityType: "Testimonial",
    entityId: String(doc._id),
    after: parsed.data,
  });
  return ok({ id: String(doc._id) });
}
