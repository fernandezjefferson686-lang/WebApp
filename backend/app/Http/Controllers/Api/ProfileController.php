<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Profile;

class ProfileController extends Controller
{
    // GET /api/user/profile
    public function show(Request $request)
    {
        $userId  = $request->user()->id;
        $profile = Profile::where('user_id', $userId)->first();

        if (!$profile) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Profile not found',
            ], 404);
        }

        return response()->json([
            'status'  => 'success',
            'profile' => $profile,
        ], 200);
    }

    // POST /api/user/profile/setup
    public function setup(Request $request)
    {
        // ✅ 'sometimes' = only validate if the field is present in the request
        // Fixes 422 caused by missing gender/birthdate fields from the React form
        $request->validate([
            'full_name'         => 'sometimes|string|max:255',
            'student_id'        => 'sometimes|string|max:50',
            'sex'               => 'sometimes|nullable|string',
            'birthdate'         => 'sometimes|nullable|date',
            'department'        => 'sometimes|string',
            'year_level'        => 'sometimes|string',
            'section'           => 'sometimes|nullable|string',
            'phone'             => 'sometimes|string|max:20',
            'address'           => 'sometimes|string',
            'emergency_name'    => 'sometimes|nullable|string',
            'emergency_phone'   => 'sometimes|nullable|string',
            'counseling_reason' => 'sometimes|nullable|string',
            'counseling_type'   => 'sometimes|nullable|string',
            'profile_pic'       => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:4096',
        ]);

        $userId = $request->user()->id;

        $data = $request->only([
            'full_name', 'student_id', 'sex', 'birthdate',
            'department', 'year_level', 'section', 'phone',
            'address', 'emergency_name', 'emergency_phone',
            'counseling_reason', 'counseling_type',
        ]);

        if ($request->hasFile('profile_pic')) {
            $path                = $request->file('profile_pic')->store('profile_pics', 'public');
            $data['profile_pic'] = $path;
        }

        $profile = Profile::updateOrCreate(
            ['user_id' => $userId],
            $data
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Profile saved successfully.',
            'profile' => $profile,
        ], 200);
    }

    // PUT /api/user/profile
    public function update(Request $request)
    {
        $userId  = $request->user()->id;
        $profile = Profile::where('user_id', $userId)->first();

        if (!$profile) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Profile not found',
            ], 404);
        }

        $request->validate([
            'full_name'         => 'sometimes|string|max:255',
            'student_id'        => 'sometimes|string|max:50',
            'sex'               => 'sometimes|nullable|string',
            'birthdate'         => 'sometimes|nullable|date',
            'department'        => 'sometimes|string',
            'year_level'        => 'sometimes|string',
            'section'           => 'sometimes|nullable|string',
            'phone'             => 'sometimes|string|max:20',
            'address'           => 'sometimes|string',
            'emergency_name'    => 'sometimes|nullable|string',
            'emergency_phone'   => 'sometimes|nullable|string',
            'counseling_reason' => 'sometimes|nullable|string',
            'counseling_type'   => 'sometimes|nullable|string',
            'profile_pic'       => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:4096',
        ]);

        $data = $request->only([
            'full_name', 'student_id', 'sex', 'birthdate',
            'department', 'year_level', 'section', 'phone',
            'address', 'emergency_name', 'emergency_phone',
            'counseling_reason', 'counseling_type',
        ]);

        if ($request->hasFile('profile_pic')) {
            $path                = $request->file('profile_pic')->store('profile_pics', 'public');
            $data['profile_pic'] = $path;
        }

        $profile->update($data);

        return response()->json([
            'status'  => 'success',
            'message' => 'Profile updated successfully.',
            'profile' => $profile,
        ], 200);
    }
}