<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
   public function up(): void
{
    Schema::table('counseling_requests', function (Blueprint $table) {
        $table->text('rejection_note')->nullable()->after('status');
    });
}

public function down(): void
{
    Schema::table('counseling_requests', function (Blueprint $table) {
        $table->dropColumn('rejection_note');
    });
}
};
