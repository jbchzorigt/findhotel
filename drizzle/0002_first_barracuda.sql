CREATE TABLE "geo_rate_gate" (
	"service" text PRIMARY KEY NOT NULL,
	"last_called_at" timestamp with time zone DEFAULT now() NOT NULL
);
