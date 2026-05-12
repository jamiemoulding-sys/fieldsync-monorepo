drop extension if exists "pg_net";

create sequence "public"."activity_logs_id_seq";

create sequence "public"."announcements_id_seq";

create sequence "public"."holidays_id_seq";

create sequence "public"."locations_id_seq";

create sequence "public"."schedules_id_seq";

create sequence "public"."shifts_id_seq";

create sequence "public"."task_completions_id_seq";

create sequence "public"."tasks_id_seq";


  create table "public"."activity_logs" (
    "id" integer not null default nextval('public.activity_logs_id_seq'::regclass),
    "user_id" integer not null,
    "company_id" uuid not null,
    "action" text,
    "metadata" jsonb,
    "created_at" timestamp without time zone default now()
      );


alter table "public"."activity_logs" enable row level security;


  create table "public"."alerts" (
    "id" bigint generated always as identity not null,
    "company_id" uuid not null,
    "user_id" uuid,
    "shift_id" integer,
    "type" text,
    "message" text,
    "resolved" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."alerts" enable row level security;


  create table "public"."announcements" (
    "id" integer not null default nextval('public.announcements_id_seq'::regclass),
    "company_id" uuid not null,
    "title" text not null,
    "message" text not null,
    "priority" text default 'normal'::text,
    "created_by" integer,
    "created_at" timestamp without time zone default now(),
    "expires_at" timestamp without time zone
      );


alter table "public"."announcements" enable row level security;


  create table "public"."audit_logs" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "action" text,
    "entity" text,
    "entity_id" uuid,
    "payload" jsonb,
    "created_at" timestamp without time zone default now()
      );


alter table "public"."audit_logs" enable row level security;


  create table "public"."companies" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "owner_id" uuid,
    "created_at" timestamp without time zone default now(),
    "join_code" text,
    "stripe_customer_id" text,
    "stripe_subscription_id" text,
    "stripe_price_id" text,
    "subscription_status" text default 'inactive'::text,
    "plan" text default 'starter'::text,
    "employee_limit" integer default 5,
    "trial_ends_at" timestamp without time zone,
    "billing_cycle" text default 'monthly'::text,
    "is_pro" boolean default false,
    "current_plan" text,
    "trial_end" timestamp with time zone,
    "holiday_year_type" text default 'calendar'::text,
    "holiday_allowance" integer default 20
      );


alter table "public"."companies" enable row level security;


  create table "public"."holidays" (
    "id" integer not null default nextval('public.holidays_id_seq'::regclass),
    "user_id" uuid,
    "start_date" date not null,
    "end_date" date not null,
    "status" text default 'pending'::text,
    "created_at" timestamp without time zone default now(),
    "company_id" uuid,
    "type" text default 'annual'::text,
    "reason" text,
    "half_day" boolean default false,
    "approved_by" uuid,
    "approved_at" timestamp with time zone
      );


alter table "public"."holidays" enable row level security;


  create table "public"."invitations" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "email" text not null,
    "name" text,
    "role" text default 'employee'::text,
    "company_id" uuid,
    "token" text,
    "is_used" boolean default false,
    "created_at" timestamp without time zone default now()
      );


alter table "public"."invitations" enable row level security;


  create table "public"."locations" (
    "id" integer not null default nextval('public.locations_id_seq'::regclass),
    "name" text not null,
    "address" text,
    "latitude" double precision,
    "longitude" double precision,
    "radius" double precision default 100,
    "created_at" timestamp without time zone default now(),
    "company_id" uuid not null,
    "archived" boolean default false
      );


