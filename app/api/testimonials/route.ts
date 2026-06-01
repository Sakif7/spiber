import { NextResponse } from "next/server";
import { getTestimonials } from "@/lib/services/landing.service";

export const revalidate = 60;

export async function GET() {
  const testimonials = await getTestimonials();
  return NextResponse.json({ testimonials });
}
