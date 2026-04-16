import { createClient } from "@supabase/supabase-js";
import { GENERAL_PROBLEM_CATEGORY } from "./problem-categories.mjs";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const SESSION_STORAGE_KEY = "probleemilahendaja_session_id";
const ENABLE_SUPABASE_REALTIME = String(import.meta.env.VITE_ENABLE_SUPABASE_REALTIME || "").trim() === "true";
const unsupportedOptionalRpcFunctions = new Set();
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

function isMissingOptionalRpcError(error, rpcName) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const errorCode = typeof error.code === "string" ? error.code : "";

    if (errorCode === "PGRST202" || errorCode === "42883") {
        return true;
    }

    const errorText = [
        error.message,
        error.details,
        error.hint
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return errorText.includes(rpcName.toLowerCase())
        && (
            errorText.includes("schema cache")
            || errorText.includes("could not find the function")
            || errorText.includes("does not exist")
        );
}

async function invokeOptionalArrayRpc(rpcName, params) {
    if (!supabase || unsupportedOptionalRpcFunctions.has(rpcName)) {
        return [];
    }

    const { data, error } = await supabase.rpc(rpcName, params);

    if (error) {
        if (isMissingOptionalRpcError(error, rpcName)) {
            unsupportedOptionalRpcFunctions.add(rpcName);
            return [];
        }

        throw error;
    }

    return Array.isArray(data) ? data : [];
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

export async function fetchProblemCategoryStats(days = 30) {
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase.rpc("get_problem_category_stats", {
        p_days: days
    });

    if (error) {
        throw error;
    }

    return Array.isArray(data)
        ? data.map(function (row) {
            return {
                problemType: row.problem_type ?? GENERAL_PROBLEM_CATEGORY.label,
                problemCount: normalizeInteger(row.problem_count),
                sharePercent: typeof row.share_percent === "number"
                    ? row.share_percent
                    : Number(row.share_percent || 0),
                totalReports: normalizeInteger(row.total_reports)
            };
        })
        : [];
}

export async function fetchProblemCategoryTrends(days = 30) {
    if (!supabase) {
        return [];
    }

    const data = await invokeOptionalArrayRpc("get_problem_category_trends", {
        p_days: days
    });

    return data.map(function (row) {
            return {
                problemType: row.problem_type ?? GENERAL_PROBLEM_CATEGORY.label,
                currentCount: normalizeInteger(row.current_count),
                previousCount: normalizeInteger(row.previous_count),
                currentSharePercent: typeof row.current_share_percent === "number"
                    ? row.current_share_percent
                    : Number(row.current_share_percent || 0),
                previousSharePercent: typeof row.previous_share_percent === "number"
                    ? row.previous_share_percent
                    : Number(row.previous_share_percent || 0),
                deltaSharePoints: typeof row.delta_share_points === "number"
                    ? row.delta_share_points
                    : Number(row.delta_share_points || 0),
                deltaCount: normalizeInteger(row.delta_count)
            };
        });
}

export async function fetchProblemTimeSegments(days = 30) {
    if (!supabase) {
        return [];
    }

    const data = await invokeOptionalArrayRpc("get_problem_time_segments", {
        p_days: days
    });

    return data.map(function (row) {
            return {
                segmentIndex: normalizeInteger(row.segment_index),
                segmentLabel: row.segment_label ?? "",
                startHour: normalizeInteger(row.start_hour),
                endHour: normalizeInteger(row.end_hour),
                problemCount: normalizeInteger(row.problem_count),
                sharePercent: typeof row.share_percent === "number"
                    ? row.share_percent
                    : Number(row.share_percent || 0)
            };
        });
}

export function subscribeToReportInserts(onInsert, channelName = "reports-insert-counter") {
    if (!supabase || !ENABLE_SUPABASE_REALTIME || typeof onInsert !== "function") {
        return function () {
            // No-op cleanup when Supabase, Realtime, or callback is unavailable.
        };
    }

    const channel = supabase
        .channel(channelName)
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
                problemType: row.problem_type ?? GENERAL_PROBLEM_CATEGORY.label,
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
