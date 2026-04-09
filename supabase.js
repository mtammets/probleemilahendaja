import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const SESSION_STORAGE_KEY = "probleemilahendaja_session_id";
let inMemorySessionId = null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    })
    : null;

function normalizeRpcSingleResult(data) {
    if (Array.isArray(data)) {
        return data[0] ?? null;
    }

    return data ?? null;
}

function normalizeInteger(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
}

export function getOrCreateSessionId() {
    try {
        const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

        if (existingSessionId) {
            inMemorySessionId = existingSessionId;
            return existingSessionId;
        }

        const sessionId = crypto.randomUUID();
        window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
        inMemorySessionId = sessionId;
        return sessionId;
    } catch (_error) {
        if (!inMemorySessionId) {
            inMemorySessionId = crypto.randomUUID();
        }

        return inMemorySessionId;
    }
}

export async function fetchSolvedReportsTotal() {
    if (!supabase) {
        return 0;
    }

    const { data, error } = await supabase.rpc("get_public_metrics");

    if (error) {
        throw error;
    }

    const row = normalizeRpcSingleResult(data);

    return normalizeInteger(row?.solved_reports_total);
}

export function subscribeToReportInserts(onInsert) {
    if (!supabase || typeof onInsert !== "function") {
        return function () {
            // No-op cleanup when Supabase or callback is unavailable.
        };
    }

    const channel = supabase
        .channel("reports-insert-counter")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "reports"
            },
            function () {
                onInsert();
            }
        )
        .subscribe();

    return function () {
        void supabase.removeChannel(channel);
    };
}

export async function fetchRecentProblemReports(limit = 6) {
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase.rpc("get_recent_problem_reports", {
        p_limit: limit
    });

    if (error) {
        throw error;
    }

    return Array.isArray(data)
        ? data.map(function (row) {
            return {
                reportId: row.report_id ?? null,
                problemText: row.problem_text ?? "",
                problemType: row.problem_type ?? "Üldine olukord",
                status: row.status ?? "Lahendatud",
                createdAt: row.created_at ?? null
            };
        })
        : [];
}

export async function createProblemReport(report) {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase.rpc("create_problem_report", {
        p_session_id: report.sessionId,
        p_problem_text: report.problemText,
        p_public_problem_text: report.publicProblemText,
        p_problem_type: report.problemType,
        p_status: report.status,
        p_clarity_level: report.clarityLevel,
        p_summary: report.summary,
        p_analysis: report.analysis,
        p_resolution: report.resolution
    });

    if (error) {
        throw error;
    }

    const row = normalizeRpcSingleResult(data);

    return row
        ? {
            reportId: row.report_id,
            solvedReportsTotal: normalizeInteger(row.solved_reports_total),
            recentProblem: row.problem_text
                ? {
                    reportId: row.report_id ?? null,
                    problemText: row.problem_text,
                    problemType: row.problem_type ?? report.problemType,
                    status: row.status ?? report.status,
                    createdAt: row.created_at ?? null
                }
                : null
        }
        : null;
}

export async function submitProblemRating(input) {
    if (!supabase) {
        return null;
    }

    const { error } = await supabase.rpc("submit_report_rating", {
        p_report_id: input.reportId,
        p_session_id: input.sessionId,
        p_rating: input.rating
    });

    if (error) {
        throw error;
    }

    return true;
}
