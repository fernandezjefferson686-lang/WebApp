<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo($request)
    {
        // Change: Return null instead of route('login') to force a JSON 401 error
        if (! $request->expectsJson()) {
            return null; 
        }
    }
}