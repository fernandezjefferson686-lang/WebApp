<?php
// Run: php artisan make:migration add_name_to_admins_table
// Then replace up/down with this:

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            // Only add if column doesn't exist
            if (!Schema::hasColumn('admins', 'name')) {
                $table->string('name')->default('Counselor')->after('email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }
};