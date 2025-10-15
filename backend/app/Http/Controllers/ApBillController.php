<?php

namespace App\Http\Controllers;

use App\Models\ApBill;
use Illuminate\Http\Request;
use App\Http\Requests\ApBillStoreRequest;
use App\Http\Requests\ApBillUpdateRequest;
use App\Http\Requests\ApBillPostRequest;

class ApBillController extends Controller
{
    public function __construct(private \App\Repositories\ApBillRepository $repo) {}

    public function index(Request $request)
    {
        $org = $request->attributes->get('organization');
        $sort = in_array($request->query('sort'), ['bill_no','bill_date','total','status']) ? $request->query('sort') : 'bill_date';
        $dir = strtolower($request->query('dir')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        $filters = $request->only(['status','supplier_id','date_from','date_to','q']);
        return response()->json($this->repo->paginate($org->id, $perPage, $sort, $dir, $filters));
    }

    public function store(ApBillStoreRequest $request)
    {
        $org = $request->attributes->get('organization');
        $bill = $this->repo->createDraft($org->id, $request->validated());
        return response()->json($bill, 201);
    }

    public function update(ApBillUpdateRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $bill = ApBill::with('lines')->where('organization_id',$org->id)->findOrFail($id);
        if ($bill->status !== 'draft') {
            return response()->json(['message' => 'Only draft bills can be updated'], 422);
        }
        $bill = $this->repo->updateDraft($bill, $request->validated());
        return response()->json($bill);
    }

    public function destroy(Request $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $bill = ApBill::where('organization_id',$org->id)->findOrFail($id);
        if ($bill->status !== 'draft') {
            return response()->json(['message' => 'Only draft bills can be deleted'], 422);
        }
        $bill->delete();
        return response()->json(['deleted' => true]);
    }

    public function post(ApBillPostRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $bill = ApBill::with('lines')->where('organization_id', $org->id)->findOrFail($id);
        if ($bill->status !== 'draft') {
            return response()->json(['message' => 'Only draft bills can be posted'], 422);
        }
        $bill = $this->repo->post($bill, $org->id, $request->validated()['ap_account_id']);
        return response()->json($bill);
    }
}
