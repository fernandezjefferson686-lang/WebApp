<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CaseNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'counseling_request_id',
        'user_id',
        'summary',
        'recommendations',
        'follow_up_needed',
        'next_session_date',
        'next_session_time', // ← ADDED
        'fu_status',         // ← ADDED
        'fu_done_note',      // ← ADDED
    ];

    protected $casts = [
        'follow_up_needed'  => 'boolean',
        'next_session_date' => 'date:Y-m-d',
    ];

    public function counselingRequest()
    {
        return $this->belongsTo(CounselingRequest::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}