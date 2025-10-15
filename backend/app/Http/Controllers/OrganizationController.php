<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class OrganizationController extends Controller
{
    private \App\Repositories\Eloquent\OrganizationRepository $repo;

    public function __construct(\App\Repositories\Eloquent\OrganizationRepository $repo)
    {
        $this->repo = $repo;
    }
    public function index(Request $request)
    {
        $user = $request->user();
        $sort = in_array($request->query('sort'), ['id','name','code']) ? $request->query('sort') : 'id';
        $dir = strtolower($request->query('dir')) === 'desc' ? 'desc' : 'asc';
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        return response()->json($this->repo->paginateForUser($user, $perPage, $sort, $dir));
    }

    public function store(\App\Http\Requests\OrganizationStoreRequest $request)
    {
        $data = $request->validated();
        // Authorization: allow if user has admin role in at least one org, or if user has no orgs at all
        $user = $request->user();
        if ($user) {
            if ($this->repo->userHasAnyOrg($user) && !$this->repo->userIsAdminAnywhere($user)) {
                return response()->json(['message' => 'Admin role required in at least one organization to create a new organization'], 403);
            }
        }

        $org = $this->repo->create([
            'uuid' => (string) Str::uuid(),
            'name' => $data['name'],
            'code' => $data['code'],
            'default_currency' => $data['default_currency'] ?? 'USD',
        ], $user);
        return response()->json($org, 201);
    }

    public function update(\App\Http\Requests\OrganizationUpdateRequest $request, int $id)
    {
        $data = $request->validated();
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);
        $org = Organization::findOrFail($id);
        $isAdmin = $this->repo->isAdmin($user, $org);
        if (!$isAdmin) return response()->json(['message' => 'Admin role required for this organization'], 403);
        $payload = [
            'name' => $data['name'],
            'code' => $data['code'],
            'default_currency' => $data['default_currency'] ?? $org->default_currency,
        ];
        if ($request->has('settings') && is_array($request->input('settings'))) {
            $existing = $org->settings ?? [];
            $payload['settings'] = array_replace_recursive($existing, $request->input('settings'));
        }
        return response()->json($this->repo->update($org, $payload));
    }

    public function destroy(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);
        $org = Organization::findOrFail($id);
        $isAdmin = $this->repo->isAdmin($user, $org);
        if (!$isAdmin) return response()->json(['message' => 'Admin role required for this organization'], 403);
        $this->repo->delete($org);
        return response()->json(['deleted' => true]);
    }

    public function membersIndex(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message'=>'Unauthorized'],401);
        $org = Organization::findOrFail($id);
        $isAdmin = \DB::table('user_organizations')->where('user_id',$user->id)->where('organization_id',$org->id)->where('role','admin')->exists();
        if (!$isAdmin) return response()->json(['message'=>'Admin role required for this organization'],403);
        $members = $org->users()->withPivot('role')->get();
        return response()->json($members);
    }

    public function membersStore(Request $request, int $id)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'role' => 'required|string|in:admin,accountant,manager,clerk,auditor'
        ]);
        $user = $request->user();
        if (!$user) return response()->json(['message'=>'Unauthorized'],401);
        $org = Organization::findOrFail($id);
        $isAdmin = \DB::table('user_organizations')->where('user_id',$user->id)->where('organization_id',$org->id)->where('role','admin')->exists();
        if (!$isAdmin) return response()->json(['message'=>'Admin role required for this organization'],403);
        $invitee = User::where('email',$data['email'])->first();
        if (!$invitee) {
            $invitee = User::create([
                'name' => strstr($data['email'], '@', true) ?: $data['email'],
                'email' => $data['email'],
                'password' => Hash::make(Str::random(16)),
            ]);
        }
        $org->users()->syncWithoutDetaching([$invitee->id => ['role' => $data['role']]]);
        return response()->json(['added' => true, 'user' => $invitee]);
    }

    public function membersUpdate(Request $request, int $id, int $userId)
    {
        $data = $request->validate([
            'role' => 'required|string|in:admin,accountant,manager,clerk,auditor'
        ]);
        $user = $request->user();
        if (!$user) return response()->json(['message'=>'Unauthorized'],401);
        $org = Organization::findOrFail($id);
        $isAdmin = \DB::table('user_organizations')->where('user_id',$user->id)->where('organization_id',$org->id)->where('role','admin')->exists();
        if (!$isAdmin) return response()->json(['message'=>'Admin role required for this organization'],403);
        $org->users()->updateExistingPivot($userId, ['role' => $data['role']]);
        return response()->json(['updated'=>true]);
    }

    public function membersDestroy(Request $request, int $id, int $userId)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message'=>'Unauthorized'],401);
        $org = Organization::findOrFail($id);
        $isAdmin = \DB::table('user_organizations')->where('user_id',$user->id)->where('organization_id',$org->id)->where('role','admin')->exists();
        if (!$isAdmin) return response()->json(['message'=>'Admin role required for this organization'],403);
        $org->users()->detach($userId);
        return response()->json(['deleted'=>true]);
    }
}
