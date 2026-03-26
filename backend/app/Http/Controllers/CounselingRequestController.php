<?php

namespace App\Http\Controllers;

use App\Models\CounselingRequest;
use App\Models\Profile;
use Illuminate\Http\Request;

class CounselingRequestController extends Controller
{
    // ═══════════════════════════════════════
    // USER (STUDENT) ROUTES
    // ═══════════════════════════════════════

    /**
     * GET /api/user/counseling-requests
     */
    public function userIndex(Request $request)
    {
        $requests = CounselingRequest::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($req) {
                return [
                    'id'             => $req->id,
                    'counselor'      => $req->counselor,
                    'session_date'   => $req->session_date,
                    'session_time'   => $req->session_time,
                    'session_type'   => $req->session_type,
                    'mode'           => $req->mode,
                    'reason'         => $req->reason,
                    'status'         => $req->status,
                    'rejection_note' => $req->rejection_note,
                    'approval_note'  => $req->approval_note, // ← student sees counselor's schedule change note
                    'created_at'     => $req->created_at,
                ];
            });

        return response()->json(['requests' => $requests]);
    }

    /**
     * POST /api/user/counseling-requests
     */
    public function userStore(Request $request)
    {
        $validated = $request->validate([
            'counselor'    => 'sometimes|string|max:255',
            'session_date' => 'required|date|after_or_equal:today',
            'session_time' => 'required|string',
            'session_type' => 'required|string|max:255',
            'mode'         => 'required|string|max:100',
            'reason'       => 'required|string|min:10|max:1000',
        ]);

        $counselingRequest = CounselingRequest::create([
            'user_id'      => $request->user()->id,
            'counselor'    => $validated['counselor'] ?? 'Julie Maestrada',
            'session_date' => $validated['session_date'],
            'session_time' => $validated['session_time'],
            'session_type' => $validated['session_type'],
            'mode'         => $validated['mode'],
            'reason'       => $validated['reason'],
            'status'       => 'Pending',
        ]);

        return response()->json([
            'message' => 'Request submitted successfully.',
            'request' => $counselingRequest,
        ], 201);
    }

    /**
     * PATCH /api/user/counseling-requests/{id}/cancel
     */
    public function userCancel(Request $request, $id)
    {
        $counselingRequest = CounselingRequest::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($counselingRequest->status !== 'Pending') {
            return response()->json(['message' => 'Only pending requests can be cancelled.'], 422);
        }

        $counselingRequest->update(['status' => 'Cancelled']);

        return response()->json([
            'message' => 'Request cancelled.',
            'request' => $counselingRequest,
        ]);
    }

    // ═══════════════════════════════════════
    // ADMIN ROUTES
    // ═══════════════════════════════════════

    /**
     * GET /api/admin/counseling-requests
     * Returns all requests with student name, ID, department, and profile photo
     */
    public function adminIndex()
    {
        $requests = CounselingRequest::with(['user', 'user.profile'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($req) {
                $profile = $req->user?->profile;
                return [
                    'id'           => $req->id,
                    'user_id'      => $req->user_id,
                    'student_name' => $profile?->full_name  ?? $req->user?->name ?? 'Unknown',
                    'student_id'   => $profile?->student_id ?? '—',
                    'department'   => $profile?->department ?? '—',
                    'profile_pic'  => $profile?->profile_pic,
                    'counselor'    => $req->counselor,
                    'session_date' => $req->session_date,
                    'session_time' => $req->session_time,
                    'session_type' => $req->session_type,
                    'mode'         => $req->mode,
                    'reason'         => $req->reason,
                    'status'         => $req->status,
                    'rejection_note' => $req->rejection_note, // ← included so admin sees it too
                    'approval_note'  => $req->approval_note,
                    'created_at'     => $req->created_at,
                ];
            });

        return response()->json(['requests' => $requests]);
    }

    /**
     * PATCH /api/admin/counseling-requests/{id}/status
     *
     * When approving, the counselor can optionally override
     * the student's preferred session_date and session_time.
     */
    public function adminUpdateStatus(Request $request, $id)
    {
        $request->validate([
            'status'         => 'required|in:Approved,Rejected',
            'session_date'   => 'required_if:status,Approved|nullable|date',
            'session_time'   => 'required_if:status,Approved|nullable|string|max:20',
            'mode'           => 'nullable|string|max:50',
            'approval_note'  => 'nullable|string|max:500',
            'rejection_note' => 'nullable|string|max:500',
        ]);

        $counselingRequest = CounselingRequest::findOrFail($id);

        $updateData = ['status' => $request->status];

        if ($request->status === 'Approved') {
            $updateData['session_date']   = $request->session_date;
            $updateData['session_time']   = $request->session_time;
            $updateData['mode']           = $request->mode ?? $counselingRequest->mode;
            $updateData['approval_note']  = $request->approval_note ?? null;
            $updateData['rejection_note'] = null; // clear any old note
        }

        if ($request->status === 'Rejected') {
            $updateData['rejection_note'] = $request->rejection_note ?? null;
        }

        $counselingRequest->update($updateData);

        return response()->json([
            'message' => "Request {$request->status}.",
            'request' => $counselingRequest,
        ]);
    }

    /**
     * DELETE /api/admin/counseling-requests/{id}
     * Only allows deleting Cancelled or Rejected records
     */
    public function adminDelete($id)
    {
        $counselingRequest = CounselingRequest::findOrFail($id);

        if (!in_array($counselingRequest->status, ['Cancelled', 'Rejected'])) {
            return response()->json([
                'message' => 'Only Cancelled or Rejected records can be deleted.',
            ], 422);
        }

        $counselingRequest->delete();

        return response()->json(['message' => 'Record deleted successfully.']);
    }

    /**
     * GET /api/admin/students/{userId}/profile
     */
    public function adminViewStudentProfile($userId)
    {
        $profile = Profile::with('user')->where('user_id', $userId)->first();

        if (!$profile) {
            return response()->json(['message' => 'Profile not found'], 404);
        }

        return response()->json([
            'status'  => 'success',
            'profile' => [
                'full_name'       => $profile->full_name,
                'email'           => $profile->user?->email ?? 'Not provided',
                'student_id'      => $profile->student_id,
                'phone'           => $profile->phone,
                'sex'             => $profile->sex,
                'department'      => $profile->department,
                'year_level'      => $profile->year_level,
                'emergency_name'  => $profile->emergency_name,
                'emergency_phone' => $profile->emergency_phone,
                'profile_pic'     => $profile->profile_pic,
            ],
        ]);
    }
}