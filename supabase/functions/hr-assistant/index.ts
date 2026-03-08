import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch user context for personalized answers
    let userContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 8) + "01";

      const [profileRes, attendanceRes, leaveBalRes, leaveReqRes, todayAttRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, department, designation, date_of_joining, employee_code")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("attendance")
            .select("date, status, check_in_time, check_out_time")
            .eq("user_id", userId)
            .gte("date", monthStart)
            .lte("date", today),
          supabase
            .from("leave_balances")
            .select("leave_type, opening_balance, used, accrued, carry_forward")
            .eq("user_id", userId)
            .eq("year", new Date().getFullYear()),
          supabase
            .from("leave_requests")
            .select("leave_type, start_date, end_date, status, reason")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("attendance")
            .select("check_in_time, check_out_time, status")
            .eq("user_id", userId)
            .eq("date", today)
            .maybeSingle(),
        ]);

      const profile = profileRes.data;
      const attendance = attendanceRes.data || [];
      const leaveBalances = leaveBalRes.data || [];
      const recentLeaves = leaveReqRes.data || [];
      const todayAtt = todayAttRes.data;

      const presentDays = attendance.filter((a: any) => a.status === "present").length;

      userContext = `
## Employee Context (use this to answer questions accurately)
- Name: ${profile?.full_name || "Unknown"}
- Department: ${profile?.department || "Not set"}
- Designation: ${profile?.designation || "Not set"}
- Employee Code: ${profile?.employee_code || "Not set"}
- Date of Joining: ${profile?.date_of_joining || "Not set"}
- Today's Date: ${today}

### This Month's Attendance
- Present Days: ${presentDays}
- Total Records: ${attendance.length}
- Today: ${todayAtt ? `Checked in at ${todayAtt.check_in_time || "N/A"}, Checked out at ${todayAtt.check_out_time || "Not yet"}` : "No attendance record yet"}

### Leave Balances (${new Date().getFullYear()})
${leaveBalances.length > 0 ? leaveBalances.map((lb: any) => `- ${lb.leave_type}: Opening=${lb.opening_balance}, Used=${lb.used}, Accrued=${lb.accrued}, Carry Forward=${lb.carry_forward}, Available=${lb.opening_balance + lb.accrued + lb.carry_forward - lb.used}`).join("\n") : "No leave balances found"}

### Recent Leave Requests
${recentLeaves.length > 0 ? recentLeaves.map((lr: any) => `- ${lr.leave_type}: ${lr.start_date} to ${lr.end_date} (${lr.status})`).join("\n") : "No recent leave requests"}
`;
    } catch (e) {
      console.error("Error fetching user context:", e);
    }

    const systemPrompt = `You are **HR Buddy**, an intelligent and friendly HR assistant for AttendanceHub — an employee management platform.

${userContext}

## Your Capabilities
- Answer questions about attendance, leaves, payroll, company policies
- Help employees understand their leave balances and attendance records
- Provide guidance on HR processes (applying for leave, checking in, etc.)
- Give tips on workplace productivity and well-being

## Rules
- Be concise, helpful, and professional but friendly
- Use emojis sparingly to keep things engaging 😊
- If you don't have specific data, say so honestly
- Never make up numbers — only use the data provided in the context
- For actions (like applying for leave), guide them to the appropriate page in the app
- Keep responses short (2-4 sentences) unless the user asks for detail
- Format responses with markdown for readability`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service requires additional credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("hr-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
