<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // ===================== REGISTER =====================
    public function register(Request $request)
    {
        $request->validate([
            'name'     => 'required|string',
            'email'    => 'required|email|unique:users',
            'password' => 'required|min:6|confirmed',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'User registered successfully',
            'user'    => $user,
        ]);
    }

    // ===================== LOGIN =====================
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Wrong Credentials (Invalid Email and Password)'
            ], 401);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Invalid Password'
            ], 401);
        }

        // Delete old tokens and generate a fresh Sanctum token
        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        // ✅ Check if user already has a profile in the profiles table
        $profileCompleted = \App\Models\Profile::where('user_id', $user->id)->exists();

        return response()->json([
            'status'            => 'success',
            'message'           => 'Login Successful',
            'user'              => $user,
            'token'             => $token,
            'profile_completed' => $profileCompleted
        ]);
    }

    // ===================== LOGOUT =====================
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status'  => 'success',
            'message' => 'Logged out successfully'
        ]);
    }

    // ===================== FORGOT PASSWORD =====================
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        return response()->json(['message' => 'Password reset link sent']);
    }

    // ===================== RESET PASSWORD =====================
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|min:6|confirmed',
        ]);

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        return response()->json(['message' => 'Password reset successfully']);
    }
}