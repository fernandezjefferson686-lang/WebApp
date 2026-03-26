<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminPasswordController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\CounselingRequestController;
use App\Http\Controllers\CaseNoteController;
use App\Http\Controllers\MessageController;

/*
|--------------------------------------------------------------------------
| USER ROUTES
|--------------------------------------------------------------------------
*/

Route::prefix('user')->group(function () {

    // ---------- PUBLIC ROUTES ----------
    Route::post('/register',        [AuthController::class, 'register']);
    Route::post('/login',           [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

    // ---------- PROTECTED ROUTES ----------
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);

        // Profile routes
        Route::get  ('/profile',       [ProfileController::class, 'show']);
        Route::post ('/profile/setup', [ProfileController::class, 'setup']);
        Route::put  ('/profile',       [ProfileController::class, 'update']);

        // Counseling Request routes
        Route::get   ('counseling-requests',             [CounselingRequestController::class, 'userIndex']);
        Route::post  ('counseling-requests',             [CounselingRequestController::class, 'userStore']);
        Route::patch ('counseling-requests/{id}/cancel', [CounselingRequestController::class, 'userCancel']);

        // Case Notes (student — read only)
        Route::get('case-notes', [CaseNoteController::class, 'userIndex']);

        // Messages (student)
        Route::get    ('/messages',      [MessageController::class, 'userInbox']);
        Route::get    ('/messages/{id}', [MessageController::class, 'showForUser']);
        Route::post   ('/messages',      [MessageController::class, 'sendFromUser']);
        Route::delete ('/messages/{id}', [MessageController::class, 'deleteForUser']);
        Route::get    ('/counselors',    [MessageController::class, 'listCounselors']);

    });
});


/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

Route::prefix('admin')->group(function () {

    // Public admin auth routes
    Route::post('/login',          [AdminAuthController::class, 'login']);
    Route::post('/reset-password', [AdminPasswordController::class, 'resetPassword']);

    // Protected admin routes
    Route::middleware('auth:sanctum')->group(function () {

        // Counseling Requests
        Route::get    ('counseling-requests',             [CounselingRequestController::class, 'adminIndex']);
        Route::patch  ('counseling-requests/{id}/status', [CounselingRequestController::class, 'adminUpdateStatus']);
        Route::delete ('counseling-requests/{id}',        [CounselingRequestController::class, 'adminDelete']);
        Route::get    ('students/{userId}/profile',       [CounselingRequestController::class, 'adminViewStudentProfile']);

        // Case Notes (admin — full CRUD)
        Route::get    ('case-notes',                     [CaseNoteController::class, 'adminIndex']);
        Route::get    ('case-notes/session/{requestId}', [CaseNoteController::class, 'adminShow']);
        Route::post   ('case-notes/session/{requestId}', [CaseNoteController::class, 'adminSave']);
        Route::delete ('case-notes/{id}',                [CaseNoteController::class, 'adminDelete']);

        // ── NEW: Follow-up Status routes ──
        Route::patch  ('case-notes/{id}/followup-done',  [CaseNoteController::class, 'markFollowUpDone']);
        Route::patch  ('case-notes/{id}/reschedule',     [CaseNoteController::class, 'reschedule']);

        // Messages (admin)
        Route::get    ('/messages',      [MessageController::class, 'adminInbox']);
        Route::get    ('/messages/{id}', [MessageController::class, 'showForAdmin']);
        Route::post   ('/messages',      [MessageController::class, 'sendFromAdmin']);
        Route::delete ('/messages/{id}', [MessageController::class, 'deleteForAdmin']);
        Route::get    ('/students',      [MessageController::class, 'listStudents']);

    });

});