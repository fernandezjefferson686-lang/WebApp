<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CounselingRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'counselor',
        'session_date',
        'session_time',
        'session_type',
        'mode',
        'reason',
        'status',
        'rejection_note', // ← counselor's reason when rejecting
        'approval_note',  // ← counselor's note to student when approving with changes
    ];

    protected $casts = [
        'session_date' => 'date:Y-m-d',
    ];

    // ── Relationships ──

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}