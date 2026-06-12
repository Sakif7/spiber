import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { testimonialUpdateSchema } from "@/lib/schemas/testimonial";
import {
  updateTestimonial,
  softDeleteTestimonial,
} from "@/lib/repositories/testimonials.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, testimonialUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const doc = await updateTestimonial(id, parsed.data);
  if (!doc) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "testimonial.update",
    entityType: "Testimonial",
    entityId: id,
    after: parsed.data,
  });
  return ok({ id });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const doc = await softDeleteTestimonial(id);
  if (!doc) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "testimonial.delete",
    entityType: "Testimonial",
    entityId: id,
  });
  return ok({ id });
}
