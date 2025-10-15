<?php

namespace App\Http\Controllers;

use App\Models\Account;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Http\Requests\AccountStoreRequest;
use App\Http\Requests\AccountUpdateRequest;

class AccountController extends Controller
{
    private \App\Repositories\Eloquent\AccountRepository $repo;

    public function __construct(\App\Repositories\Eloquent\AccountRepository $repo)
    {
        $this->repo = $repo;
    }
    public function index(Request $request)
    {
        $org = $request->attributes->get('organization');
        $perPage = (int) $request->query('per_page');
        $sort = $request->query('sort', 'code');
        $dir = strtolower($request->query('dir')) === 'desc' ? 'desc' : 'asc';
        if ($perPage > 0) {
            $perPage = max(1, min(100, $perPage));
            return response()->json($this->repo->paginate($org->id, $perPage, $sort, $dir));
        }
        return response()->json($this->repo->all($org->id));
    }

    public function store(AccountStoreRequest $request)
    {
        $org = $request->attributes->get('organization');
        $data = $request->validated();
        $orgId = $org?->id ?? $request->integer('organization_id');
        // unique code within org
        $request->validate([
            'code' => [Rule::unique('accounts','code')->where('organization_id', $orgId)],
        ]);
        if (!empty($data['parent_id'])) {
            $parent = Account::find($data['parent_id']);
            if (!$parent || $parent->organization_id !== $orgId) {
                return response()->json(['message' => 'Invalid parent account'], 422);
            }
            if (!$this->isTypeCompatible($parent->type, $data['type'])) {
                return response()->json(['message' => 'Account type not compatible with parent type'], 422);
            }
        }
        $account = Account::create([
            'organization_id' => $orgId,
            'code' => $data['code'],
            'name' => $data['name'],
            'type' => $data['type'],
            'parent_id' => $data['parent_id'] ?? null,
            'level' => $data['level'] ?? 1,
        ]);
        return response()->json($account, 201);
    }

    public function destroy(Request $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $acc = Account::where('organization_id', $org->id)->findOrFail($id);
        if ($this->repo->hasChildren($acc)) {
            return response()->json(['message' => 'Cannot delete: account has child accounts'], 422);
        }
        if ($this->repo->isReferenced($acc)) {
            return response()->json(['message' => 'Cannot delete: account is referenced by transactions'], 422);
        }
        $this->repo->delete($acc);
        return response()->json(['deleted' => true]);
    }

    public function update(AccountUpdateRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $acc = Account::where('organization_id', $org->id)->findOrFail($id);
        $data = $request->validated();
        // unique code within org (ignore current)
        $request->validate([
            'code' => [Rule::unique('accounts','code')->where('organization_id', $org->id)->ignore($acc->id)],
        ]);
        if (!empty($data['parent_id'])) {
            if ((int)$data['parent_id'] === (int)$acc->id) {
                return response()->json(['message' => 'Account cannot be its own parent'], 422);
            }
            $parent = Account::find($data['parent_id']);
            if (!$parent || $parent->organization_id !== $org->id) {
                return response()->json(['message' => 'Invalid parent account'], 422);
            }
            if (!$this->isTypeCompatible($parent->type, $data['type'])) {
                return response()->json(['message' => 'Account type not compatible with parent type'], 422);
            }
        }
        $acc->update([
            'code' => $data['code'],
            'name' => $data['name'],
            'type' => $data['type'],
            'parent_id' => $data['parent_id'] ?? null,
            'level' => $data['level'] ?? 1,
        ]);
        return response()->json($acc);
    }

    private function isTypeCompatible(string $parentType, string $childType): bool
    {
        $map = [
            'asset' => ['asset','contra_asset'],
            'liability' => ['liability','contra_liability'],
            'equity' => ['equity','contra_equity'],
            'revenue' => ['revenue'],
            'expense' => ['expense'],
            'contra_asset' => ['contra_asset'],
            'contra_liability' => ['contra_liability'],
            'contra_equity' => ['contra_equity'],
            'other' => ['other'],
        ];
        return in_array($childType, $map[$parentType] ?? [$parentType], true);
    }

    public function checkCode(Request $request)
    {
        $org = $request->attributes->get('organization');
        $code = (string) $request->query('code', '');
        $excludeId = (int) $request->query('exclude_id', 0);
        if ($code === '') {
            return response()->json(['exists' => false]);
        }
        $exists = !$this->repo->isCodeUnique($org->id, $code, $excludeId ?: null);
        return response()->json(['exists' => $exists]);
    }
}
