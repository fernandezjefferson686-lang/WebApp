<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();

            // Sender — either a student (user) or admin
            $table->unsignedBigInteger('sender_id');
            $table->string('sender_type');       // 'user' or 'admin'

            // Receiver — either a student (user) or admin
            $table->unsignedBigInteger('receiver_id');
            $table->string('receiver_type');     // 'user' or 'admin'

            $table->string('subject')->nullable();
            $table->text('body');
            $table->boolean('is_read')->default(false);

            // Optional: link to a counseling request thread
            $table->unsignedBigInteger('request_id')->nullable();
            $table->foreign('request_id')->references('id')->on('counseling_requests')->onDelete('set null');

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('messages');
    }
};