<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    protected $fillable = [
        'user_id',
        'full_name',
        'student_id',
        'sex',
        'birthdate',
        'department',
        'year_level',
        'section',
        'phone',
        'address',
        'emergency_name',
        'emergency_phone',
        'counseling_reason',
        'counseling_type',
        'profile_pic'
    ];

    // File: app/Models/Profile.php
public function user()
{
    return $this->belongsTo(User::class, 'user_id');
}
}