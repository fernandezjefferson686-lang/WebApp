<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('counseling_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // student
            $table->string('counselor')->default('Julie Maestrada');
            $table->date('session_date');
            $table->string('session_time');
            $table->string('session_type');
            $table->string('mode');
            $table->text('reason');
            $table->enum('status', ['Pending', 'Approved', 'Rejected', 'Cancelled'])->default('Pending');
            $table->text('rejection_note')->nullable(); // ← counselor's reason when rejecting
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('counseling_requests');
    }
};