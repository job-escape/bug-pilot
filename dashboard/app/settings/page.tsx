"use server";

import { redirect } from "next/navigation";
import { getSettings, saveSettings } from "@/lib/db";
import Link from "next/link";

export default async function SettingsPage() {
  const settings = await getSettings().catch(() => ({} as Record<string, string>));

  async function save(formData: FormData) {
    "use server";
    await saveSettings({
      trigger_emoji: (formData.get("trigger_emoji") as string) || "robot_face",
      allowed_user_id: (formData.get("allowed_user_id") as string) || "",
      allowed_channels: (formData.get("allowed_channels") as string) || "",
      dashboard_url: (formData.get("dashboard_url") as string) || "",
    });
    redirect("/settings");
  }

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <nav style={{ marginBottom: "2.5rem" }}>
        <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.05em" }}>
          ← repos
        </Link>
      </nav>

      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2rem", fontWeight: 900, color: "var(--text)", marginBottom: "2rem", lineHeight: 1 }}>
        Global Settings
      </h1>

      <form action={save} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Field
          name="trigger_emoji"
          label="Trigger Emoji"
          defaultValue={settings.trigger_emoji || "robot_face"}
          hint="Slack emoji name (without colons) that triggers the bot"
        />
        <Field
          name="allowed_user_id"
          label="Allowed Slack User ID"
          defaultValue={settings.allowed_user_id || ""}
          placeholder="U0ACB9MBHBK"
          hint="Only this user can trigger the bot. Leave empty to allow anyone."
        />
        <Field
          name="allowed_channels"
          label="Allowed Channel IDs"
          defaultValue={settings.allowed_channels || ""}
          placeholder="C0B16C99GPQ,C1234567890"
          hint="Comma-separated channel IDs the bot listens to. Leave empty for all channels."
        />
        <Field
          name="dashboard_url"
          label="Dashboard URL"
          defaultValue={settings.dashboard_url || ""}
          placeholder="https://bug-pilot.yourcompany.com"
          hint='Used in Slack replies as "View on Dashboard" link. Leave empty for localhost.'
        />

        <button
          type="submit"
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: "13px", fontWeight: 500,
            background: "var(--accent)", color: "#000", border: "none",
            borderRadius: "8px", padding: "0.75rem 1.5rem", cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Save settings →
        </button>
      </form>
    </main>
  );
}

function Field({ name, label, defaultValue, placeholder, hint }: {
  name: string; label: string; defaultValue?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.375rem" }}>
        {label}
      </label>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={{
          width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "13px",
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--text)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box",
        }}
      />
      {hint && (
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-dim)", marginTop: "0.375rem" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