alter table "public"."locations" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "company_id" uuid not null,
    "user_id" uuid not null,
    "title" text not null,
    "message" text not null,
    "type" text default 'general'::text,
    "read" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."notifications" enable row level security;


  create table "public"."payroll_exports" (
    "id" bigint generated always as identity not null,
    "company_id" uuid not null,
    "exported_by" uuid,
    "file_name" text,
    "rows_count" integer default 0,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."payroll_exports" enable row level security;


  create table "public"."schedules" (
    "id" integer not null default nextval('public.schedules_id_seq'::regclass),
    "user_id" uuid,
    "date" date,
    "start_time" timestamp without time zone,
    "end_time" timestamp without time zone,
    "company_id" uuid,
    "allow_overtime" boolean default false,
    "unpaid_break" integer default 0,
    "notes" text,
    "shift_color" text,
    "location_id" uuid,
    "status" text default 'draft'::text,
    "locked" boolean default false,
    "payroll_exported" boolean default false
      );


alter table "public"."schedules" enable row level security;


  create table "public"."shift_route_logs" (
    "id" bigint generated always as identity not null,
    "shift_id" integer not null,
    "user_id" uuid not null,
    "company_id" uuid not null,
    "latitude" numeric,
    "longitude" numeric,
    "speed" numeric default 0,
    "accuracy" numeric default 0,
    "battery" numeric default 0,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."shift_route_logs" enable row level security;


  create table "public"."shift_routes" (
    "id" bigint generated always as identity not null,
    "shift_id" integer not null,
    "latitude" numeric,
    "longitude" numeric,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."shift_routes" enable row level security;


  create table "public"."shifts" (
    "id" integer not null default nextval('public.shifts_id_seq'::regclass),
    "user_id" uuid not null,
    "location_id" integer not null,
    "clock_in_time" timestamp with time zone default now(),
    "clock_out_time" timestamp with time zone,
    "created_at" timestamp without time zone default now(),
    "latitude" double precision,
    "longitude" double precision,
    "is_late" boolean default false,
    "company_id" uuid not null,
    "break_started_at" timestamp with time zone,
    "total_break_seconds" integer default 0,
    "active_job_id" integer,
    "miles_travelled" numeric default 0,
    "estimated_fuel_cost" numeric default 0,
    "payroll_exported" boolean default false,
    "device_type" text,
    "app_version" text,
    "shift_type" text,
    "total_hours" numeric default 0,
    "verified" boolean default false,
    "clock_in_lat" numeric,
    "clock_in_lng" numeric,
    "clock_out_lat" numeric,
    "clock_out_lng" numeric
      );



  create table "public"."task_completions" (
    "id" integer not null default nextval('public.task_completions_id_seq'::regclass),
    "task_id" integer,
    "user_id" integer,
    "shift_id" integer,
    "completed_at" timestamp without time zone default now()
      );


alter table "public"."task_completions" enable row level security;


  create table "public"."tasks" (
    "id" integer not null default nextval('public.tasks_id_seq'::regclass),
    "title" text not null,
    "description" text,
    "is_active" boolean default true,
    "created_at" timestamp without time zone default now(),
    "location_id" integer,
    "company_id" uuid not null,
    "created_by" uuid,
    "assigned_to" uuid,
    "due_date" date,
    "priority" text default 'normal'::text,
    "status" text default 'todo'::text,
    "completed" boolean default false,
    "completed_by" uuid,
    "completed_at" timestamp with time zone,
    "assigned_users" uuid[],
    "route_locations" jsonb default '[]'::jsonb,
    "claimed_by" uuid,
    "claimed_at" timestamp with time zone
      );


alter table "public"."tasks" enable row level security;


  create table "public"."users" (
    "id" uuid not null,
    "email" text not null,
    "created_at" timestamp with time zone default now(),
    "name" text,
    "role" text default 'employee'::text,
    "is_active" boolean default true,
    "company_id" uuid,
    "trial_ends_at" timestamp with time zone,
    "is_pro" boolean default false,
    "temp_role" character varying,
    "temp_role_expires" timestamp with time zone,
    "phone" text,
    "job_title" text,
    "hourly_rate" numeric(10,2),
    "overtime_rate" numeric(10,2),
    "night_rate" numeric(10,2),
    "contracted_hours" numeric(10,2),
    "employment_type" text,
    "department" text,
    "holiday_allowance" integer,
    "payroll_id" text,
    "emergency_contact" text,
    "start_date" date,
    "status" text default 'active'::text,
    "push_token" text,
    "device_name" text,
    "last_seen_at" timestamp with time zone,
    "install_status" text default 'web'::text
      );


alter table "public"."users" enable row level security;

alter sequence "public"."activity_logs_id_seq" owned by "public"."activity_logs"."id";

alter sequence "public"."announcements_id_seq" owned by "public"."announcements"."id";

alter sequence "public"."holidays_id_seq" owned by "public"."holidays"."id";

alter sequence "public"."locations_id_seq" owned by "public"."locations"."id";

alter sequence "public"."schedules_id_seq" owned by "public"."schedules"."id";

alter sequence "public"."shifts_id_seq" owned by "public"."shifts"."id";

alter sequence "public"."task_completions_id_seq" owned by "public"."task_completions"."id";

alter sequence "public"."tasks_id_seq" owned by "public"."tasks"."id";

CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id);

CREATE UNIQUE INDEX alerts_pkey ON public.alerts USING btree (id);

CREATE UNIQUE INDEX announcements_pkey ON public.announcements USING btree (id);

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX holidays_pkey ON public.holidays USING btree (id);

CREATE INDEX idx_holidays_user_id ON public.holidays USING btree (user_id);

CREATE INDEX idx_locations_company ON public.locations USING btree (company_id);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);

CREATE INDEX idx_route_company ON public.shift_route_logs USING btree (company_id);

CREATE INDEX idx_route_shift ON public.shift_route_logs USING btree (shift_id);

CREATE INDEX idx_schedules_user_id ON public.schedules USING btree (user_id);

CREATE INDEX idx_shifts_active_job ON public.shifts USING btree (active_job_id);

CREATE INDEX idx_shifts_company ON public.shifts USING btree (company_id);

CREATE INDEX idx_shifts_user_id ON public.shifts USING btree (user_id);

CREATE INDEX idx_tasks_claimed ON public.tasks USING btree (claimed_by);

CREATE INDEX idx_tasks_company ON public.tasks USING btree (company_id);

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);

