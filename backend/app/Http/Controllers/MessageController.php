<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\User;
use App\Models\Admin;
use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    /* ─────────────────────────────────────────
     |  HELPERS
     ───────────────────────────────────────── */

    private function formatMessage(Message $m, $viewerId, $viewerType): array
    {
        $isAdmin    = $viewerType === 'admin';
        $isMine     = ($viewerType === $m->sender_type && $viewerId == $m->sender_id);

        // Resolve sender name + initials
        if ($m->sender_type === 'admin') {
            $admin       = Admin::find($m->sender_id);
            $senderName  = $admin?->name ?? 'Counselor';
            $senderRole  = 'Counselor';
        } else {
            $user        = User::with('profile')->find($m->sender_id);
            $senderName  = $user?->profile?->full_name ?? $user?->name ?? 'Student';
            $senderRole  = 'Student';
        }

        $initials = collect(explode(' ', $senderName))
            ->map(fn($p) => strtoupper($p[0] ?? ''))
            ->take(2)
            ->join('');

        return [
            'id'          => $m->id,
            'sender_id'   => $m->sender_id,
            'sender_type' => $m->sender_type,
            'receiver_id' => $m->receiver_id,
            'receiver_type'=> $m->receiver_type,
            'from'        => $isMine ? 'You' : $senderName,
            'initials'    => $initials,
            'role'        => $senderRole,
            'subject'     => $m->subject,
            'body'        => $m->body,
            'is_read'     => (bool) $m->is_read,
            'time'        => $m->created_at->format('M d, Y') . ' • ' . $m->created_at->format('g:i A'),
            'created_at'  => $m->created_at,
        ];
    }

    /* ─────────────────────────────────────────
     |  ADMIN ROUTES
     ───────────────────────────────────────── */

    /**
     * GET /api/admin/messages
     * Returns ALL messages where admin is sender or receiver,
     * so admin can see full conversation history with each student.
     */
    public function adminInbox(Request $request)
    {
        $admin = $request->user();

        $messages = Message::where(function ($q) use ($admin) {
                // Messages received by this admin
                $q->where('receiver_id',   $admin->id)
                  ->where('receiver_type', 'admin');
            })->orWhere(function ($q) use ($admin) {
                // Messages sent by this admin
                $q->where('sender_id',   $admin->id)
                  ->where('sender_type', 'admin');
            })
            ->orderBy('created_at', 'asc')
            ->get();

        $formatted = $messages->map(fn($m) => $this->formatMessage($m, $admin->id, 'admin'));

        return response()->json(['messages' => $formatted]);
    }

    /**
     * GET /api/admin/messages/{id}
     * Mark a message as read
     */
    public function showForAdmin(Request $request, $id)
    {
        $msg = Message::findOrFail($id);
        if ($msg->receiver_type === 'admin' && $msg->receiver_id == $request->user()->id) {
            $msg->update(['is_read' => true]);
        }
        return response()->json(['message' => $this->formatMessage($msg, $request->user()->id, 'admin')]);
    }

    /**
     * POST /api/admin/messages
     * Admin sends a message to a student
     */
    public function sendFromAdmin(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|integer',
            'subject'     => 'nullable|string|max:255',
            'body'        => 'required|string',
        ]);

        $admin = $request->user();

        $msg = Message::create([
            'sender_id'     => $admin->id,
            'sender_type'   => 'admin',
            'receiver_id'   => $request->receiver_id,
            'receiver_type' => 'user',
            'subject'       => $request->subject ?? 'Message',
            'body'          => $request->body,
            'is_read'       => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => $this->formatMessage($msg, $admin->id, 'admin'),
        ], 201);
    }

    /**
     * DELETE /api/admin/messages/{id}
     */
    public function deleteForAdmin(Request $request, $id)
    {
        $msg = Message::findOrFail($id);
        $msg->delete();
        return response()->json(['success' => true]);
    }

    /**
     * GET /api/admin/students
     * List all students for the compose dropdown
     */
    public function listStudents()
    {
        $students = User::with('profile')
            ->get()
            ->map(fn($u) => [
                'id'    => $u->id,
                'name'  => $u->profile?->full_name ?? $u->name,
                'email' => $u->email,
            ]);

        return response()->json(['students' => $students]);
    }

    /* ─────────────────────────────────────────
     |  STUDENT (USER) ROUTES
     ───────────────────────────────────────── */

    /**
     * GET /api/user/messages
     * Returns ALL messages where student is sender or receiver
     */
    public function userInbox(Request $request)
    {
        $user = $request->user();

        $messages = Message::where(function ($q) use ($user) {
                // Messages received by this student
                $q->where('receiver_id',   $user->id)
                  ->where('receiver_type', 'user');
            })->orWhere(function ($q) use ($user) {
                // Messages sent by this student
                $q->where('sender_id',   $user->id)
                  ->where('sender_type', 'user');
            })
            ->orderBy('created_at', 'asc')
            ->get();

        $formatted = $messages->map(fn($m) => $this->formatMessage($m, $user->id, 'user'));

        return response()->json(['messages' => $formatted]);
    }

    /**
     * GET /api/user/messages/{id}
     * Mark as read
     */
    public function showForUser(Request $request, $id)
    {
        $msg = Message::findOrFail($id);
        if ($msg->receiver_type === 'user' && $msg->receiver_id == $request->user()->id) {
            $msg->update(['is_read' => true]);
        }
        return response()->json(['message' => $this->formatMessage($msg, $request->user()->id, 'user')]);
    }

    /**
     * POST /api/user/messages
     * Student sends a message to an admin/counselor
     */
    public function sendFromUser(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|integer',
            'subject'     => 'nullable|string|max:255',
            'body'        => 'required|string',
        ]);

        $user = $request->user();

        $msg = Message::create([
            'sender_id'     => $user->id,
            'sender_type'   => 'user',
            'receiver_id'   => $request->receiver_id,
            'receiver_type' => 'admin',
            'subject'       => $request->subject ?? 'Message',
            'body'          => $request->body,
            'is_read'       => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => $this->formatMessage($msg, $user->id, 'user'),
        ], 201);
    }

    /**
     * DELETE /api/user/messages/{id}
     */
    public function deleteForUser(Request $request, $id)
    {
        $msg = Message::findOrFail($id);
        $msg->delete();
        return response()->json(['success' => true]);
    }

    /**
     * GET /api/user/counselors
     * List admins for the student compose dropdown
     */
    public function listCounselors()
    {
        $admins = Admin::all()->map(fn($a) => [
            'id'   => $a->id,
            'name' => $a->name ?? 'Counselor',
            'role' => 'Counselor',
        ]);

        return response()->json(['counselors' => $admins]);
    }
}