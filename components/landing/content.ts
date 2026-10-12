/**
 * Content for the landing page.
 *
 * Lives outside `landing-page.tsx` because the page itself is a client
 * component (the planner, the FAQ accordion and the device preview all hold
 * state) while `app/page.tsx` is a server component that needs the same
 * service list and FAQ pairs in order to emit `ItemList` and `FAQPage`
 * structured data. Duplicating them would let the JSON-LD drift from what the
 * page actually renders.
 *
 * Copy is verbatim from the reference in `BeepaBPO new landing design`.
 */

export const services = [
  "Customer Support",
  "Back Office Support",
  "Virtual Assistants",
  "Sales Support",
  "IT Support",
  "Marketing",
  "eLearning Course Development",
  "Slide Creator",
  "Data Entry",
  "Customer Relations",
] as const;

export const faqs: ReadonlyArray<readonly [string, string]> = [
  [
    "What can I outsource to Beepa?",
    "From customer support and back-office operations to virtual assistance, sales, IT, marketing, data entry, presentations and eLearning development, we help you shape a team around the work you need done.",
  ],
  [
    "Will my team work in my time zone?",
    "Your team’s schedule is planned around your business and customers. Discuss the hours and coverage you need during your consultation.",
  ],
  [
    "How do I track my team’s performance?",
    "Client access on web and mobile brings employee activity, attendance, payroll and overall performance together. Agree on the measures that matter to your business so reporting stays useful.",
  ],
  [
    "Can I start with just one person?",
    "Yes. Your team plan can start with one dedicated role and grow as your needs develop. Scope, coverage and pricing are confirmed before you move forward.",
  ],
  [
    "How does pricing work?",
    "Your proposal is tailored to the roles, team size, working hours and support you need. We do not publish a one-size-fits-all rate; the scope and costs are agreed before onboarding.",
  ],
  [
    "How can I apply to work with Beepa?",
    "Explore the career areas below and prepare your application brief. Current vacancies and the official application destination must be confirmed with Beepa before an application can be submitted.",
  ],
];