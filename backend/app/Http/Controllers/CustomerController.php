<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    private \App\Repositories\CustomerRepository $repo;

    public function __construct(\App\Repositories\CustomerRepository $repo)
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

    public function store(\App\Http\Requests\CustomerStoreRequest $request)
    {
        $org = $request->attributes->get('organization');
        $data = $request->validated();
        $cust = $this->repo->create($org->id, $data);
        return response()->json($cust, 201);
    }

    public function update(\App\Http\Requests\CustomerUpdateRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $cust = Customer::where('organization_id', $org->id)->findOrFail($id);
        $data = $request->validated();
        return response()->json($this->repo->update($cust, $data));
    }

    public function destroy(Request $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $cust = Customer::where('organization_id', $org->id)->findOrFail($id);
        if ($this->repo->isReferenced($org->id, $cust->id)) {
            return response()->json(['message' => 'Cannot delete: customer is referenced by invoices'], 422);
        }
        $this->repo->delete($cust);
        return response()->json(['deleted' => true]);
    }
}
