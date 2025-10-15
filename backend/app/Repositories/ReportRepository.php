<?php

namespace App\Repositories;

use Illuminate\Support\Facades\DB;

class ReportRepository
{
    public function trialBalance(int $orgId, string $asOf, int $page, int $perPage, string $sort, string $dir)
    {
        $agg = DB::table('journal_lines as jl')
            ->join('journal_entries as je', 'je.id', '=', 'jl.journal_entry_id')
            ->where('jl.organization_id', $orgId)
            ->whereDate('je.entry_date', '<=', $asOf)
            ->where('je.is_posted', true)
            ->groupBy('jl.account_id')
            ->select('jl.account_id', DB::raw('SUM(jl.debit) as total_debit'), DB::raw('SUM(jl.credit) as total_credit'));

        $base = DB::table('accounts as a')
            ->joinSub($agg, 'agg', 'agg.account_id', '=', 'a.id')
            ->select('a.id','a.code','a.name','a.type','agg.total_debit','agg.total_credit');

        $totalsQ = DB::query()->fromSub($base, 't')
            ->selectRaw("ROUND(SUM(CASE WHEN (total_debit - total_credit) > 0 THEN (total_debit - total_credit) ELSE 0 END),2) as total_debit")
            ->selectRaw("ROUND(SUM(CASE WHEN (total_credit - total_debit) > 0 THEN (total_credit - total_debit) ELSE 0 END),2) as total_credit");
        $totals = (array) $totalsQ->first();
        $count = DB::query()->fromSub($base, 't')->count();

        if ($sort === 'debit' || $sort === 'credit') {
            $base = DB::query()->fromSub($base, 't');
            $base->select('*',
                DB::raw("CASE WHEN (total_debit - total_credit) > 0 THEN (total_debit - total_credit) ELSE 0 END as debit"),
                DB::raw("CASE WHEN (total_credit - total_debit) > 0 THEN (total_credit - total_debit) ELSE 0 END as credit")
            );
            $query = $base->orderBy($sort, $dir);
        } else {
            $query = $base->orderBy($sort === 'name' ? 'a.name' : 'a.code', $dir);
            $query = DB::query()->fromSub($query, 't')
                ->select('*',
                    DB::raw("CASE WHEN (total_debit - total_credit) > 0 THEN (total_debit - total_credit) ELSE 0 END as debit"),
                    DB::raw("CASE WHEN (total_credit - total_debit) > 0 THEN (total_credit - total_debit) ELSE 0 END as credit")
                );
        }
        $rows = $query->offset(($page-1)*$perPage)->limit($perPage)->get()->map(function ($r) {
            return [
                'account_id' => $r->id,
                'code' => $r->code,
                'name' => $r->name,
                'type' => $r->type,
                'debit' => round((float)$r->debit,2),
                'credit' => round((float)$r->credit,2),
            ];
        });

        return [
            'rows' => $rows,
            'totals' => $totals,
            'current_page' => $page,
            'per_page' => $perPage,
            'last_page' => (int) ceil($count / $perPage),
            'total' => $count,
        ];
    }
}

