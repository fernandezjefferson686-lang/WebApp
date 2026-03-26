<?php

namespace App\Http\Controllers;

use App\Models\CaseNote;
use App\Models\CounselingRequest;
use App\Models\User;
use Illuminate\Http\Request;

class CaseNoteController extends Controller
{
    // ══════════════════════════════════════════════
    // ADMIN ROUTES
    // ══════════════════════════════════════════════

    /**
     * GET /api/admin/case-notes
     * List all case notes with student + session info
     */
    public function adminIndex()
    {
        $notes = CaseNote::with(['counselingRequest', 'student.profile'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($note) {
                $req     = $note->counselingRequest;
                $profile = $note->student?->profile;
                return [
                    'id'                    => $note->id,
                    'counseling_request_id' => $note->counseling_request_id,
                    'user_id'               => $note->user_id,
                    'summary'               => $note->summary,
                    'recommendations'       => $note->recommendations,
                    'follow_up_needed'      => $note->follow_up_needed,
                    'next_session_date'     => $note->next_session_date?->format('Y-m-d'),
                    'next_session_time'     => $note->next_session_time, // ← ADDED
                    'fu_status'             => $note->fu_status    ?? 'Pending',
                    'fu_done_note'          => $note->fu_done_note ?? null,
                    'created_at'            => $note->created_at,
                    // Session info
                    'session_date'          => $req?->session_date?->format('Y-m-d'),
                    'session_time'          => $req?->session_time,
                    'session_type'          => $req?->session_type,
                    'mode'                  => $req?->mode,
                    // Student info
                    'student_name'          => $profile?->full_name ?? $note->student?->name,
                    'student_id'            => $profile?->student_id,
                    'department'            => $profile?->department,
                    'profile_pic'           => $profile?->profile_pic,
                ];
            });

        return response()->json(['notes' => $notes]);
    }

    /**
     * GET /api/admin/case-notes/session/{requestId}
     * Get a single note by counseling_request_id
     */
    public function adminShow($requestId)
    {
        $note = CaseNote::where('counseling_request_id', $requestId)->first();

        if (!$note) {
            return response()->json(['note' => null]);
        }

        return response()->json([
            'note' => [
                'id'                => $note->id,
                'summary'           => $note->summary,
                'recommendations'   => $note->recommendations,
                'follow_up_needed'  => $note->follow_up_needed,
                'next_session_date' => $note->next_session_date?->format('Y-m-d'),
                'next_session_time' => $note->next_session_time, // ← ADDED
                'fu_status'         => $note->fu_status    ?? 'Pending',
                'fu_done_note'      => $note->fu_done_note ?? null,
            ]
        ]);
    }

    /**
     * POST /api/admin/case-notes/session/{requestId}
     * Create or update a case note for a session
     */
    public function adminSave(Request $request, $requestId)
    {
        $request->validate([
            'summary'            => 'required|string|max:5000',
            'recommendations'    => 'nullable|string|max:5000',
            'follow_up_needed'   => 'boolean',
            'next_session_date'  => 'nullable|date',
            'next_session_time'  => 'nullable|string', // ← ADDED
        ]);

        $counselingRequest = CounselingRequest::findOrFail($requestId);

        $note = CaseNote::updateOrCreate(
            ['counseling_request_id' => $requestId],
            [
                'user_id'            => $counselingRequest->user_id,
                'summary'            => $request->summary,
                'recommendations'    => $request->recommendations,
                'follow_up_needed'   => $request->boolean('follow_up_needed', false),
                'next_session_date'  => $request->next_session_date,
                'next_session_time'  => $request->next_session_time, // ← ADDED
                'fu_status'          => 'Pending',
            ]
        );

        return response()->json([
            'message' => 'Case note saved.',
            'note'    => $note,
        ]);
    }

    /**
     * DELETE /api/admin/case-notes/{id}
     * Delete a case note
     */
    public function adminDelete($id)
    {
        $note = CaseNote::findOrFail($id);
        $note->delete();

        return response()->json(['message' => 'Case note deleted.']);
    }

    /**
     * PATCH /api/admin/case-notes/{id}/followup-done
     * Mark a follow-up as Completed, optionally with an outcome note
     */
    public function markFollowUpDone(Request $request, $id)
    {
        $request->validate([
            'fu_done_note' => 'nullable|string|max:2000',
        ]);

        $note = CaseNote::findOrFail($id);

        $note->update([
            'fu_status'    => 'Completed',
            'fu_done_note' => $request->fu_done_note ?? null,
        ]);

        return response()->json([
            'message' => 'Follow-up marked as completed.',
            'note'    => [
                'id'           => $note->id,
                'fu_status'    => $note->fu_status,
                'fu_done_note' => $note->fu_done_note,
            ],
        ]);
    }

    /**
     * PATCH /api/admin/case-notes/{id}/reschedule
     * Reschedule a follow-up to a new date
     */
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'next_session_date' => 'required|date|after_or_equal:today',
            'next_session_time' => 'nullable|string', // ← ADDED (optional on reschedule)
        ]);

        $note = CaseNote::findOrFail($id);

        $note->update([
            'next_session_date' => $request->next_session_date,
            'next_session_time' => $request->next_session_time ?? $note->next_session_time,
            'fu_status'         => 'Pending',
        ]);

        return response()->json([
            'message' => 'Follow-up rescheduled.',
            'note'    => [
                'id'                => $note->id,
                'next_session_date' => $note->next_session_date?->format('Y-m-d'),
                'next_session_time' => $note->next_session_time, // ← ADDED
                'fu_status'         => $note->fu_status,
            ],
        ]);
    }

    // ══════════════════════════════════════════════
    // STUDENT ROUTES
    // ══════════════════════════════════════════════

    /**
     * GET /api/user/case-notes
     * Student gets their own case notes (summary + recommendations only)
     */
    public function userIndex(Request $request)
    {
        $user = $request->user();

        $notes = CaseNote::where('user_id', $user->id)
            ->with('counselingRequest')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($note) {
                $req = $note->counselingRequest;
                return [
                    'id'                    => $note->id,
                    'counseling_request_id' => $note->counseling_request_id,
                    'summary'               => $note->summary,
                    'recommendations'       => $note->recommendations,
                    'follow_up_needed'      => $note->follow_up_needed,
                    'next_session_date'     => $note->next_session_date?->format('Y-m-d'),
                    'next_session_time'     => $note->next_session_time, // ← ADDED
                    'fu_status'             => $note->fu_status ?? 'Pending',
                    'created_at'            => $note->created_at,
                    // Session info for context
                    'session_date'          => $req?->session_date?->format('Y-m-d'),
                    'session_time'          => $req?->session_time,
                    'session_type'          => $req?->session_type,
                    'mode'                  => $req?->mode,
                    'counselor'             => $req?->counselor,
                ];
            });

        return response()->json(['notes' => $notes]);
    }
}