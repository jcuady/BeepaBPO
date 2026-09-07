-- Split from 013: new enum values cannot be used in the same transaction.
alter type public.membership_type add value if not exists 'applicant';