CREATE INDEX idx_users_department ON public.users USING btree (department);

CREATE INDEX idx_users_employment_type ON public.users USING btree (employment_type);

CREATE INDEX idx_users_role ON public.users USING btree (role);

CREATE INDEX idx_users_status ON public.users USING btree (status);

CREATE UNIQUE INDEX invitations_pkey ON public.invitations USING btree (id);

CREATE UNIQUE INDEX invitations_token_key ON public.invitations USING btree (token);

CREATE UNIQUE INDEX locations_pkey ON public.locations USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX payroll_exports_pkey ON public.payroll_exports USING btree (id);

CREATE UNIQUE INDEX schedules_pkey ON public.schedules USING btree (id);

CREATE UNIQUE INDEX shift_route_logs_pkey ON public.shift_route_logs USING btree (id);

CREATE UNIQUE INDEX shift_routes_pkey ON public.shift_routes USING btree (id);

CREATE UNIQUE INDEX shifts_pkey ON public.shifts USING btree (id);

CREATE UNIQUE INDEX task_completions_pkey ON public.task_completions USING btree (id);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."activity_logs" add constraint "activity_logs_pkey" PRIMARY KEY using index "activity_logs_pkey";

alter table "public"."alerts" add constraint "alerts_pkey" PRIMARY KEY using index "alerts_pkey";

alter table "public"."announcements" add constraint "announcements_pkey" PRIMARY KEY using index "announcements_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."holidays" add constraint "holidays_pkey" PRIMARY KEY using index "holidays_pkey";

alter table "public"."invitations" add constraint "invitations_pkey" PRIMARY KEY using index "invitations_pkey";

alter table "public"."locations" add constraint "locations_pkey" PRIMARY KEY using index "locations_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."payroll_exports" add constraint "payroll_exports_pkey" PRIMARY KEY using index "payroll_exports_pkey";

alter table "public"."schedules" add constraint "schedules_pkey" PRIMARY KEY using index "schedules_pkey";

alter table "public"."shift_route_logs" add constraint "shift_route_logs_pkey" PRIMARY KEY using index "shift_route_logs_pkey";

alter table "public"."shift_routes" add constraint "shift_routes_pkey" PRIMARY KEY using index "shift_routes_pkey";

alter table "public"."shifts" add constraint "shifts_pkey" PRIMARY KEY using index "shifts_pkey";

alter table "public"."task_completions" add constraint "task_completions_pkey" PRIMARY KEY using index "task_completions_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."alerts" add constraint "alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."alerts" validate constraint "alerts_user_id_fkey";

alter table "public"."companies" add constraint "companies_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."companies" validate constraint "companies_owner_id_fkey";

alter table "public"."holidays" add constraint "holidays_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."holidays" validate constraint "holidays_user_id_fkey";

alter table "public"."invitations" add constraint "invitations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."invitations" validate constraint "invitations_company_id_fkey";

