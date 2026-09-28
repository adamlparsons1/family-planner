CREATE TYPE "public"."homework_kind" AS ENUM('weekly', 'one_off');--> statement-breakpoint
CREATE TYPE "public"."ledger_source" AS ENUM('chore', 'reward', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lunch_choice" AS ENUM('school', 'packed', 'none');--> statement-breakpoint
CREATE TYPE "public"."non_school_reason" AS ENUM('holiday', 'inset', 'sick', 'other');--> statement-breakpoint
CREATE TYPE "public"."part_of_day" AS ENUM('morning', 'evening');--> statement-breakpoint
CREATE TYPE "public"."person_role" AS ENUM('parent', 'child');--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"kind" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chore_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"chore_id" integer,
	"person_id" integer NOT NULL,
	"chore_title" text NOT NULL,
	"points_awarded" integer NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" integer,
	CONSTRAINT "chore_completions_chore_person_date" UNIQUE("chore_id","person_id","date")
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"person_id" integer,
	"points" integer DEFAULT 1 NOT NULL,
	"days_of_week" integer[],
	"requires_approval" boolean DEFAULT true NOT NULL,
	"one_per_day" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_people" (
	"event_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	CONSTRAINT "event_people_event_id_person_id_pk" PRIMARY KEY("event_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"date" date,
	"days_of_week" integer[],
	"starts_on" date,
	"ends_on" date,
	"start_time" time,
	"end_time" time,
	"location" text,
	"notes" text,
	"is_school_related" boolean DEFAULT false NOT NULL,
	CONSTRAINT "events_exactly_one_schedule_mode" CHECK (("events"."date" IS NOT NULL AND "events"."days_of_week" IS NULL)
       OR ("events"."date" IS NULL AND "events"."days_of_week" IS NOT NULL)),
	CONSTRAINT "events_end_after_start" CHECK ("events"."ends_on" IS NULL OR "events"."starts_on" IS NULL OR "events"."ends_on" >= "events"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "homework_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"kind" "homework_kind" NOT NULL,
	"target_per_week" integer,
	"unit_label" text,
	"due_date" date,
	"set_on" date NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homework_target_range" CHECK ("homework_items"."target_per_week" IS NULL OR "homework_items"."target_per_week" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE TABLE "lunch_choices" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"date" date NOT NULL,
	"choice" "lunch_choice" NOT NULL,
	"dish" text,
	CONSTRAINT "lunch_choices_person_date" UNIQUE("person_id","date")
);
--> statement-breakpoint
CREATE TABLE "lunch_defaults" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"choice" "lunch_choice" NOT NULL,
	CONSTRAINT "lunch_defaults_person_day" UNIQUE("person_id","day_of_week"),
	CONSTRAINT "lunch_defaults_day_range" CHECK ("lunch_defaults"."day_of_week" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"notes" text,
	CONSTRAINT "meals_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "non_school_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"reason" "non_school_reason" NOT NULL,
	"label" text,
	CONSTRAINT "non_school_days_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "person_role" NOT NULL,
	"colour" text NOT NULL,
	"icon" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_lunch_on_card" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"source_type" "ledger_source" NOT NULL,
	"source_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"cost_points" integer NOT NULL,
	"person_id" integer,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_completions_task_date" UNIQUE("task_id","date")
);
--> statement-breakpoint
CREATE TABLE "routine_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"part_of_day" "part_of_day" DEFAULT 'morning' NOT NULL,
	"category" text DEFAULT 'Morning' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"days_of_week" integer[] NOT NULL,
	"school_days_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"household_passcode_hash" text NOT NULL,
	"parent_pin_hash" text NOT NULL,
	"day_rollover_hour" integer DEFAULT 3 NOT NULL,
	"night_theme_from_hour" integer DEFAULT 19 NOT NULL,
	"homework_week_start_day" integer DEFAULT 4 NOT NULL,
	"session_secret" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_rollover_range" CHECK ("settings"."day_rollover_hour" BETWEEN 0 AND 23),
	CONSTRAINT "settings_homework_week_start_range" CHECK ("settings"."homework_week_start_day" BETWEEN 0 AND 6)
);
--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_approved_by_people_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_completions" ADD CONSTRAINT "homework_completions_item_id_homework_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."homework_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_completions" ADD CONSTRAINT "homework_completions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_choices" ADD CONSTRAINT "lunch_choices_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_defaults" ADD CONSTRAINT "lunch_defaults_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_completions" ADD CONSTRAINT "routine_completions_task_id_routine_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."routine_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_tasks" ADD CONSTRAINT "routine_tasks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;