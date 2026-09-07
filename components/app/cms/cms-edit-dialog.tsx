"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlogPostForm } from "@/components/app/cms/blog-post-form";
import { ServiceForm } from "@/components/app/cms/service-form";
import { FaqForm } from "@/components/app/cms/faq-form";
import { IndustryForm } from "@/components/app/cms/industry-form";
import { TestimonialForm } from "@/components/app/cms/testimonial-form";
import { CaseStudyForm } from "@/components/app/cms/case-study-form";

type CmsEditTarget =
  | {
      entity: "blog_post";
      id: string;
      initial: {
        title: string;
        slug: string;
        excerpt: string;
        body: string;
      };
    }
  | {
      entity: "service";
      id: string;
      initial: {
        title: string;
        slug: string;
        summary: string;
        description: string;
      };
    }
  | {
      entity: "faq";
      id: string;
      initial: { question: string; answer: string; category: string };
    }
  | {
      entity: "industry";
      id: string;
      initial: { name: string; slug: string; description: string };
    }
  | {
      entity: "testimonial";
      id: string;
      initial: {
        client_name: string;
        quote: string;
        client_title: string;
        company_name: string;
        rating: string;
      };
    }
  | {
      entity: "case_study";
      id: string;
      initial: {
        title: string;
        slug: string;
        summary: string;
        body: string;
        client_name: string;
        industry: string;
      };
    };

const TITLES: Record<CmsEditTarget["entity"], string> = {
  blog_post: "Edit blog post",
  service: "Edit service",
  faq: "Edit FAQ",
  industry: "Edit industry",
  testimonial: "Edit testimonial",
  case_study: "Edit case study",
};

export function CmsEditButton({ target }: { target: CmsEditTarget }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const prefix = `edit-${target.entity}-${target.id.slice(0, 8)}`;

  function closeAndRefresh() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-navy">
              {TITLES[target.entity]}
            </DialogTitle>
          </DialogHeader>
          {target.entity === "blog_post" ? (
            <BlogPostForm
              id={target.id}
              initial={target.initial}
              idPrefix={prefix}
              onSaved={closeAndRefresh}
            />
          ) : null}
          {target.entity === "service" ? (
            <ServiceForm
              id={target.id}
              initial={target.initial}
              idPrefix={prefix}
              onSaved={closeAndRefresh}
            />
          ) : null}
          {target.entity === "faq" ? (
            <FaqForm
              id={target.id}
              initial={target.initial}
              idPrefix={prefix}
              onSaved={closeAndRefresh}
            />
          ) : null}
          {target.entity === "industry" ? (
            <IndustryForm
              id={target.id}
              initial={target.initial}
              idPrefix={prefix}
              onSaved={closeAndRefresh}
            />
          ) : null}
          {target.entity === "testimonial" ? (
            <TestimonialForm
              id={target.id}
              initial={target.initial}
              idPrefix={prefix}
              onSaved={closeAndRefresh}
            />
          ) : null}
          {target.entity === "case_study" ? (
            <CaseStudyForm
              id={target.id}
              initial={target.initial}
              idPrefix={prefix}
              onSaved={closeAndRefresh}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
