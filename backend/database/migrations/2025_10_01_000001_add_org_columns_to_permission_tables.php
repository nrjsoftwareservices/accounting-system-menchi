<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $tables = config('permission.table_names');
        $column = config('permission.column_names.team_foreign_key', 'organization_id');

        if (Schema::hasTable($tables['roles']) && !Schema::hasColumn($tables['roles'], $column)) {
            Schema::table($tables['roles'], function (Blueprint $table) use ($column) {
                $table->unsignedBigInteger($column)->nullable()->after('id');
                $table->index($column, 'roles_'.$column.'_index');
            });
        }

        if (Schema::hasTable($tables['model_has_roles']) && !Schema::hasColumn($tables['model_has_roles'], $column)) {
            Schema::table($tables['model_has_roles'], function (Blueprint $table) use ($column) {
                $table->unsignedBigInteger($column)->nullable()->after('model_id');
                $table->index($column, 'model_has_roles_'.$column.'_index');
            });
        }

        if (Schema::hasTable($tables['model_has_permissions']) && !Schema::hasColumn($tables['model_has_permissions'], $column)) {
            Schema::table($tables['model_has_permissions'], function (Blueprint $table) use ($column) {
                $table->unsignedBigInteger($column)->nullable()->after('model_id');
                $table->index($column, 'model_has_permissions_'.$column.'_index');
            });
        }
    }

    public function down(): void
    {
        $tables = config('permission.table_names');
        $column = config('permission.column_names.team_foreign_key', 'organization_id');

        $indexMap = [
            'roles' => 'roles_'.$column.'_index',
            'model_has_roles' => 'model_has_roles_'.$column.'_index',
            'model_has_permissions' => 'model_has_permissions_'.$column.'_index',
        ];

        foreach ($indexMap as $key => $indexName) {
            $tableName = $tables[$key] ?? null;
            if ($tableName && Schema::hasTable($tableName) && Schema::hasColumn($tableName, $column)) {
                Schema::table($tableName, function (Blueprint $table) use ($column, $indexName) {
                    $table->dropIndex($indexName);
                    $table->dropColumn($column);
                });
            }
        }
    }
};
