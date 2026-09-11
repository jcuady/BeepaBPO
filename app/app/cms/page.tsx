import type { Metadata } from "next";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { StatusBadge } from "@/components/app/status-badge";
import { AboutPageForm } from "@/components/app/cms/about-page-form";
import { BlogPostForm } from "@/components/app/cms/blog-post-form";
import { CaseStudyForm } from "@/components/app/cms/case-study-form";
import { FaqForm } from "@/components/app/cms/faq-form";
import { IndustryForm } from "@/components/app/cms/industry-form";
import { ServiceForm } from "@/components/app/cms/service-form";
import { TestimonialForm } from "@/components/app/cms/testimonial-form";
import { CmsStatusActions } from "@/components/app/cms/cms-status-actions";
import { CmsEditButton } from "@/components/app/cms/cms-edit-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ABOUT_SETTING_KEY, parseAboutSetting } from "@/lib/cms/about";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CMS" };

export default async function CmsAdminPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "cms.manage");

  const supabase = await createClient();
  const [
    { data: posts },
    { data: services },
    { data: faqs },
    { data: industries },
    { data: testimonials },
    { data: caseStudies },
    { data: aboutRow },
  ] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, body, status, published_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("services")
      .select("id, title, slug, summary, description, status, sort_order, updated_at")
      .order("sort_order", { ascending: true })
      .limit(50),
    supabase
      .from("faqs")
      .select("id, question, answer, category, status, updated_at")
      .order("sort_order", { ascending: true })
      .limit(50),
    supabase
      .from("industries")
      .select("id, name, slug, description, status, updated_at")
      .order("sort_order", { ascending: true })
      .limit(50),
    supabase
      .from("testimonials")
      .select(
        "id, client_name, client_title, company_name, quote, rating, status, updated_at",
      )
      .order("sort_order", { ascending: true })
      .limit(50),
    supabase
      .from("case_studies")
      .select(
        "id, title, slug, summary, body, client_name, industry, status, published_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", ABOUT_SETTING_KEY)
      .maybeSingle(),
  ]);

  const about = parseAboutSetting(aboutRow?.value);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Create, edit, and publish About, industries, testimonials, case studies, services, resources, and FAQs."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            About page
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AboutPageForm
            initialHeadline={about?.headline}
            initialBody={about?.body}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New blog post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BlogPostForm />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New FAQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FaqForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              FAQs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!faqs?.length ? (
              <EmptyState
                icon={IconFileText}
                title="No FAQs yet"
                description="Create a draft, then publish it to /contact."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faqs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-navy">
                        <span className="line-clamp-2">{row.question}</span>
                        <span className="mt-1 block text-xs capitalize text-slate">
                          {row.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <CmsEditButton
                            target={{
                              entity: "faq",
                              id: row.id,
                              initial: {
                                question: row.question,
                                answer: row.answer,
                                category: row.category,
                              },
                            }}
                          />
                          <CmsStatusActions
                            id={row.id}
                            entity="faq"
                            status={row.status}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New industry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IndustryForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Industries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!industries?.length ? (
              <EmptyState
                icon={IconFileText}
                title="No industries yet"
                description="Create a draft, then publish it to /about."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {industries.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-navy">
                        <span className="line-clamp-2">{row.name}</span>
                        <span className="mt-1 block text-xs text-slate">
                          {row.slug}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <CmsEditButton
                            target={{
                              entity: "industry",
                              id: row.id,
                              initial: {
                                name: row.name,
                                slug: row.slug,
                                description: row.description ?? "",
                              },
                            }}
                          />
                          <CmsStatusActions
                            id={row.id}
                            entity="industry"
                            status={row.status}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New testimonial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TestimonialForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Testimonials
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!testimonials?.length ? (
              <EmptyState
                icon={IconFileText}
                title="No testimonials yet"
                description="Create a draft, then publish it to /about."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testimonials.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-navy">
                        <span className="line-clamp-2">{row.client_name}</span>
                        {row.company_name ? (
                          <span className="mt-1 block text-xs text-slate">
                            {row.company_name}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <CmsEditButton
                            target={{
                              entity: "testimonial",
                              id: row.id,
                              initial: {
                                client_name: row.client_name,
                                quote: row.quote,
                                client_title: row.client_title ?? "",
                                company_name: row.company_name ?? "",
                                rating:
                                  row.rating != null ? String(row.rating) : "",
                              },
                            }}
                          />
                          <CmsStatusActions
                            id={row.id}
                            entity="testimonial"
                            status={row.status}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New case study
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CaseStudyForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Case studies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!caseStudies?.length ? (
              <EmptyState
                icon={IconFileText}
                title="No case studies yet"
                description="Create a draft, then publish it to /case-studies."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseStudies.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-navy">
                        <span className="line-clamp-2">{row.title}</span>
                        <span className="mt-1 block text-xs text-slate">
                          {row.slug}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <CmsEditButton
                            target={{
                              entity: "case_study",
                              id: row.id,
                              initial: {
                                title: row.title,
                                slug: row.slug,
                                summary: row.summary ?? "",
                                body: row.body,
                                client_name: row.client_name ?? "",
                                industry: row.industry ?? "",
                              },
                            }}
                          />
                          <CmsStatusActions
                            id={row.id}
                            entity="case_study"
                            status={row.status}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!services?.length ? (
            <EmptyState
              icon={IconFileText}
              title="No services yet"
              description="Create a draft, then publish it to /services."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-navy">
                      <span className="line-clamp-2">{row.title}</span>
                    </TableCell>
                    <TableCell className="text-slate">{row.slug}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <CmsEditButton
                          target={{
                            entity: "service",
                            id: row.id,
                            initial: {
                              title: row.title,
                              slug: row.slug,
                              summary: row.summary ?? "",
                              description: row.description ?? "",
                            },
                          }}
                        />
                        <CmsStatusActions
                          id={row.id}
                          entity="service"
                          status={row.status}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Blog posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!posts?.length ? (
            <EmptyState
              icon={IconFileText}
              title="No posts yet"
              description="Create a draft, then publish it to /resources."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-navy">
                      <span className="line-clamp-2">{row.title}</span>
                    </TableCell>
                    <TableCell className="text-slate">{row.slug}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-slate">
                      {row.published_at
                        ? format(new Date(row.published_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <CmsEditButton
                          target={{
                            entity: "blog_post",
                            id: row.id,
                            initial: {
                              title: row.title,
                              slug: row.slug,
                              excerpt: row.excerpt ?? "",
                              body: row.body,
                            },
                          }}
                        />
                        <CmsStatusActions
                          id={row.id}
                          entity="blog_post"
                          status={row.status}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
