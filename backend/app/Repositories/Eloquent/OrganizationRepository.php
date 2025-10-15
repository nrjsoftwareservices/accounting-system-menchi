<?php

namespace App\Repositories\Eloquent;

use App\Models\Organization;
use App\Models\User;

class OrganizationRepository
{
    public function paginateForUser(?User $user, int $perPage, string $sort, string $dir)
    {
        if ($user) {
            return $user->belongsToMany(Organization::class, 'user_organizations')
                ->withPivot('role')
                ->orderBy($sort, $dir)
                ->paginate($perPage);
        }
        return Organization::query()->orderBy($sort, $dir)->paginate($perPage);
    }

    public function create(array $data, ?User $creator = null): Organization
    {
        $org = Organization::create($data);
        if ($creator) {
            $org->users()->attach($creator->id, ['role' => 'admin']);
        }
        return $org;
    }

    public function update(Organization $org, array $data): Organization
    {
        $org->update($data);
        return $org;
    }

    public function delete(Organization $org): void
    {
        $org->delete();
    }

    public function isAdmin(User $user, Organization $org): bool
    {
        return \DB::table('user_organizations')
            ->where('user_id', $user->id)
            ->where('organization_id', $org->id)
            ->where('role', 'admin')
            ->exists();
    }

    public function userHasAnyOrg(User $user): bool
    {
        return \DB::table('user_organizations')->where('user_id', $user->id)->exists();
    }

    public function userIsAdminAnywhere(User $user): bool
    {
        return \DB::table('user_organizations')->where('user_id', $user->id)->where('role', 'admin')->exists();
    }
}
