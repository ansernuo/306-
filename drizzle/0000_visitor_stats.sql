CREATE TABLE site_visitors (
  visitor_id TEXT PRIMARY KEY NOT NULL,
  first_seen TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE site_visitor_days (
  day TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  PRIMARY KEY (day, visitor_id)
);
