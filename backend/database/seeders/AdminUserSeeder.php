<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use App\Models\Organization;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure permission cache is reset before seeding
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // Ensure an organization exists and set team context for Spatie (teams enabled)
        $orgName = env('ADMIN_ORG_NAME', 'Default Organization');
        $orgCode = env('ADMIN_ORG_CODE', 'DEFAULT');
        $orgCurrency = env('ADMIN_ORG_CURRENCY', 'PHP');
        $org = Organization::firstOrCreate(
            ['code' => $orgCode],
            [
                'uuid' => (string) Str::uuid(),
                'name' => $orgName,
                'default_currency' => $orgCurrency,
            ]
        );

        $teamColumn = config('permission.column_names.team_foreign_key', 'organization_id');
        $modelHasRolesTable = config('permission.table_names.model_has_roles', 'model_has_roles');
        $supportsTeams = Schema::hasColumn($modelHasRolesTable, $teamColumn);
        if ($supportsTeams) {
            \setPermissionsTeamId($org->id);
        }

        // Create or fetch the admin role
        $roleAttributes = ['name' => 'admin', 'guard_name' => config('auth.defaults.guard')];
        if ($supportsTeams) {
            $roleAttributes[$teamColumn] = $org->id;
        }
        $role = Role::firstOrCreate($roleAttributes);

        // Grant the role all existing permissions
        $allPermissions = Permission::pluck('name')->all();
        if (!empty($allPermissions)) {
            $role->syncPermissions($allPermissions);
        }

        // Create or update the admin user
        $email = env('ADMIN_EMAIL', 'admin@example.com');
        $password = env('ADMIN_PASSWORD', 'password');
        $name = env('ADMIN_NAME', 'Administrator');

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
            ]
        );

        // Assign the role to the user under the selected organization
        if (!$user->hasRole($role->name)) {
            $user->assignRole($role);
        }

        // Ensure membership record in our own pivot table as 'admin'
        \DB::table('user_organizations')->updateOrInsert(
            ['user_id' => $user->id, 'organization_id' => $org->id],
            ['role' => 'admin', 'updated_at' => now(), 'created_at' => now()]
        );
    }
}
