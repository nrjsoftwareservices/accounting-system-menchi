<?php

namespace App\Http\Controllers;

use App\Models\ArInvoice;
use Illuminate\Http\Request;
use App\Http\Requests\ArInvoiceStoreRequest;
use App\Http\Requests\ArInvoiceUpdateRequest;
use App\Http\Requests\ArInvoicePostRequest;

class ArInvoiceController extends Controller
{
    public function __construct(private \App\Repositories\ArInvoiceRepository $repo) {}

    public function index(Request $request)
    {
        $org = $request->attributes->get('organization');
        $sort = in_array($request->query('sort'), ['invoice_no','invoice_date','total','status']) ? $request->query('sort') : 'invoice_date';
        $dir = strtolower($request->query('dir')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        $filters = $request->only(['status','customer_id','date_from','date_to','q']);
        return response()->json($this->repo->paginate($org->id, $perPage, $sort, $dir, $filters));
    }

    public function store(ArInvoiceStoreRequest $request)
    {
        $org = $request->attributes->get('organization');
        return response()->json($this->repo->createDraft($org->id, $request->validated()), 201);
    }

    public function update(ArInvoiceUpdateRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $inv = ArInvoice::with('lines')->where('organization_id',$org->id)->findOrFail($id);
        if ($inv->status !== 'draft') return response()->json(['message' => 'Only draft invoices can be updated'], 422);
        return response()->json($this->repo->updateDraft($inv, $request->validated()));
    }

    public function destroy(Request $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $inv = ArInvoice::where('organization_id',$org->id)->findOrFail($id);
        if ($inv->status !== 'draft') return response()->json(['message' => 'Only draft invoices can be deleted'], 422);
        $inv->delete();
        return response()->json(['deleted' => true]);
    }

    public function post(ArInvoicePostRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $inv = ArInvoice::with('lines')->where('organization_id', $org->id)->findOrFail($id);
        if ($inv->status !== 'draft') return response()->json(['message' => 'Only draft invoices can be posted'], 422);
        return response()->json($this->repo->post($inv, $org->id, $request->validated()['ar_account_id']));
    }
}
