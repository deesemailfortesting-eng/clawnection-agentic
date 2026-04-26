import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { RomanticProfile } from "@/lib/types/matching";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).DB;
  const profile: RomanticProfile = await req.json();

  await db
    .prepare(
      `INSERT OR REPLACE INTO profiles (
        id, name, age, gender_identity, looking_for, location,
        relationship_intent, bio, interests, profile_values,
        communication_style, lifestyle_habits, dealbreakers,
        ideal_first_date, preference_age_min, preference_age_max,
        preference_notes, agent_type, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    )
    .bind(
      profile.id,
      profile.name,
      profile.age,
      profile.genderIdentity,
      profile.lookingFor,
      profile.location,
      profile.relationshipIntent,
      profile.bio,
      JSON.stringify(profile.interests),
      JSON.stringify(profile.values),
      profile.communicationStyle,
      JSON.stringify(profile.lifestyleHabits),
      JSON.stringify(profile.dealbreakers),
      profile.idealFirstDate,
      profile.preferenceAgeRange.min,
      profile.preferenceAgeRange.max,
      profile.preferenceNotes,
      profile.agentType,
    )
    .run();

  return NextResponse.json({ ok: true, id: profile.id });
}

export async function GET(req: NextRequest) {
  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).DB;
  const id = req.nextUrl.searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const row = await db.prepare("SELECT * FROM profiles WHERE id = ?").bind(id).first();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(rowToProfile(row));
}

function rowToProfile(row: Record<string, unknown>): RomanticProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    age: row.age as number,
    genderIdentity: row.gender_identity as string,
    lookingFor: row.looking_for as string,
    location: row.location as string,
    relationshipIntent: row.relationship_intent as RomanticProfile["relationshipIntent"],
    bio: row.bio as string,
    interests: JSON.parse((row.interests as string) || "[]"),
    values: JSON.parse((row.profile_values as string) || "[]"),
    communicationStyle: row.communication_style as RomanticProfile["communicationStyle"],
    lifestyleHabits: JSON.parse((row.lifestyle_habits as string) || "{}"),
    dealbreakers: JSON.parse((row.dealbreakers as string) || "[]"),
    idealFirstDate: row.ideal_first_date as string,
    preferenceAgeRange: {
      min: row.preference_age_min as number,
      max: row.preference_age_max as number,
    },
    preferenceNotes: row.preference_notes as string,
    agentType: row.agent_type as RomanticProfile["agentType"],
  };
}