alter table "public"."invitations" add constraint "invitations_token_key" UNIQUE using index "invitations_token_key";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."schedules" add constraint "schedules_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."schedules" validate constraint "schedules_user_id_fkey";

alter table "public"."shift_routes" add constraint "shift_routes_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE CASCADE not valid;

alter table "public"."shift_routes" validate constraint "shift_routes_shift_id_fkey";

alter table "public"."shifts" add constraint "fk_location" FOREIGN KEY (location_id) REFERENCES public.locations(id) not valid;

alter table "public"."shifts" validate constraint "fk_location";

alter table "public"."shifts" add constraint "shifts_active_job_id_fkey" FOREIGN KEY (active_job_id) REFERENCES public.locations(id) ON DELETE SET NULL not valid;

alter table "public"."shifts" validate constraint "shifts_active_job_id_fkey";

alter table "public"."shifts" add constraint "shifts_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL not valid;

alter table "public"."shifts" validate constraint "shifts_location_id_fkey";

alter table "public"."shifts" add constraint "shifts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."shifts" validate constraint "shifts_user_id_fkey";

alter table "public"."task_completions" add constraint "task_completions_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES public.shifts(id) not valid;

alter table "public"."task_completions" validate constraint "task_completions_shift_id_fkey";

alter table "public"."task_completions" add constraint "task_completions_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) not valid;

alter table "public"."task_completions" validate constraint "task_completions_task_id_fkey";

alter table "public"."tasks" add constraint "tasks_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.locations(id) not valid;

alter table "public"."tasks" validate constraint "tasks_location_id_fkey";

alter table "public"."users" add constraint "users_company_id_fkey1" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."users" validate constraint "users_company_id_fkey1";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

alter table "public"."users" add constraint "users_employment_type_check" CHECK (((employment_type IS NULL) OR (employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'casual'::text, 'contractor'::text])))) not valid;

alter table "public"."users" validate constraint "users_employment_type_check";

alter table "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."users" validate constraint "users_id_fkey";

alter table "public"."users" add constraint "users_id_fkey1" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."users" validate constraint "users_id_fkey1";

alter table "public"."users" add constraint "users_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'leaver'::text]))) not valid;

