<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\ArInvoice;
use App\Models\ApBill;
use App\Models\Customer;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    private function streamCsv(string $filename, \Closure $writer): StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ];

        return response()->stream(function () use ($writer) {
            $out = fopen('php://output', 'w');
            // BOM for Excel UTF-8
            fwrite($out, "\xEF\xBB\xBF");
            $writer($out);
            fclose($out);
        }, 200, $headers);
    }

    public function accounts(Request $request)
    {
        $org = $request->attributes->get('organization');
        $sort = in_array($request->query('sort'), ['code','name','type']) ? $request->query('sort') : 'code';
        $dir = strtolower($request->query('dir')) === 'desc' ? 'desc' : 'asc';

        return $this->streamCsv('accounts.csv', function ($out) use ($org, $sort, $dir) {
            fputcsv($out, ['Code','Name','Type','Parent Code']);
            Account::with('parent')
                ->where('organization_id', $org->id)
                ->orderBy($sort, $dir)
                ->chunkById(1000, function ($chunk) use ($out) {
                    foreach ($chunk as $a) {
                        $parentCode = optional($a->parent)->code;
                        fputcsv($out, [$a->code, $a->name, $a->type, $parentCode]);
                    }
                    flush();
                });
        });
    }

    public function customers(Request $request)
    {
        $org = $request->attributes->get('organization');
        $q = Customer::where('organization_id', $org->id);
        if ($s = $request->string('search')->toString()) {
            $q->where(function($w) use ($s){
                $w->where('name','like',"%$s%")
                  ->orWhere('code','like',"%$s%")
                  ->orWhere('email','like',"%$s%");
            });
        }
        $sort = in_array($request->query('sort'), ['name','code','email']) ? $request->query('sort') : 'name';
        $dir = strtolower($request->query('dir')) === 'desc' ? 'desc' : 'asc';
        return $this->streamCsv('customers.csv', function ($out) use ($q, $sort, $dir) {
            fputcsv($out, ['Code','Name','Email','Phone']);
            $q->orderBy($sort, $dir)->chunkById(1000, function ($chunk) use ($out) {
                foreach ($chunk as $c) {
                    fputcsv($out, [$c->code, $c->name, $c->email, $c->phone]);
                }
                flush();
            });
        });
    }

    public function suppliers(Request $request)
    {
        // Deprecated in favor of contactsSuppliers from journal meta
        return $this->contactsSuppliers($request);
    }

    public function arInvoices(Request $request)
    {
        $org = $request->attributes->get('organization');
        $q = ArInvoice::with('customer')->where('organization_id', $org->id);
        if ($status = $request->string('status')->toString()) $q->where('status',$status);
        if ($cid = $request->integer('customer_id')) $q->where('customer_id',$cid);
        if ($from = $request->string('date_from')->toString()) $q->whereDate('invoice_date','>=',$from);
        if ($to = $request->string('date_to')->toString()) $q->whereDate('invoice_date','<=',$to);
        if ($qstr = $request->string('q')->toString()) $q->where('invoice_no','like',"%$qstr%");
        $sort = in_array($request->query('sort'), ['invoice_no','invoice_date','total','status']) ? $request->query('sort') : 'invoice_date';
        $dir = strtolower($request->query('dir')) === 'asc' ? 'asc' : 'desc';
        return $this->streamCsv('ar_invoices.csv', function ($out) use ($q, $sort, $dir) {
            fputcsv($out, ['No','Customer','Date','Total','Status']);
            $q->orderBy($sort, $dir)->chunkById(1000, function ($chunk) use ($out) {
                foreach ($chunk as $r) {
                    fputcsv($out, [$r->invoice_no, optional($r->customer)->name, $r->invoice_date, number_format((float)$r->total, 2, '.', ''), $r->status]);
                }
                flush();
            });
        });
    }

    public function apBills(Request $request)
    {
        $org = $request->attributes->get('organization');
        $q = ApBill::with('supplier')->where('organization_id', $org->id);
        if ($status = $request->string('status')->toString()) $q->where('status',$status);
        if ($sid = $request->integer('supplier_id')) $q->where('supplier_id',$sid);
        if ($from = $request->string('date_from')->toString()) $q->whereDate('bill_date','>=',$from);
        if ($to = $request->string('date_to')->toString()) $q->whereDate('bill_date','<=',$to);
        if ($qstr = $request->string('q')->toString()) $q->where('bill_no','like',"%$qstr%");
        $sort = in_array($request->query('sort'), ['bill_no','bill_date','total','status']) ? $request->query('sort') : 'bill_date';
        $dir = strtolower($request->query('dir')) === 'asc' ? 'asc' : 'desc';
        return $this->streamCsv('ap_bills.csv', function ($out) use ($q, $sort, $dir) {
            fputcsv($out, ['No','Supplier','Date','Total','Status']);
            $q->orderBy($sort, $dir)->chunkById(1000, function ($chunk) use ($out) {
                foreach ($chunk as $r) {
                    fputcsv($out, [$r->bill_no, optional($r->supplier)->name, $r->bill_date, number_format((float)$r->total, 2, '.', ''), $r->status]);
                }
                flush();
            });
        });
    }

    public function trialBalance(Request $request)
    {
        $org = $request->attributes->get('organization');
        $asOf = $request->query('as_of', now()->toDateString());
        return $this->streamCsv('trial_balance.csv', function ($out) use ($org, $asOf) {
            fputcsv($out, ['Code','Name','Debit','Credit']);
            $rows = DB::table('journal_lines as jl')
                ->join('accounts as a', 'a.id', '=', 'jl.account_id')
                ->select('a.code','a.name',
                    DB::raw('ROUND(SUM(jl.debit),2) as total_debit'),
                    DB::raw('ROUND(SUM(jl.credit),2) as total_credit'))
                ->where('jl.organization_id', $org->id)
                ->whereExists(function ($q) use ($asOf) {
                    $q->from('journal_entries as je')
                        ->whereColumn('je.id','jl.journal_entry_id')
                        ->whereDate('je.entry_date','<=',$asOf)
                        ->where('je.is_posted', true);
                })
                ->groupBy('a.code','a.name')
                ->orderBy('a.code')
                ->cursor();
            foreach ($rows as $r) {
                $balance = (float)$r->total_debit - (float)$r->total_credit;
                $debit = max($balance, 0);
                $credit = max(-$balance, 0);
                fputcsv($out, [$r->code, $r->name, number_format($debit, 2, '.', ''), number_format($credit, 2, '.', '')]);
            }
            flush();
        });
    }

    public function journals(Request $request)
    {
        $org = $request->attributes->get('organization');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $accountCode = $request->query('account_code');
        $q = DB::table('journal_lines as jl')
            ->join('journal_entries as je', 'je.id', '=', 'jl.journal_entry_id')
            ->join('accounts as a', 'a.id', '=', 'jl.account_id')
            ->where('jl.organization_id', $org->id)
            ->where('je.is_posted', true);
        if ($from) $q->whereDate('je.entry_date', '>=', $from);
        if ($to) $q->whereDate('je.entry_date', '<=', $to);
        if ($accountCode) $q->where('a.code', $accountCode);
        $q->select('je.entry_date','je.reference','a.code as account_code','a.name as account_name','jl.debit','jl.credit','jl.description')
            ->orderBy('je.entry_date')->orderBy('je.id')->orderBy('jl.line_no');

        return $this->streamCsv('journals.csv', function ($out) use ($q) {
            fputcsv($out, ['Date','Reference','Account Code','Account Name','Debit','Credit','Description']);
            $q->chunk(2000, function ($chunk) use ($out) {
                foreach ($chunk as $r) {
                    fputcsv($out, [$r->entry_date, $r->reference, $r->account_code, $r->account_name, number_format((float)$r->debit,2,'.',''), number_format((float)$r->credit,2,'.',''), $r->description]);
                }
                flush();
            });
        });
    }

    public function contactsCustomers(Request $request)
    {
        $org = $request->attributes->get('organization');
        return $this->streamCsv('customers.csv', function ($out) use ($org) {
            fputcsv($out, ['Name']);
            $set = [];
            \DB::table('journal_entries')->where('organization_id',$org->id)->where('is_posted',true)
                ->select('meta')->chunk(1000, function ($chunk) use (&$set) {
                    foreach ($chunk as $r) {
                        $meta = json_decode($r->meta ?? 'null', true) ?: [];
                        $name = trim((string)($meta['row']['client'] ?? ''));
                        if ($name !== '') $set[$name] = true;
                    }
                });
            foreach (array_keys($set) as $name) { fputcsv($out, [$name]); }
        });
    }

    public function contactsSuppliers(Request $request)
    {
        $org = $request->attributes->get('organization');
        return $this->streamCsv('suppliers.csv', function ($out) use ($org) {
            fputcsv($out, ['Name']);
            $set = [];
            \DB::table('journal_entries')->where('organization_id',$org->id)->where('is_posted',true)
                ->select('meta')->chunk(1000, function ($chunk) use (&$set) {
                    foreach ($chunk as $r) {
                        $meta = json_decode($r->meta ?? 'null', true) ?: [];
                        $name = trim((string)($meta['row']['supplier'] ?? ''));
                        if ($name !== '') $set[$name] = true;
                    }
                });
            foreach (array_keys($set) as $name) { fputcsv($out, [$name]); }
        });
    }

    public function arLedger(Request $request)
    {
        $org = $request->attributes->get('organization');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $customerId = (int) $request->query('customer_id');
        $q = ArInvoice::with('customer')
            ->where('organization_id', $org->id)
            ->where('status','posted');
        if ($from) $q->whereDate('invoice_date','>=',$from);
        if ($to) $q->whereDate('invoice_date','<=',$to);
        if ($customerId) $q->where('customer_id',$customerId);
        $q->orderBy('customer_id')->orderBy('invoice_date')->orderBy('id');
        $balances = [];
        return $this->streamCsv('ar_ledger.csv', function ($out) use ($q, &$balances) {
            fputcsv($out, ['Customer','Date','Doc No','Type','Debit','Credit','Balance']);
            $q->chunk(1000, function ($chunk) use ($out, &$balances) {
                foreach ($chunk as $r) {
                    $key = $r->customer_id;
                    $debit = (float)$r->total; $credit = 0.0;
                    $balances[$key] = ($balances[$key] ?? 0) + $debit - $credit;
                    fputcsv($out, [optional($r->customer)->name, $r->invoice_date, $r->invoice_no, 'Invoice', number_format($debit,2,'.',''), number_format($credit,2,'.',''), number_format($balances[$key],2,'.','')]);
                }
                flush();
            });
        });
    }

    public function apLedger(Request $request)
    {
        $org = $request->attributes->get('organization');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $supplierId = (int) $request->query('supplier_id');
        $q = ApBill::with('supplier')
            ->where('organization_id', $org->id)
            ->where('status','posted');
        if ($from) $q->whereDate('bill_date','>=',$from);
        if ($to) $q->whereDate('bill_date','<=',$to);
        if ($supplierId) $q->where('supplier_id',$supplierId);
        $q->orderBy('supplier_id')->orderBy('bill_date')->orderBy('id');
        $balances = [];
        return $this->streamCsv('ap_ledger.csv', function ($out) use ($q, &$balances) {
            fputcsv($out, ['Supplier','Date','Doc No','Type','Debit','Credit','Balance']);
            $q->chunk(1000, function ($chunk) use ($out, &$balances) {
                foreach ($chunk as $r) {
                    $key = $r->supplier_id;
                    $debit = 0.0; $credit = (float)$r->total; // AP: credits increase balance
                    $balances[$key] = ($balances[$key] ?? 0) - $debit + $credit;
                    fputcsv($out, [optional($r->supplier)->name, $r->bill_date, $r->bill_no, 'Bill', number_format($debit,2,'.',''), number_format($credit,2,'.',''), number_format($balances[$key],2,'.','')]);
                }
                flush();
            });
        });
    }
}
