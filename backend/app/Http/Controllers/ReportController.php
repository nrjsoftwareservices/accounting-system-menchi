<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\JournalLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function contacts(Request $request)
    {
        $org = $request->attributes->get('organization');
        $customers = [];
        $suppliers = [];
        \DB::table('journal_entries')
            ->where('organization_id', $org->id)
            ->where('is_posted', true)
            ->orderByDesc('entry_date')
            ->select('meta')
            ->chunk(1000, function ($chunk) use (&$customers, &$suppliers) {
                foreach ($chunk as $row) {
                    $meta = json_decode($row->meta ?? 'null', true) ?: [];
                    $r = $meta['row'] ?? [];
                    $client = trim((string)($r['client'] ?? ''));
                    $supplier = trim((string)($r['supplier'] ?? ''));
                    if ($client !== '') $customers[$client] = true;
                    if ($supplier !== '') $suppliers[$supplier] = true;
                }
            });
        return response()->json([
            'customers' => array_values(array_keys($customers)),
            'suppliers' => array_values(array_keys($suppliers)),
        ]);
    }
    public function __construct(private \App\Repositories\ReportRepository $repo) {}

    public function trialBalance(Request $request)
    {
        $org = $request->attributes->get('organization');
        $validated = $request->validate([
            'as_of' => 'nullable|date',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:200',
            'sort' => 'nullable|string',
            'dir' => 'nullable|string',
        ]);
        $asOf = $validated['as_of'] ?? now()->toDateString();
        $orgId = $org?->id ?? $request->integer('organization_id');
        $page = max(1, (int)($validated['page'] ?? 1));
        $perPage = max(1, min(200, (int)($validated['per_page'] ?? 50)));
        $sort = in_array($request->query('sort'), ['code','name','debit','credit']) ? $request->query('sort') : 'code';
        $dir = strtolower($request->query('dir')) === 'desc' ? 'desc' : 'asc';

        $data = $this->repo->trialBalance($orgId, $asOf, $page, $perPage, $sort, $dir);

        return response()->json([
            'as_of' => $asOf,
        ] + $data);
    }
}
