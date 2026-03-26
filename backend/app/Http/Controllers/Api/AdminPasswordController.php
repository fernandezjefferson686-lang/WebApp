<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Admin;
use Illuminate\Support\Facades\Hash;

class AdminPasswordController extends Controller
{
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:admins,email',
            'password' => 'required|min:6|confirmed',
        ]);

        $admin = Admin::where('email', $request->email)->first();

        $admin->password = Hash::make($request->password);
        $admin->save();

        return response()->json([
            'message' => 'Password reset successfully'
        ], 200);
    }
}
