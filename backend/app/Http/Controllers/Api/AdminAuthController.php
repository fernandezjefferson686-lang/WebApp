<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Admin;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class AdminAuthController extends Controller
{
    public function login(Request $request)
{
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    $admin = \App\Models\Admin::where('email', $request->email)->first();

    if (!$admin || !\Illuminate\Support\Facades\Hash::check($request->password, $admin->password)) {
        return response()->json(['message' => 'Invalid credentials'], 401);
    }

    // Generate the token
    $token = $admin->createToken('admin-token')->plainTextToken;

    return response()->json([
        'message' => 'Login successful',
        'token'   => $token,
        'admin'   => $admin
    ], 200);
}
}