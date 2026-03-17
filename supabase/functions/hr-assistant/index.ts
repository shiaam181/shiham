import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tool definitions for smart actions
const tools = [
  {
    type: "function",
    function: {
      name: "apply_leave",
      description: "Apply for leave on behalf of the employee. Use when employee wants to apply for leave.",
      parameters: {
        type: "object",
        properties: {
          leave_type: { type: "string", enum: ["casual", "sick", "earned", "unpaid"], description: "Type of leave" },
          start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
          end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
          reason: { type: "string", description: "Reason for leave" },
        },
        required: ["leave_type", "start_date", "end_date", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payslip_details",
      description: "Fetch the employee's payslip/salary details for a specific month to explain deductions and earnings.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number", description: "Month number (1-12)" },
          year: { type: "number", description: "Year (e.g. 2026)" },
        },
        required: ["month", "year"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_status",
      description: "Get team attendance and leave status for today. Only works for managers.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_regularization",
      description: "Submit an attendance regularization request for a specific date.",
      parameters: {
        type: "object",
        properties: {
          attendance_date: { type: "string", description: "The date to regularize in YYYY-MM-DD format" },
          reason: { type: "string", description: "Reason for regularization" },
          requested_check_in: { type: "string", description: "Requested check-in time in HH:MM format (24hr)" },
          requested_check_out: { type: "string", description: "Requested check-out time in HH:MM format (24hr)" },
        },
        required: ["attendance_date", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tax_saving_tips",
      description: "Provide personalized tax saving suggestions based on the employee's salary structure.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_company_policies",
      description: "Search company policies, rules, and guidelines to answer factual HR questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query (e.g., 'leave policy', 'WFH guidelines')" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_team_reminder",
      description: "Send a direct system notification to a specific user (only for managers/HR).",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string", description: "The UUID of the user to notify" },
          title: { type: "string", description: "Short title for the notification" },
          message: { type: "string", description: "The message to send" },
        },
        required: ["target_user_id", "title", "message"],
        additionalProperties: false,
      },
    },
  },
];

// Execute tool calls
async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  supabase: any
): Promise<string> {
  switch (toolName) {
    case "apply_leave": {
      const { leave_type, start_date, end_date, reason } = args;
      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          user_id: userId,
          leave_type,
          start_date,
          end_date,
          reason,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) return JSON.stringify({ success: false, error: error.message });
      return JSON.stringify({ success: true, leave_id: data.id, message: `Leave request submitted (${leave_type}: ${start_date} to ${end_date}). Status: Pending approval.` });
    }

    case "get_payslip_details": {
      const { month, year } = args;
      const { data: payroll } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("user_id", userId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (!payroll) return JSON.stringify({ found: false, message: `No payslip found for ${month}/${year}` });

      const { data: statutory } = await supabase
        .from("statutory_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      return JSON.stringify({
        found: true,
        earnings: {
          basic_salary: payroll.basic_salary,
          hra: payroll.hra,
          special_allowance: payroll.special_allowance,
          other_allowances: payroll.other_allowances,
          gross_salary: payroll.gross_salary,
        },
        deductions: {
          pf_employee: payroll.pf_employee,
          esi_employee: payroll.esi_employee,
          professional_tax: payroll.professional_tax,
          tds: payroll.tds,
          total_deductions: payroll.total_deductions,
          other_deductions: payroll.other_deductions_detail,
        },
        net_salary: payroll.net_salary,
        working_days: payroll.working_days,
        present_days: payroll.present_days,
        lop_days: payroll.lop_days,
        status: payroll.status,
        statutory_info: statutory ? {
          pf_applicable: statutory.pf_applicable,
          pf_wage_ceiling: statutory.pf_wage_ceiling,
          esi_applicable: statutory.esi_applicable,
          esi_wage_ceiling: statutory.esi_wage_ceiling,
          pt_applicable: statutory.pt_applicable,
          pt_state: statutory.pt_state,
        } : null,
      });
    }

    case "get_team_status": {
      const date = args.date || new Date().toISOString().split("T")[0];

      // Get employees managed by this user
      const { data: teamMembers } = await supabase
        .from("profiles")
        .select("user_id, full_name, department, designation")
        .eq("manager_id", userId);

      if (!teamMembers || teamMembers.length === 0) {
        return JSON.stringify({ is_manager: false, message: "You don't have any team members assigned." });
      }

      const teamIds = teamMembers.map((m: any) => m.user_id);

      const [attendanceRes, leaveRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("user_id, status, check_in_time, check_out_time")
          .in("user_id", teamIds)
          .eq("date", date),
        supabase
          .from("leave_requests")
          .select("user_id, leave_type, status")
          .in("user_id", teamIds)
          .lte("start_date", date)
          .gte("end_date", date)
          .eq("status", "approved"),
      ]);

      const attendance = attendanceRes.data || [];
      const leaves = leaveRes.data || [];

      const teamStatus = teamMembers.map((member: any) => {
        const att = attendance.find((a: any) => a.user_id === member.user_id);
        const leave = leaves.find((l: any) => l.user_id === member.user_id);
        return {
          name: member.full_name,
          department: member.department,
          status: leave ? `On ${leave.leave_type} leave` : att ? att.status : "No record",
          check_in: att?.check_in_time || null,
        };
      });

      const presentCount = teamStatus.filter((t: any) => t.status === "present").length;
      const onLeaveCount = teamStatus.filter((t: any) => t.status.includes("leave")).length;

      return JSON.stringify({
        is_manager: true,
        date,
        total_team: teamMembers.length,
        present: presentCount,
        on_leave: onLeaveCount,
        absent: teamMembers.length - presentCount - onLeaveCount,
        details: teamStatus,
      });
    }

    case "submit_regularization": {
      const { attendance_date, reason, requested_check_in, requested_check_out } = args;

      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      const insertData: any = {
        user_id: userId,
        attendance_date,
        reason,
        status: "pending",
        company_id: profile?.company_id || null,
      };

      if (requested_check_in) {
        insertData.requested_check_in = `${attendance_date}T${requested_check_in}:00`;
      }
      if (requested_check_out) {
        insertData.requested_check_out = `${attendance_date}T${requested_check_out}:00`;
      }

      const { data, error } = await supabase
        .from("regularization_requests")
        .insert(insertData)
        .select("id")
        .single();

      if (error) return JSON.stringify({ success: false, error: error.message });
      return JSON.stringify({ success: true, request_id: data.id, message: `Regularization request submitted for ${attendance_date}. Status: Pending approval.` });
    }

    case "get_tax_saving_tips": {
      const { data: salary } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      const { data: statutory } = await supabase
        .from("statutory_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const gross = salary
        ? (salary.basic_salary || 0) + (salary.hra || 0) + (salary.special_allowance || 0) + (salary.other_allowances || 0)
        : 0;

      return JSON.stringify({
        salary_found: !!salary,
        basic_salary: salary?.basic_salary || 0,
        hra: salary?.hra || 0,
        annual_gross: gross * 12,
        pf_applicable: statutory?.pf_applicable || false,
        annual_pf_contribution: statutory?.pf_applicable ? Math.min(salary?.basic_salary || 0, statutory?.pf_wage_ceiling || 15000) * 0.12 * 12 : 0,
        esi_applicable: statutory?.esi_applicable || false,
        tips: [
          "Section 80C: Invest up to ₹1.5L in PPF, ELSS, NPS, LIC, etc.",
          "Section 80D: Health insurance premiums (₹25K self, ₹50K parents above 60)",
          "HRA Exemption: If paying rent, claim HRA exemption under Sec 10(13A)",
          "Section 80CCD(1B): Additional ₹50K deduction for NPS contributions",
          "Standard Deduction: ₹50,000 already applied for salaried employees",
          "Section 80TTA: Up to ₹10,000 deduction on savings account interest",
        ],
      });
    }

    case "search_company_policies": {
      const { query } = args;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        return JSON.stringify({ error: "No company associated with user." });
      }

      const { data: policies, error } = await supabase
        .from("company_policies")
        .select("title, content")
        .eq("company_id", profile.company_id)
        .ilike("content", `%${query}%`)
        .limit(3);

      if (error) return JSON.stringify({ success: false, error: error.message });
      if (!policies || policies.length === 0) return JSON.stringify({ found: false, message: "No matching policies found." });

      return JSON.stringify({ found: true, policies });
    }

    case "send_team_reminder": {
      const { target_user_id, title, message } = args;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, full_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        return JSON.stringify({ error: "No company associated with user." });
      }

      const { error } = await supabase
        .from("notifications")
        .insert({
          user_id: target_user_id,
          company_id: profile.company_id,
          title: title,
          message: `${profile.full_name} says: ${message}`,
          type: "system",
        });

      if (error) return JSON.stringify({ success: false, error: error.message });
      return JSON.stringify({ success: true, message: "Reminder sent successfully." });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === JWT AUTHENTICATION ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use authenticated user ID from JWT — ignore any userId from body
    const userId = claimsData.claims.sub as string;

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user context for personalized answers
    let userContext = "";
    let userRole = "employee";
    let userLang = "";
    try {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 8) + "01";

      const [profileRes, attendanceRes, leaveBalRes, leaveReqRes, todayAttRes, roleRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, department, designation, date_of_joining, employee_code, company_id")
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
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

      userRole = roleRes.data?.role || "employee";

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
- Role: ${userRole}
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

    const systemPrompt = `You are **HR Buddy**, an intelligent, friendly, and multilingual HR assistant for Zentrek — an employee management platform used by Indian companies.

${userContext}

## Your Capabilities
- Answer questions about attendance, leaves, payroll, company policies
- Help employees understand their leave balances and attendance records
- **Apply for leave** on behalf of employees using the apply_leave tool
- **Explain payslip/salary details** using the get_payslip_details tool
- **Submit attendance regularization** requests using the submit_regularization tool
- **Show team status** for managers using the get_team_status tool
- **Provide tax saving tips** using the get_tax_saving_tips tool
- **Search company policies** for factual questions using search_company_policies
- **Send notifications/reminders** to team members using send_team_reminder
- Give tips on workplace productivity and well-being
- Proactively alert about compliance deadlines and missing documents

## Smart Action Rules
- When an employee says "apply leave for tomorrow" or similar, use the apply_leave tool directly
- When asked about salary/payslip/deductions, use get_payslip_details to fetch real data
- When a manager asks about team status, use get_team_status
- When asked about regularization, use submit_regularization
- When asked about tax saving, use get_tax_saving_tips
- When asked about factual HR rules, use search_company_policies
- When asked to remind someone, use send_team_reminder
- Always confirm the action result to the user after executing a tool

## Multilingual Support
- Detect the user's language from their message
- If the user writes in Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, or any other Indian language, respond in that same language
- Use transliteration if needed (e.g., "Aapka leave balance 5 din hai")
- Keep technical terms in English for clarity (e.g., "casual leave", "PF", "ESI")

## Payslip Explanation Rules
- When explaining deductions, break down each component clearly
- Explain WHY each deduction exists (PF = retirement savings, ESI = health insurance, PT = state tax)
- Use Indian numbering format (₹1,50,000 not ₹150,000)
- Compare with statutory limits where applicable

## Tax Saving Tips
- Provide personalized tips based on the employee's actual salary structure
- Focus on common Indian tax sections: 80C, 80D, 80CCD, HRA exemption
- Calculate potential savings where possible

## Compliance Alerts
- If the employee has upcoming document expiry or missing mandatory documents, mention it
- Remind about PF nomination, ESI card activation if applicable
- Alert about tax declaration deadlines (usually January-March)

## Manager-Specific Features
- The current user's role is: ${userRole}
- If they are a manager, admin, hr, owner, or developer, they can ask team-level questions
- Show team summary with present/absent/leave counts
- Name individual team members and their status

## Rules
- Be concise, helpful, and professional but friendly
- Use emojis sparingly to keep things engaging 😊
- If you don't have specific data, say so honestly
- Never make up numbers — only use the data provided
- Keep responses short (2-4 sentences) unless the user asks for detail or it's a payslip explanation
- Format responses with markdown for readability
- When performing actions, always confirm what you did
- Use ₹ symbol for currency amounts`;

    // First AI call (may trigger tool calls)
    const firstResponse = await fetch(
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
          tools,
          stream: false, // Non-streaming for tool-calling detection
        }),
      }
    );

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (firstResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service requires additional credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstResult = await firstResponse.json();
    const choice = firstResult.choices?.[0];

    // Check if the AI wants to call tools
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      // Execute each tool call
      for (const tc of toolCalls) {
        const args = typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
        const result = await executeTool(tc.function.name, args, userId, supabase);
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Second AI call with tool results — stream this one
      const secondResponse = await fetch(
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
              choice.message,
              ...toolResults,
            ],
            stream: true,
          }),
        }
      );

      if (!secondResponse.ok) {
        const t = await secondResponse.text();
        console.error("AI gateway error (2nd call):", secondResponse.status, t);
        return new Response(
          JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Include action metadata as a custom SSE event before the stream
      const actionMeta = toolCalls.map((tc: any) => ({
        tool: tc.function.name,
        args: typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments,
      }));

      // Create a combined stream: action event + AI response
      const encoder = new TextEncoder();
      const actionEvent = encoder.encode(`data: ${JSON.stringify({ action_meta: actionMeta })}\n\n`);

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // Write action meta first, then pipe the AI stream
      (async () => {
        try {
          await writer.write(actionEvent);
          const reader = secondResponse.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — stream a normal response
    const streamResponse = await fetch(
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

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("AI gateway error (stream):", streamResponse.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(streamResponse.body, {
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