alter table "public"."users" validate constraint "users_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_late_alert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.is_late = true then
    insert into public.alerts(
      company_id,
      user_id,
      shift_id,
      type,
      message
    )
    values(
      new.company_id,
      new.user_id,
      new.id,
      'late',
      'Employee clocked in late'
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select company_id
  from users
  where id = auth.uid()
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from users
  where id = auth.uid()
  limit 1;
$function$
;

create or replace view "public"."v_payroll_export" as  SELECT s.id,
    s.user_id,
    u.name,
    u.payroll_id,
    s.clock_in_time,
    s.clock_out_time,
    s.total_break_seconds,
    s.miles_travelled
   FROM (public.shifts s
     LEFT JOIN public.users u ON ((u.id = s.user_id)));


create or replace view "public"."v_shift_route_replay" as  SELECT r.shift_id,
    r.user_id,
    u.name,
    r.latitude,
    r.longitude,
    r.speed,
    r.created_at
   FROM (public.shift_route_logs r
     LEFT JOIN public.users u ON ((u.id = r.user_id)))
  ORDER BY r.created_at;


grant delete on table "public"."activity_logs" to "anon";

grant insert on table "public"."activity_logs" to "anon";

grant references on table "public"."activity_logs" to "anon";

grant select on table "public"."activity_logs" to "anon";

grant trigger on table "public"."activity_logs" to "anon";

grant truncate on table "public"."activity_logs" to "anon";

grant update on table "public"."activity_logs" to "anon";

grant delete on table "public"."activity_logs" to "authenticated";

grant insert on table "public"."activity_logs" to "authenticated";

grant references on table "public"."activity_logs" to "authenticated";

grant select on table "public"."activity_logs" to "authenticated";

grant trigger on table "public"."activity_logs" to "authenticated";

grant truncate on table "public"."activity_logs" to "authenticated";

grant update on table "public"."activity_logs" to "authenticated";

grant delete on table "public"."activity_logs" to "service_role";

grant insert on table "public"."activity_logs" to "service_role";

grant references on table "public"."activity_logs" to "service_role";

grant select on table "public"."activity_logs" to "service_role";

grant trigger on table "public"."activity_logs" to "service_role";

grant truncate on table "public"."activity_logs" to "service_role";

grant update on table "public"."activity_logs" to "service_role";

grant delete on table "public"."alerts" to "anon";

grant insert on table "public"."alerts" to "anon";

grant references on table "public"."alerts" to "anon";

grant select on table "public"."alerts" to "anon";

grant trigger on table "public"."alerts" to "anon";

grant truncate on table "public"."alerts" to "anon";

grant update on table "public"."alerts" to "anon";

grant delete on table "public"."alerts" to "authenticated";

grant insert on table "public"."alerts" to "authenticated";

grant references on table "public"."alerts" to "authenticated";

grant select on table "public"."alerts" to "authenticated";

grant trigger on table "public"."alerts" to "authenticated";

grant truncate on table "public"."alerts" to "authenticated";

grant update on table "public"."alerts" to "authenticated";

grant delete on table "public"."alerts" to "service_role";

grant insert on table "public"."alerts" to "service_role";

grant references on table "public"."alerts" to "service_role";

grant select on table "public"."alerts" to "service_role";

grant trigger on table "public"."alerts" to "service_role";

grant truncate on table "public"."alerts" to "service_role";

grant update on table "public"."alerts" to "service_role";

grant delete on table "public"."announcements" to "anon";

grant insert on table "public"."announcements" to "anon";

grant references on table "public"."announcements" to "anon";

grant select on table "public"."announcements" to "anon";

grant trigger on table "public"."announcements" to "anon";

grant truncate on table "public"."announcements" to "anon";

grant update on table "public"."announcements" to "anon";

grant delete on table "public"."announcements" to "authenticated";

grant insert on table "public"."announcements" to "authenticated";

grant references on table "public"."announcements" to "authenticated";

grant select on table "public"."announcements" to "authenticated";

grant trigger on table "public"."announcements" to "authenticated";

grant truncate on table "public"."announcements" to "authenticated";

grant update on table "public"."announcements" to "authenticated";

grant delete on table "public"."announcements" to "service_role";

grant insert on table "public"."announcements" to "service_role";

grant references on table "public"."announcements" to "service_role";

grant select on table "public"."announcements" to "service_role";

grant trigger on table "public"."announcements" to "service_role";

grant truncate on table "public"."announcements" to "service_role";

grant update on table "public"."announcements" to "service_role";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."holidays" to "authenticated";

grant insert on table "public"."holidays" to "authenticated";

grant references on table "public"."holidays" to "authenticated";

grant select on table "public"."holidays" to "authenticated";

grant trigger on table "public"."holidays" to "authenticated";

grant truncate on table "public"."holidays" to "authenticated";

grant update on table "public"."holidays" to "authenticated";

grant delete on table "public"."holidays" to "service_role";

grant insert on table "public"."holidays" to "service_role";

grant references on table "public"."holidays" to "service_role";

grant select on table "public"."holidays" to "service_role";

grant trigger on table "public"."holidays" to "service_role";

grant truncate on table "public"."holidays" to "service_role";

grant update on table "public"."holidays" to "service_role";

grant delete on table "public"."invitations" to "anon";

grant insert on table "public"."invitations" to "anon";

grant references on table "public"."invitations" to "anon";

grant select on table "public"."invitations" to "anon";

grant trigger on table "public"."invitations" to "anon";

grant truncate on table "public"."invitations" to "anon";

grant update on table "public"."invitations" to "anon";

grant delete on table "public"."invitations" to "authenticated";

grant insert on table "public"."invitations" to "authenticated";

grant references on table "public"."invitations" to "authenticated";

grant select on table "public"."invitations" to "authenticated";

grant trigger on table "public"."invitations" to "authenticated";

grant truncate on table "public"."invitations" to "authenticated";

grant update on table "public"."invitations" to "authenticated";

grant delete on table "public"."invitations" to "service_role";

grant insert on table "public"."invitations" to "service_role";

grant references on table "public"."invitations" to "service_role";

grant select on table "public"."invitations" to "service_role";

grant trigger on table "public"."invitations" to "service_role";

grant truncate on table "public"."invitations" to "service_role";

grant update on table "public"."invitations" to "service_role";

grant delete on table "public"."locations" to "authenticated";

grant insert on table "public"."locations" to "authenticated";

grant references on table "public"."locations" to "authenticated";

grant select on table "public"."locations" to "authenticated";

grant trigger on table "public"."locations" to "authenticated";

grant truncate on table "public"."locations" to "authenticated";

grant update on table "public"."locations" to "authenticated";

grant delete on table "public"."locations" to "service_role";

grant insert on table "public"."locations" to "service_role";

grant references on table "public"."locations" to "service_role";

grant select on table "public"."locations" to "service_role";

grant trigger on table "public"."locations" to "service_role";

grant truncate on table "public"."locations" to "service_role";

grant update on table "public"."locations" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."payroll_exports" to "anon";

grant insert on table "public"."payroll_exports" to "anon";

grant references on table "public"."payroll_exports" to "anon";

grant select on table "public"."payroll_exports" to "anon";

grant trigger on table "public"."payroll_exports" to "anon";

grant truncate on table "public"."payroll_exports" to "anon";

grant update on table "public"."payroll_exports" to "anon";

grant delete on table "public"."payroll_exports" to "authenticated";

grant insert on table "public"."payroll_exports" to "authenticated";

grant references on table "public"."payroll_exports" to "authenticated";

grant select on table "public"."payroll_exports" to "authenticated";

grant trigger on table "public"."payroll_exports" to "authenticated";

grant truncate on table "public"."payroll_exports" to "authenticated";

grant update on table "public"."payroll_exports" to "authenticated";

grant delete on table "public"."payroll_exports" to "service_role";

grant insert on table "public"."payroll_exports" to "service_role";

grant references on table "public"."payroll_exports" to "service_role";

grant select on table "public"."payroll_exports" to "service_role";

grant trigger on table "public"."payroll_exports" to "service_role";

grant truncate on table "public"."payroll_exports" to "service_role";

grant update on table "public"."payroll_exports" to "service_role";

grant delete on table "public"."schedules" to "authenticated";

grant insert on table "public"."schedules" to "authenticated";

grant references on table "public"."schedules" to "authenticated";

grant select on table "public"."schedules" to "authenticated";

grant trigger on table "public"."schedules" to "authenticated";

grant truncate on table "public"."schedules" to "authenticated";

grant update on table "public"."schedules" to "authenticated";

grant delete on table "public"."schedules" to "service_role";

grant insert on table "public"."schedules" to "service_role";

grant references on table "public"."schedules" to "service_role";

grant select on table "public"."schedules" to "service_role";

grant trigger on table "public"."schedules" to "service_role";

grant truncate on table "public"."schedules" to "service_role";

grant update on table "public"."schedules" to "service_role";

grant delete on table "public"."shift_route_logs" to "anon";

grant insert on table "public"."shift_route_logs" to "anon";

grant references on table "public"."shift_route_logs" to "anon";

grant select on table "public"."shift_route_logs" to "anon";

grant trigger on table "public"."shift_route_logs" to "anon";

grant truncate on table "public"."shift_route_logs" to "anon";

grant update on table "public"."shift_route_logs" to "anon";

grant delete on table "public"."shift_route_logs" to "authenticated";

grant insert on table "public"."shift_route_logs" to "authenticated";

grant references on table "public"."shift_route_logs" to "authenticated";

grant select on table "public"."shift_route_logs" to "authenticated";

grant trigger on table "public"."shift_route_logs" to "authenticated";

grant truncate on table "public"."shift_route_logs" to "authenticated";

grant update on table "public"."shift_route_logs" to "authenticated";

grant delete on table "public"."shift_route_logs" to "service_role";

grant insert on table "public"."shift_route_logs" to "service_role";

grant references on table "public"."shift_route_logs" to "service_role";

grant select on table "public"."shift_route_logs" to "service_role";

grant trigger on table "public"."shift_route_logs" to "service_role";

grant truncate on table "public"."shift_route_logs" to "service_role";

grant update on table "public"."shift_route_logs" to "service_role";

grant delete on table "public"."shift_routes" to "anon";

grant insert on table "public"."shift_routes" to "anon";

grant references on table "public"."shift_routes" to "anon";

grant select on table "public"."shift_routes" to "anon";

grant trigger on table "public"."shift_routes" to "anon";

grant truncate on table "public"."shift_routes" to "anon";

grant update on table "public"."shift_routes" to "anon";

grant delete on table "public"."shift_routes" to "authenticated";

grant insert on table "public"."shift_routes" to "authenticated";

grant references on table "public"."shift_routes" to "authenticated";

grant select on table "public"."shift_routes" to "authenticated";

grant trigger on table "public"."shift_routes" to "authenticated";

grant truncate on table "public"."shift_routes" to "authenticated";

grant update on table "public"."shift_routes" to "authenticated";

grant delete on table "public"."shift_routes" to "service_role";

grant insert on table "public"."shift_routes" to "service_role";

grant references on table "public"."shift_routes" to "service_role";

grant select on table "public"."shift_routes" to "service_role";

grant trigger on table "public"."shift_routes" to "service_role";

grant truncate on table "public"."shift_routes" to "service_role";

grant update on table "public"."shift_routes" to "service_role";

grant delete on table "public"."shifts" to "authenticated";

grant insert on table "public"."shifts" to "authenticated";

grant references on table "public"."shifts" to "authenticated";

grant select on table "public"."shifts" to "authenticated";

grant trigger on table "public"."shifts" to "authenticated";

grant truncate on table "public"."shifts" to "authenticated";

grant update on table "public"."shifts" to "authenticated";

grant delete on table "public"."shifts" to "service_role";

grant insert on table "public"."shifts" to "service_role";

grant references on table "public"."shifts" to "service_role";

grant select on table "public"."shifts" to "service_role";

grant trigger on table "public"."shifts" to "service_role";

grant truncate on table "public"."shifts" to "service_role";

grant update on table "public"."shifts" to "service_role";

grant delete on table "public"."task_completions" to "anon";

grant insert on table "public"."task_completions" to "anon";

grant references on table "public"."task_completions" to "anon";

grant select on table "public"."task_completions" to "anon";

grant trigger on table "public"."task_completions" to "anon";

grant truncate on table "public"."task_completions" to "anon";

grant update on table "public"."task_completions" to "anon";

grant delete on table "public"."task_completions" to "authenticated";

grant insert on table "public"."task_completions" to "authenticated";

grant references on table "public"."task_completions" to "authenticated";

grant select on table "public"."task_completions" to "authenticated";

grant trigger on table "public"."task_completions" to "authenticated";

grant truncate on table "public"."task_completions" to "authenticated";

grant update on table "public"."task_completions" to "authenticated";

grant delete on table "public"."task_completions" to "service_role";

grant insert on table "public"."task_completions" to "service_role";

grant references on table "public"."task_completions" to "service_role";

grant select on table "public"."task_completions" to "service_role";

grant trigger on table "public"."task_completions" to "service_role";

grant truncate on table "public"."task_completions" to "service_role";

grant update on table "public"."task_completions" to "service_role";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "activity_logs_insert"
  on "public"."activity_logs"
  as permissive
  for insert
  to authenticated
with check ((company_id = public.my_company_id()));



  create policy "activity_logs_select"
  on "public"."activity_logs"
  as permissive
  for select
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "alerts company read"
  on "public"."alerts"
  as permissive
  for select
  to public
using ((company_id IN ( SELECT users.company_id
   FROM public.users
  WHERE (users.id = auth.uid()))));



  create policy "announcements_delete"
  on "public"."announcements"
  as permissive
  for delete
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "announcements_insert"
  on "public"."announcements"
  as permissive
  for insert
  to authenticated
with check (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "announcements_select"
  on "public"."announcements"
  as permissive
  for select
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "companies_insert_signup"
  on "public"."companies"
  as permissive
  for insert
  to authenticated
with check ((owner_id = auth.uid()));



  create policy "companies_select_own"
  on "public"."companies"
  as permissive
  for select
  to authenticated
using (((owner_id = auth.uid()) OR (id = ( SELECT users.company_id
   FROM public.users
  WHERE (users.id = auth.uid())
 LIMIT 1))));



  create policy "companies_update_admin"
  on "public"."companies"
  as permissive
  for update
  to authenticated
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()));



  create policy "signup_insert_company"
  on "public"."companies"
  as permissive
  for insert
  to authenticated
