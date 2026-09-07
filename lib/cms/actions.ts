"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  cmsAboutSchema,
  cmsBlogPostSchema,
  cmsCaseStudySchema,
  cmsContentStatusSchema,
  cmsFaqSchema,
  cmsIndustrySchema,
  cmsServiceSchema,
  cmsTestimonialSchema,
} from "@/lib/validation/app";
import type { Database, Json } from "@/types/database";
import { ABOUT_SETTING_KEY } from "@/lib/cms/about";

type CmsStatus = Database["public"]["Enums"]["cms_content_status"];

function fieldErrors(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): ActionResult {
  return {
    ok: false,
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    error: "Please check the form and try again.",
  };
}

function revalidateCmsPublic() {
  revalidatePath("/app/cms");
  revalidatePath("/resources");
  revalidatePath("/services");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/case-studies");
}

function parseRating(raw: string | undefined): number | null | { error: string } {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return { error: "Rating must be 1–5." };
  }
  return n;
}

export async function createBlogPost(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsBlogPostSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    excerpt: parsed.data.excerpt ?? "",
    body: parsed.data.body,
    author_user_id: workspace.user.id,
    status: "draft",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That slug is already in use." };
    }
    return { ok: false, error: error.message ?? "Unable to create post." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "Draft post created." };
}

export async function createService(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsServiceSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    summary: parsed.data.summary ?? "",
    description: parsed.data.description ?? "",
    sort_order: 0,
    status: "draft",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That slug is already in use." };
    }
    return { ok: false, error: error.message ?? "Unable to create service." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "Draft service created." };
}

export async function createFaq(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsFaqSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("faqs").insert({
    question: parsed.data.question,
    answer: parsed.data.answer,
    category: parsed.data.category?.trim() || "general",
    sort_order: 0,
    status: "draft",
  });

  if (error) {
    return { ok: false, error: error.message ?? "Unable to create FAQ." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "Draft FAQ created." };
}

export async function createIndustry(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsIndustrySchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("industries").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? "",
    sort_order: 0,
    status: "draft",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That slug is already in use." };
    }
    return { ok: false, error: error.message ?? "Unable to create industry." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "Draft industry created." };
}

export async function createTestimonial(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsTestimonialSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const rating = parseRating(parsed.data.rating);
  if (rating && typeof rating === "object" && "error" in rating) {
    return {
      ok: false,
      fieldErrors: { rating: [rating.error] },
      error: rating.error,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").insert({
    client_name: parsed.data.client_name,
    quote: parsed.data.quote,
    client_title: parsed.data.client_title?.trim() || null,
    company_name: parsed.data.company_name?.trim() || null,
    rating: rating as number | null,
    sort_order: 0,
    status: "draft",
  });

  if (error) {
    return { ok: false, error: error.message ?? "Unable to create testimonial." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "Draft testimonial created." };
}

export async function createCaseStudy(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsCaseStudySchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("case_studies").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    summary: parsed.data.summary ?? "",
    body: parsed.data.body,
    client_name: parsed.data.client_name?.trim() || null,
    industry: parsed.data.industry?.trim() || null,
    status: "draft",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That slug is already in use." };
    }
    return { ok: false, error: error.message ?? "Unable to create case study." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "Draft case study created." };
}

export async function upsertAboutPage(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsAboutSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const value = {
    headline: parsed.data.headline,
    body: parsed.data.body,
  } as Json;

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: ABOUT_SETTING_KEY,
      value,
      description: "Public About page headline and body",
      updated_by: workspace.user.id,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message ?? "Unable to save About page." };
  }

  revalidateCmsPublic();
  return { ok: true, message: "About page saved." };
}

export async function setCmsContentStatus(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "cms.manage");

  const parsed = cmsContentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid status update." };
  }

  const next = parsed.data.status as CmsStatus;
  const supabase = await createClient();
  const { entity, id } = parsed.data;

  if (entity === "blog_post") {
    const { error } = await supabase
      .from("blog_posts")
      .update({
        status: next,
        published_at: next === "published" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to update status." };
    }
    const { data: post } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    if (post?.slug) revalidatePath(`/resources/${post.slug}`);
  } else if (entity === "case_study") {
    const { error } = await supabase
      .from("case_studies")
      .update({
        status: next,
        published_at: next === "published" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to update status." };
    }
    const { data: study } = await supabase
      .from("case_studies")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    if (study?.slug) revalidatePath(`/case-studies/${study.slug}`);
  } else if (entity === "faq") {
    const { error } = await supabase
      .from("faqs")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to update status." };
    }
  } else if (entity === "industry") {
    const { error } = await supabase
      .from("industries")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to update status." };
    }
  } else if (entity === "testimonial") {
    const { error } = await supabase
      .from("testimonials")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to update status." };
    }
  } else {
    const { error } = await supabase
      .from("services")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to update status." };
    }
  }

  revalidateCmsPublic();
  return {
    ok: true,
    message:
      next === "published"
        ? "Published."
        : next === "archived"
          ? "Archived."
          : "Moved to draft.",
  };
}
