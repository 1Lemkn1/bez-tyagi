import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cravingEntries } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(cravingEntries)
    .orderBy(desc(cravingEntries.occurredAt))
    .limit(50);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      occurredAt,
      place,
      beforeCraving,
      feeling,
      intensity,
      alternativeAction,
    } = body ?? {};

    if (!occurredAt || typeof intensity !== "number") {
      return NextResponse.json(
        { error: "occurredAt and intensity are required" },
        { status: 400 }
      );
    }

    const occurredDate = new Date(occurredAt);
    if (Number.isNaN(occurredDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid occurredAt datetime" },
        { status: 400 }
      );
    }

    const intensityNumber = Math.min(10, Math.max(1, Math.round(intensity)));

    const [inserted] = await db
      .insert(cravingEntries)
      .values({
        occurredAt: occurredDate,
        place: place || null,
        beforeCraving: beforeCraving || null,
        feeling: feeling || null,
        intensity: intensityNumber,
        alternativeAction: alternativeAction || null,
      })
      .returning();

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save craving entry" },
      { status: 500 }
    );
  }
}