with check ((owner_id = auth.uid()));



  create policy "holidays_delete"
  on "public"."holidays"
  as permissive
  for delete
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "holidays_insert"
  on "public"."holidays"
  as permissive
  for insert
  to authenticated
with check ((company_id = public.my_company_id()));



  create policy "holidays_select"
  on "public"."holidays"
  as permissive
  for select
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "holidays_update"
  on "public"."holidays"
  as permissive
  for update
  to authenticated
using (((company_id = public.my_company_id()) AND ((user_id = auth.uid()) OR (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text])))))
with check ((company_id = public.my_company_id()));



  create policy "invitations_insert"
  on "public"."invitations"
  as permissive
  for insert
  to authenticated
with check (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "invitations_select"
  on "public"."invitations"
  as permissive
  for select
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "invitations_update"
  on "public"."invitations"
  as permissive
  for update
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "Users can view company locations"
  on "public"."locations"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "allow read"
  on "public"."locations"
  as permissive
  for select
  to public
using (true);



  create policy "locations_delete"
  on "public"."locations"
  as permissive
  for delete
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "locations_insert"
  on "public"."locations"
  as permissive
  for insert
  to authenticated
with check (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "locations_select"
  on "public"."locations"
  as permissive
  for select
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "locations_update"
  on "public"."locations"
  as permissive
  for update
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))))
with check ((company_id = public.my_company_id()));



  create policy "Users can delete own notifications"
  on "public"."notifications"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert notifications"
  on "public"."notifications"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can update own notifications"
  on "public"."notifications"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own notifications"
  on "public"."notifications"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "notifications own read"
  on "public"."notifications"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "schedules_delete"
  on "public"."schedules"
  as permissive
  for delete
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "schedules_insert"
  on "public"."schedules"
  as permissive
  for insert
  to authenticated
