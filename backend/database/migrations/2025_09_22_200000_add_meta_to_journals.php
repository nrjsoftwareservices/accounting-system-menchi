<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('is_posted');
        });
        Schema::table('journal_lines', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('journal_lines', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
    }
};

