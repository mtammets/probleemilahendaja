import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const SESSION_STORAGE_KEY = "probleemilahendaja_session_id";

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

export function getOrCreateSessionId() {
    const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (existingSessionId) {
        return existingSessionId;
    }

    const sessionId = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
}

export async function fetchSolvedReportsTotal() {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase.rpc("get_public_metrics");

    if (error) {
        throw error;
    }

    const row = normalizeRpcSingleResult(data);

    return row?.solved_reports_total ?? null;
}

export async function createProblemReport(report) {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase.rpc("create_problem_report", {
        p_session_id: report.sessionId,
        p_problem_text: report.problemText,
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
            solvedReportsTotal: row.solved_reports_total
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
