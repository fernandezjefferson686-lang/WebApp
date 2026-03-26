<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('full_name');
            $table->string('student_id');
            $table->string('gender');
            $table->date('birthdate');
            $table->string('department');
            $table->string('year_level');
            $table->string('section')->nullable();
            $table->string('phone');
            $table->string('address');
            $table->string('emergency_name')->nullable();
            $table->string('emergency_phone')->nullable();
            $table->string('counseling_reason')->nullable();
            $table->string('counseling_type')->nullable();
            $table->string('profile_pic')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('profiles');
    }
};