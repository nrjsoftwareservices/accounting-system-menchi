<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaxController extends Controller
{
    private function zeros12(): array { return array_fill(0, 12, 0.0); }

    private function sanitize12Numeric(?array $arr, float $default = 0.0): array
    {
        $out = $this->zeros12();
        if (!is_array($arr)) return $out;
        for ($i = 0; $i < 12; $i++) {
            $out[$i] = isset($arr[$i]) && is_numeric($arr[$i]) ? round((float)$arr[$i], 2) : $default;
        }
        return $out;
    }

    private function monthlyGross(\App\Models\Organization $org, int $year): array
    {
        $base = $this->zeros12();
        // Prefer explicit mappings from organization settings (safely cast to array first)
        $settings = (array) ($org->settings ?? []);
        $imports = (array) ($settings['imports'] ?? []);
        $salesMap = (array) ($imports['sales'] ?? []);
        $codes = array_values(array_filter([
            (string)($salesMap['vat_payable_account_code'] ?? ''),
            (string)($salesMap['sales_goods_account_code'] ?? ''),
            (string)($salesMap['sales_services_account_code'] ?? ''),
            (string)($salesMap['sales_exempt_account_code'] ?? ''),
        ], fn($v) => $v !== ''));

        $q = DB::table('journal_lines as jl')
            ->join('journal_entries as je', 'je.id', '=', 'jl.journal_entry_id')
            ->join('accounts as a', 'a.id', '=', 'jl.account_id')
            ->where('jl.organization_id', $org->id)
            ->where('je.is_posted', true);

        // Cross-DB month extraction and year filter
        $driver = DB::connection()->getDriverName();
        if ($driver === 'sqlite') {
            $monthExpr = "CAST(STRFTIME('%m', je.entry_date) AS INTEGER)";
            $q->whereRaw("CAST(STRFTIME('%Y', je.entry_date) AS INTEGER) = ?", [$year]);
            $sumExpr = 'SUM(jl.credit - jl.debit)';
        } elseif ($driver === 'pgsql') {
            $monthExpr = 'EXTRACT(MONTH FROM je.entry_date)';
            $q->whereYear('je.entry_date', $year);
            $sumExpr = 'SUM(jl.credit - jl.debit)';
        } else { // mysql/sqlsrv
            $monthExpr = 'MONTH(je.entry_date)';
            $q->whereYear('je.entry_date', $year);
            $sumExpr = 'SUM(jl.credit - jl.debit)';
        }

        if (!empty($codes)) {
            $q->whereIn('a.code', $codes);
        } else {
            // Fallback: use revenue accounts
            $q->where('a.type', 'revenue');
        }

        // Net credits (credits - debits) per month to account for returns
        $rows = $q->selectRaw("$monthExpr as m, $sumExpr as gross")
            ->groupBy(DB::raw($monthExpr))
            ->get();

        foreach ($rows as $r) {
            $idx = max(1, min(12, (int)$r->m)) - 1;
            $base[$idx] = round((float)($r->gross ?? 0), 2);
        }
        return $base;
    }

    public function getPercentage(Request $request)
    {
        $org = $request->attributes->get('organization');
        $year = (int)($request->integer('year') ?: (int) now()->format('Y'));
        if ($year < 1900 || $year > 2100) $year = (int) now()->format('Y');

        $gross = $this->monthlyGross($org, $year);

        $settings = (array) ($org->settings ?? []);
        $node = (array)($settings['tax']['percentage'][$year] ?? []);

        $rate = $this->sanitize12Numeric($node['ratePct'] ?? array_fill(0,12,3), 3.0);
        $credit2307 = $this->sanitize12Numeric($node['credit2307'] ?? []);
        $prevQtrPaid = $this->sanitize12Numeric($node['prevQtrPaid'] ?? []);

        return response()->json([
            'year' => $year,
            'gross' => $gross,
            'ratePct' => $rate,
            'credit2307' => $credit2307,
            'prevQtrPaid' => $prevQtrPaid,
        ]);
    }

    public function savePercentage(Request $request)
    {
        $org = $request->attributes->get('organization');
        $validated = $request->validate([
            'year' => 'required|integer|min:1900|max:2100',
            'ratePct' => 'required|array|size:12',
            'ratePct.*' => 'numeric|min:0|max:100',
            'credit2307' => 'required|array|size:12',
            'credit2307.*' => 'numeric',
            'prevQtrPaid' => 'required|array|size:12',
            'prevQtrPaid.*' => 'numeric',
        ]);

        $year = (int)$validated['year'];
        $settings = (array) ($org->settings ?? []);
        $settings['tax'] = (array) ($settings['tax'] ?? []);
        $settings['tax']['percentage'] = (array) ($settings['tax']['percentage'] ?? []);
        $settings['tax']['percentage'][$year] = [
            'ratePct' => $this->sanitize12Numeric($validated['ratePct'] ?? array_fill(0,12,3), 3.0),
            'credit2307' => $this->sanitize12Numeric($validated['credit2307'] ?? []),
            'prevQtrPaid' => $this->sanitize12Numeric($validated['prevQtrPaid'] ?? []),
        ];

        $org->settings = $settings;
        $org->save();

        return response()->json(['saved' => true, 'year' => $year]);
    }
}
