<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    private \App\Repositories\SupplierRepository $repo;

    public function __construct(\App\Repositories\SupplierRepository $repo)
    {
        $this->repo = $repo;
    }
    public function index(Request $request)
    {
        $org = $request->attributes->get('organization');
        $sort = in_array($request->query('sort'), ['name','code','email']) ? $request->query('sort') : 'name';
        $dir = strtolower($request->query('dir')) === 'desc' ? 'desc' : 'asc';
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        $search = $request->string('search')->toString() ?: null;
        return response()->json($this->repo->paginate($org->id, $perPage, $sort, $dir, $search));
    }

    public function store(\App\Http\Requests\SupplierStoreRequest $request)
    {
        $org = $request->attributes->get('organization');
        $data = $request->validated();
        $sup = $this->repo->create($org->id, $data);
        return response()->json($sup, 201);
    }

    public function update(\App\Http\Requests\SupplierUpdateRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $sup = Supplier::where('organization_id', $org->id)->findOrFail($id);
        $data = $request->validated();
        return response()->json($this->repo->update($sup, $data));
    }

    public function destroy(Request $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $sup = Supplier::where('organization_id', $org->id)->findOrFail($id);
        if ($this->repo->isReferenced($org->id, $sup->id)) {
            return response()->json(['message' => 'Cannot delete: supplier is referenced by bills'], 422);
        }
        $this->repo->delete($sup);
        return response()->json(['deleted' => true]);
    }
}