with check (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "schedules_select"
  on "public"."schedules"
  as permissive
  for select
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "schedules_update"
  on "public"."schedules"
  as permissive
  for update
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))))
with check ((company_id = public.my_company_id()));



  create policy "route company read"
  on "public"."shift_route_logs"
  as permissive
  for select
  to public
using ((company_id IN ( SELECT users.company_id
   FROM public.users
  WHERE (users.id = auth.uid()))));



  create policy "Users can insert shifts"
  on "public"."shifts"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their shifts"
  on "public"."shifts"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their shifts"
  on "public"."shifts"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "shifts_delete"
  on "public"."shifts"
  as permissive
  for delete
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = 'admin'::text)));



  create policy "shifts_insert"
  on "public"."shifts"
  as permissive
  for insert
  to authenticated
with check (((company_id = public.my_company_id()) AND (user_id = auth.uid())));



  create policy "shifts_select"
  on "public"."shifts"
  as permissive
  for select
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "shifts_update"
  on "public"."shifts"
  as permissive
  for update
  to authenticated
using (((company_id = public.my_company_id()) AND ((user_id = auth.uid()) OR (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text])))))
with check ((company_id = public.my_company_id()));



  create policy "task_completions_insert"
  on "public"."task_completions"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "task_completions_select"
  on "public"."task_completions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "allow all"
  on "public"."tasks"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "allow read"
  on "public"."tasks"
  as permissive
  for select
  to public
