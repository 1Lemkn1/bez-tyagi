import { pgTable, serial, timestamp, text, integer } from "drizzle-orm/pg-core";

export const cravingEntries = pgTable("craving_entries", {
  id: serial("id").primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: false }).notNull(),
  place: text("place"),
  beforeCraving: text("before_craving"),
  feeling: text("feeling"),
  intensity: integer("intensity").notNull(),
  alternativeAction: text("alternative_action"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});
