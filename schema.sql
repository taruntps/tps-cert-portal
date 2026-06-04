-- ============================================================
-- TPS Cert Portal — Supabase Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'technical_manager', 'auditor', 'sales');
CREATE TYPE cert_type AS ENUM ('pre_accreditation', 'nabcb_accredited');
CREATE TYPE cert_status AS ENUM ('active', 'suspended', 'withdrawn', 'expired');
CREATE TYPE audit_type AS ENUM ('stage_1', 'stage_2', 'surveillance_1', 'surveillance_2', 'recertification', 'special', 'transfer');
CREATE TYPE audit_status AS ENUM ('planned', 'scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE nc_type AS ENUM ('major', 'minor', 'observation');
CREATE TYPE nc_status AS ENUM ('open', 'root_cause_submitted', 'corrective_action_submitted', 'verified', 'closed', 'overdue');
CREATE TYPE committee_type AS ENUM ('impartiality', 'certification', 'mrm');
CREATE TYPE enquiry_status AS ENUM ('new', 'contacted', 'quoted', 'negotiating', 'won', 'lost', 'on_hold');
CREATE TYPE compliance_activity_type AS ENUM ('mrm', 'internal_audit', 'surveillance', 'recertification', 'nabcb_submission', 'committee_meeting', 'other');
CREATE TYPE compliance_status AS ENUM ('pending', 'completed', 'overdue', 'cancelled');

-- ============================================================
-- TABLE 1: profiles (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    role        user_role NOT NULL DEFAULT 'auditor',
    phone       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.profiles IS 'Portal user accounts — extends Supabase auth.users';

-- ============================================================
-- TABLE 2: auditors (all 8 auditors + 1 technical expert)
-- profile_id is nullable — auditors without portal login
-- ============================================================
CREATE TABLE public.auditors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name           TEXT NOT NULL,
    email               TEXT,
    phone               TEXT,
    qualifications      TEXT,
    competency_areas    JSONB NOT NULL DEFAULT '[]',
    is_lead_auditor     BOOLEAN NOT NULL DEFAULT false,
    is_technical_expert BOOLEAN NOT NULL DEFAULT false,
    nabcb_approved      BOOLEAN NOT NULL DEFAULT false,
    status              TEXT NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.auditors IS 'All auditors and technical experts; profile_id links to portal login if they have one';

-- ============================================================
-- TABLE 3: companies
-- ============================================================
CREATE TABLE public.companies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    legal_name          TEXT,
    contact_person      TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    address             TEXT,
    city                TEXT,
    state               TEXT,
    country             TEXT NOT NULL DEFAULT 'India',
    sector              TEXT NOT NULL DEFAULT 'FSMS',
    scope_description   TEXT,
    status              TEXT NOT NULL DEFAULT 'active',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.companies IS 'Certified organisations master data';

-- ============================================================
-- TABLE 4: certifications (one per cycle per company)
-- ============================================================
CREATE TABLE public.certifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    certificate_number  TEXT UNIQUE,
    certificate_type    cert_type NOT NULL,
    standard            TEXT NOT NULL DEFAULT 'ISO 22000:2018',
    scope_description   TEXT,
    issue_date          DATE NOT NULL,
    expiry_date         DATE,
    surveillance_1_due  DATE,
    surveillance_2_due  DATE,
    recertification_due DATE,
    status              cert_status NOT NULL DEFAULT 'active',
    is_nabcb_accredited BOOLEAN NOT NULL DEFAULT false,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.certifications IS 'One row per certification cycle per company; holds all key dates';

-- ============================================================
-- TABLE 5: audit_assignments (every audit event)
-- ============================================================
CREATE TABLE public.audit_assignments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id        UUID NOT NULL REFERENCES public.certifications(id) ON DELETE RESTRICT,
    company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    audit_type              audit_type NOT NULL,
    planned_date            DATE,
    actual_start_date       DATE,
    actual_end_date         DATE,
    lead_auditor_id         UUID REFERENCES public.auditors(id) ON DELETE SET NULL,
    status                  audit_status NOT NULL DEFAULT 'planned',
    audit_plan_drive_url    TEXT,
    audit_report_drive_url  TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.audit_assignments IS 'Every audit event (Stage 1/2, S1/S2, Recertification, Special)';

-- ============================================================
-- TABLE 6: audit_team_members (junction)
-- ============================================================
CREATE TABLE public.audit_team_members (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_assignment_id   UUID NOT NULL REFERENCES public.audit_assignments(id) ON DELETE CASCADE,
    auditor_id            UUID NOT NULL REFERENCES public.auditors(id) ON DELETE CASCADE,
    role                  TEXT NOT NULL DEFAULT 'co_auditor',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(audit_assignment_id, auditor_id)
);
COMMENT ON TABLE public.audit_team_members IS 'Who is on each audit (lead, co_auditor, technical_expert, witness)';

-- ============================================================
-- TABLE 7: witness_audits
-- ============================================================
CREATE TABLE public.witness_audits (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_assignment_id   UUID NOT NULL REFERENCES public.audit_assignments(id) ON DELETE CASCADE,
    witness_name          TEXT,
    witness_organization  TEXT,
    witness_date          DATE,
    observations          TEXT,
    outcome               TEXT,
    report_drive_url      TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.witness_audits IS 'NABCB witness audit records linked to an audit assignment';

-- ============================================================
-- TABLE 8: nonconformities (full NC lifecycle)
-- ============================================================
CREATE TABLE public.nonconformities (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    audit_assignment_id   UUID REFERENCES public.audit_assignments(id) ON DELETE SET NULL,
    nc_ref                TEXT,
    nc_type               nc_type NOT NULL,
    requirement_ref       TEXT,
    description           TEXT NOT NULL,
    raised_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    raised_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date              DATE,
    status                nc_status NOT NULL DEFAULT 'open',
    root_cause            TEXT,
    corrective_action     TEXT,
    verification_notes    TEXT,
    closed_date           DATE,
    closed_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.nonconformities IS 'Full NC lifecycle from raise to close';

-- ============================================================
-- TABLE 9: compliance_calendar
-- ============================================================
CREATE TABLE public.compliance_calendar (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    activity_type   compliance_activity_type NOT NULL,
    due_date        DATE NOT NULL,
    company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status          compliance_status NOT NULL DEFAULT 'pending',
    notes           TEXT,
    completion_date DATE,
    completed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.compliance_calendar IS 'All mandatory CB activities with due dates and status; company_id NULL = org-level activity';

-- ============================================================
-- TABLE 10: internal_audits
-- ============================================================
CREATE TABLE public.internal_audits (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_date        DATE NOT NULL,
    auditor_id        UUID REFERENCES public.auditors(id) ON DELETE SET NULL,
    scope             TEXT,
    findings          JSONB NOT NULL DEFAULT '[]',
    status            TEXT NOT NULL DEFAULT 'planned',
    report_drive_url  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 11: committees (MRM, Impartiality, Certification)
-- ============================================================
CREATE TABLE public.committees (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    committee_type    committee_type NOT NULL,
    title             TEXT,
    meeting_date      DATE,
    agenda            JSONB NOT NULL DEFAULT '[]',
    attendees         JSONB NOT NULL DEFAULT '[]',
    decisions         JSONB NOT NULL DEFAULT '[]',
    minutes_drive_url TEXT,
    status            TEXT NOT NULL DEFAULT 'scheduled',
    created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.committees IS 'MRM, impartiality committee, and certification committee records';

-- ============================================================
-- TABLE 12: enquiries (sales pipeline)
-- ============================================================
CREATE TABLE public.enquiries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    TEXT NOT NULL,
    contact_name    TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    standard        TEXT NOT NULL DEFAULT 'ISO 22000:2018',
    sector          TEXT NOT NULL DEFAULT 'FSMS',
    status          enquiry_status NOT NULL DEFAULT 'new',
    source          TEXT,
    assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    quote_amount    NUMERIC(12,2),
    notes           TEXT,
    follow_up_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 13: drive_documents (metadata cache for Drive sync)
-- ============================================================
CREATE TABLE public.drive_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_file_id   TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    category        TEXT,
    folder_path     TEXT,
    company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    drive_url       TEXT,
    mime_type       TEXT,
    last_modified   TIMESTAMPTZ,
    last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.drive_documents IS 'Lightweight Drive metadata cache; Google Drive is source of truth';

-- ============================================================
-- TABLE 14: notifications
-- ============================================================
CREATE TABLE public.notifications (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL,
    message               TEXT,
    type                  TEXT NOT NULL DEFAULT 'info',
    related_entity_type   TEXT,
    related_entity_id     UUID,
    is_read               BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_certifications_company    ON public.certifications(company_id);
CREATE INDEX idx_certifications_status     ON public.certifications(status);
CREATE INDEX idx_certifications_s1_due     ON public.certifications(surveillance_1_due);
CREATE INDEX idx_audit_assignments_company ON public.audit_assignments(company_id);
CREATE INDEX idx_audit_assignments_cert    ON public.audit_assignments(certification_id);
CREATE INDEX idx_audit_team_assignment     ON public.audit_team_members(audit_assignment_id);
CREATE INDEX idx_audit_team_auditor        ON public.audit_team_members(auditor_id);
CREATE INDEX idx_ncs_company               ON public.nonconformities(company_id);
CREATE INDEX idx_ncs_status                ON public.nonconformities(status);
CREATE INDEX idx_compliance_due_date       ON public.compliance_calendar(due_date);
CREATE INDEX idx_compliance_status         ON public.compliance_calendar(status);
CREATE INDEX idx_notifications_user        ON public.notifications(user_id, is_read);
CREATE INDEX idx_enquiries_status          ON public.enquiries(status);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at           BEFORE UPDATE ON public.profiles           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_auditors_updated_at           BEFORE UPDATE ON public.auditors           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_companies_updated_at          BEFORE UPDATE ON public.companies          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_certifications_updated_at     BEFORE UPDATE ON public.certifications     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_assignments_updated_at  BEFORE UPDATE ON public.audit_assignments  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_nonconformities_updated_at    BEFORE UPDATE ON public.nonconformities    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_compliance_calendar_updated_at BEFORE UPDATE ON public.compliance_calendar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_committees_updated_at         BEFORE UPDATE ON public.committees         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_enquiries_updated_at          BEFORE UPDATE ON public.enquiries          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- AUTO-CREATE profile row on new Supabase auth user
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'auditor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPER FUNCTION: get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_audits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nonconformities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_audits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users view own profile"         ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin views all profiles"       ON public.profiles FOR SELECT USING (public.my_role() = 'admin');
CREATE POLICY "Admin manages all profiles"     ON public.profiles FOR ALL    USING (public.my_role() = 'admin');
CREATE POLICY "Users update own profile"       ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- AUDITORS (all authenticated users can read)
CREATE POLICY "Authenticated read auditors"    ON public.auditors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin TM manage auditors"       ON public.auditors FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));

-- COMPANIES
CREATE POLICY "Admin TM Sales view companies"  ON public.companies FOR SELECT USING (public.my_role() IN ('admin', 'technical_manager', 'sales'));
CREATE POLICY "Auditor views assigned companies" ON public.companies FOR SELECT USING (
  public.my_role() = 'auditor' AND id IN (
    SELECT DISTINCT aa.company_id FROM public.audit_assignments aa
    JOIN public.audit_team_members atm ON atm.audit_assignment_id = aa.id
    JOIN public.auditors au ON au.id = atm.auditor_id WHERE au.profile_id = auth.uid()
  )
);
CREATE POLICY "Admin TM manage companies"      ON public.companies FOR ALL USING (public.my_role() IN ('admin', 'technical_manager'));

-- CERTIFICATIONS
CREATE POLICY "Admin TM Sales view certs"      ON public.certifications FOR SELECT USING (public.my_role() IN ('admin', 'technical_manager', 'sales'));
CREATE POLICY "Auditor views assigned certs"   ON public.certifications FOR SELECT USING (
  public.my_role() = 'auditor' AND company_id IN (
    SELECT DISTINCT aa.company_id FROM public.audit_assignments aa
    JOIN public.audit_team_members atm ON atm.audit_assignment_id = aa.id
    JOIN public.auditors au ON au.id = atm.auditor_id WHERE au.profile_id = auth.uid()
  )
);
CREATE POLICY "Admin TM manage certs"          ON public.certifications FOR ALL USING (public.my_role() IN ('admin', 'technical_manager'));

-- AUDIT_ASSIGNMENTS
CREATE POLICY "Admin TM view all assignments"  ON public.audit_assignments FOR SELECT USING (public.my_role() IN ('admin', 'technical_manager'));
CREATE POLICY "Auditor views own assignments"  ON public.audit_assignments FOR SELECT USING (
  public.my_role() = 'auditor' AND id IN (
    SELECT atm.audit_assignment_id FROM public.audit_team_members atm
    JOIN public.auditors au ON au.id = atm.auditor_id WHERE au.profile_id = auth.uid()
  )
);
CREATE POLICY "Admin TM manage assignments"    ON public.audit_assignments FOR ALL USING (public.my_role() IN ('admin', 'technical_manager'));

-- AUDIT_TEAM_MEMBERS
CREATE POLICY "Authenticated read team"        ON public.audit_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin TM manage team"           ON public.audit_team_members FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));

-- WITNESS_AUDITS
CREATE POLICY "Admin TM manage witness"        ON public.witness_audits FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));
CREATE POLICY "Auditor reads own witness"      ON public.witness_audits FOR SELECT USING (
  public.my_role() = 'auditor' AND audit_assignment_id IN (
    SELECT atm.audit_assignment_id FROM public.audit_team_members atm
    JOIN public.auditors au ON au.id = atm.auditor_id WHERE au.profile_id = auth.uid()
  )
);

-- NONCONFORMITIES
CREATE POLICY "Admin TM view all NCs"          ON public.nonconformities FOR SELECT USING (public.my_role() IN ('admin', 'technical_manager'));
CREATE POLICY "Auditor views assigned NCs"     ON public.nonconformities FOR SELECT USING (
  public.my_role() = 'auditor' AND company_id IN (
    SELECT DISTINCT aa.company_id FROM public.audit_assignments aa
    JOIN public.audit_team_members atm ON atm.audit_assignment_id = aa.id
    JOIN public.auditors au ON au.id = atm.auditor_id WHERE au.profile_id = auth.uid()
  )
);
CREATE POLICY "Admin TM manage NCs"            ON public.nonconformities FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));

-- COMPLIANCE_CALENDAR
CREATE POLICY "Admin TM Sales view compliance" ON public.compliance_calendar FOR SELECT USING (public.my_role() IN ('admin', 'technical_manager', 'sales'));
CREATE POLICY "Auditor reads compliance"       ON public.compliance_calendar FOR SELECT USING (public.my_role() = 'auditor');
CREATE POLICY "Admin TM manage compliance"     ON public.compliance_calendar FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));

-- INTERNAL_AUDITS
CREATE POLICY "Authenticated read int audits"  ON public.internal_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin TM manage int audits"     ON public.internal_audits FOR ALL USING (public.my_role() IN ('admin', 'technical_manager'));

-- COMMITTEES
CREATE POLICY "Authenticated read committees"  ON public.committees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin TM manage committees"     ON public.committees FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));

-- ENQUIRIES
CREATE POLICY "Admin views all enquiries"      ON public.enquiries FOR SELECT USING (public.my_role() = 'admin');
CREATE POLICY "TM views all enquiries"         ON public.enquiries FOR SELECT USING (public.my_role() = 'technical_manager');
CREATE POLICY "Sales manages own enquiries"    ON public.enquiries FOR ALL    USING (public.my_role() = 'sales' AND (assigned_to = auth.uid() OR assigned_to IS NULL));
CREATE POLICY "Admin manages all enquiries"    ON public.enquiries FOR ALL    USING (public.my_role() = 'admin');

-- DRIVE_DOCUMENTS
CREATE POLICY "Authenticated read drive docs"  ON public.drive_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin TM manage drive docs"     ON public.drive_documents FOR ALL    USING (public.my_role() IN ('admin', 'technical_manager'));

-- NOTIFICATIONS
CREATE POLICY "Users read own notifications"   ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin manages notifications"    ON public.notifications FOR ALL    USING (public.my_role() = 'admin');

-- ============================================================
-- SEED DATA
-- ============================================================

-- 4 Companies
INSERT INTO public.companies (id, name, sector, scope_description, status) VALUES
  ('c0000001-0000-0000-0000-000000000000', 'Chimak Healthcare',           'FSMS', 'Food Safety Management System — ISO 22000:2018', 'active'),
  ('c0000002-0000-0000-0000-000000000000', 'Zeno Veda Health Remedies',   'FSMS', 'Food Safety Management System — ISO 22000:2018', 'active'),
  ('c0000003-0000-0000-0000-000000000000', 'Chandigarh Agritech Pvt Ltd', 'FSMS', 'Food Safety Management System — ISO 22000:2018', 'active'),
  ('c0000004-0000-0000-0000-000000000000', 'Anuttama Wellness Pvt Ltd',   'FSMS', 'Food Safety Management System — ISO 22000:2018', 'active');

-- 4 Certifications
INSERT INTO public.certifications
  (id, company_id, certificate_type, standard, scope_description,
   issue_date, surveillance_1_due, surveillance_2_due, recertification_due,
   status, is_nabcb_accredited)
VALUES
  ('cf000001-0000-0000-0000-000000000000',
   'c0000001-0000-0000-0000-000000000000',
   'pre_accreditation', 'ISO 22000:2018', 'Food Safety Management System',
   '2025-08-22', '2026-08-22', '2027-08-22', '2028-08-22', 'active', false),

  ('cf000002-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   'pre_accreditation', 'ISO 22000:2018', 'Food Safety Management System',
   '2025-08-26', '2026-08-26', '2027-08-26', '2028-08-26', 'active', false),

  ('cf000003-0000-0000-0000-000000000000',
   'c0000003-0000-0000-0000-000000000000',
   'nabcb_accredited', 'ISO 22000:2018', 'Food Safety Management System',
   '2026-06-04', '2027-06-04', '2028-06-04', '2029-06-04', 'active', true),

  ('cf000004-0000-0000-0000-000000000000',
   'c0000004-0000-0000-0000-000000000000',
   'nabcb_accredited', 'ISO 22000:2018', 'Food Safety Management System',
   '2026-06-04', '2027-06-04', '2028-06-04', '2029-06-04', 'active', true);

-- 9 Auditors (8 auditors + 1 technical expert)
-- profile_id will be linked later when portal users are created via Supabase invite
INSERT INTO public.auditors (id, full_name, email, is_lead_auditor, is_technical_expert, nabcb_approved, status) VALUES
  ('a0000001-0000-0000-0000-000000000000', 'Tarun Pratap Singh', 'tarun@tpsxperts.com', true,  false, true,  'active'),
  ('a0000002-0000-0000-0000-000000000000', 'Anil Kumar',          NULL,                  false, false, false, 'active'),
  ('a0000003-0000-0000-0000-000000000000', 'Dr. M. K. R. Khan',   NULL,                  true,  false, false, 'active'),
  ('a0000004-0000-0000-0000-000000000000', 'Sunil Kumar',         NULL,                  false, false, false, 'active'),
  ('a0000005-0000-0000-0000-000000000000', 'Virat Mishra',        NULL,                  true,  false, false, 'active'),
  ('a0000006-0000-0000-0000-000000000000', 'Jitendra Chauhan',    NULL,                  false, false, false, 'active'),
  ('a0000007-0000-0000-0000-000000000000', 'R K Sabharwal',       NULL,                  false, false, false, 'active'),
  ('a0000008-0000-0000-0000-000000000000', 'Sahil Sabharwal',     NULL,                  false, false, false, 'active'),
  ('a0000009-0000-0000-0000-000000000000', 'Prabhjot Kaur',       NULL,                  false, true,  false, 'active');

-- Compliance Calendar (pre-seeded — all key dates)
INSERT INTO public.compliance_calendar (title, activity_type, due_date, company_id, status) VALUES
  -- MRM (org-level, no company_id)
  ('Annual Management Review Meeting', 'mrm', '2026-08-30', NULL, 'pending'),

  -- Surveillance 1
  ('Surveillance 1 — Chimak Healthcare',           'surveillance', '2026-08-22', 'c0000001-0000-0000-0000-000000000000', 'pending'),
  ('Surveillance 1 — Zeno Veda Health Remedies',   'surveillance', '2026-08-26', 'c0000002-0000-0000-0000-000000000000', 'pending'),
  ('Surveillance 1 — Chandigarh Agritech Pvt Ltd', 'surveillance', '2027-06-04', 'c0000003-0000-0000-0000-000000000000', 'pending'),
  ('Surveillance 1 — Anuttama Wellness Pvt Ltd',   'surveillance', '2027-06-04', 'c0000004-0000-0000-0000-000000000000', 'pending'),

  -- Surveillance 2
  ('Surveillance 2 — Chimak Healthcare',           'surveillance', '2027-08-22', 'c0000001-0000-0000-0000-000000000000', 'pending'),
  ('Surveillance 2 — Zeno Veda Health Remedies',   'surveillance', '2027-08-26', 'c0000002-0000-0000-0000-000000000000', 'pending'),
  ('Surveillance 2 — Chandigarh Agritech Pvt Ltd', 'surveillance', '2028-06-04', 'c0000003-0000-0000-0000-000000000000', 'pending'),
  ('Surveillance 2 — Anuttama Wellness Pvt Ltd',   'surveillance', '2028-06-04', 'c0000004-0000-0000-0000-000000000000', 'pending'),

  -- Recertification
  ('Recertification — Chimak Healthcare',           'recertification', '2028-08-22', 'c0000001-0000-0000-0000-000000000000', 'pending'),
  ('Recertification — Zeno Veda Health Remedies',   'recertification', '2028-08-26', 'c0000002-0000-0000-0000-000000000000', 'pending'),
  ('Recertification — Chandigarh Agritech Pvt Ltd', 'recertification', '2029-06-04', 'c0000003-0000-0000-0000-000000000000', 'pending'),
  ('Recertification — Anuttama Wellness Pvt Ltd',   'recertification', '2029-06-04', 'c0000004-0000-0000-0000-000000000000', 'pending');

-- ============================================================
-- POST-SETUP INSTRUCTIONS
-- ============================================================
-- After running this schema:
-- 1. Go to Supabase Auth > Users > Invite User
--    Email: tarun@tpsxperts.com
--    Metadata: {"full_name": "Tarun Pratap Singh", "role": "admin"}
-- 2. User will receive invite email, sets password
-- 3. Profile auto-created via handle_new_user() trigger
-- 4. Manually UPDATE auditors SET profile_id = <tarun_user_id>
--    WHERE full_name = 'Tarun Pratap Singh'
-- ============================================================