using (true);



  create policy "tasks_delete"
  on "public"."tasks"
  as permissive
  for delete
  to authenticated
using (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "tasks_insert"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
with check (((company_id = public.my_company_id()) AND (public.my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))));



  create policy "tasks_select"
  on "public"."tasks"
  as permissive
  for select
  to authenticated
using ((company_id = public.my_company_id()));



  create policy "tasks_update"
  on "public"."tasks"
  as permissive
  for update
  to authenticated
using ((company_id = public.my_company_id()))
with check ((company_id = public.my_company_id()));



  create policy "allow read"
  on "public"."users"
  as permissive
  for select
  to public
using (true);



  create policy "users_delete"
  on "public"."users"
  as permissive
  for delete
  to authenticated
using (((public.my_role() = 'admin'::text) AND (company_id = public.my_company_id())));



  create policy "users_insert_own_profile"
  on "public"."users"
  as permissive
  for insert
  to authenticated
with check ((id = auth.uid()));



  create policy "users_select_company"
  on "public"."users"
  as permissive
  for select
  to authenticated
using (((id = auth.uid()) OR (company_id = public.my_company_id())));



  create policy "users_update"
  on "public"."users"
  as permissive
  for update
  to authenticated
using (((id = auth.uid()) OR (public.my_role() = 'admin'::text)))
with check ((company_id = public.my_company_id()));


CREATE TRIGGER trg_shift_late_alert AFTER INSERT ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.create_late_alert();


