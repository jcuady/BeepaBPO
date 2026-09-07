-- Beepa Phase 1: extensions + enums
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "moddatetime" with schema extensions;

-- Identity / org
create type public.org_type as enum ('internal', 'client');
create type public.org_status as enum ('active', 'inactive', 'onboarding');
create type public.membership_type as enum ('internal', 'client');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'inactive');
create type public.role_scope as enum ('system', 'internal', 'client', 'applicant');
create type public.profile_status as enum ('active', 'invited', 'suspended', 'inactive');

-- Approvals
create type public.approval_status as enum (
  'pending', 'approved', 'rejected', 'cancelled', 'escalated'
);

-- Shared
create type public.visibility as enum (
  'private', 'employee_visible', 'client_visible', 'internal', 'public'
);
