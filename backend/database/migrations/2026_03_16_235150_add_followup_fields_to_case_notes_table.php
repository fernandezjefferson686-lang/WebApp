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
    Schema::table('case_notes', function (Blueprint $table) {
        $table->enum('fu_status', ['Pending','Completed'])->default('Pending')->after('follow_up_needed');
        $table->text('fu_done_note')->nullable()->after('fu_status');
    });
}

public function down(): void
{
    Schema::table('case_notes', function (Blueprint $table) {
        $table->dropColumn(['fu_status', 'fu_done_note']);
    });
}
};
