<?php

namespace App\Repositories;

use App\Models\ApBill;
use App\Models\ApBillLine;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Support\Facades\DB;

class ApBillRepository
{
    public function paginate(int $orgId, int $perPage, string $sort, string $dir, array $filters = [])
    {
        $q = ApBill::with('supplier')->where('organization_id', $orgId);
        if (!empty($filters['status'])) $q->where('status',$filters['status']);
        if (!empty($filters['supplier_id'])) $q->where('supplier_id',$filters['supplier_id']);
        if (!empty($filters['date_from'])) $q->whereDate('bill_date','>=',$filters['date_from']);
        if (!empty($filters['date_to'])) $q->whereDate('bill_date','<=',$filters['date_to']);
        if (!empty($filters['q'])) $q->where('bill_no','like','%'.$filters['q'].'%');
        return $q->orderBy($sort, $dir)->paginate($perPage);
    }

    public function createDraft(int $orgId, array $data): ApBill
    {
        return DB::transaction(function () use ($orgId, $data) {
            $bill = ApBill::create([
                'organization_id' => $orgId,
                'supplier_id' => $data['supplier_id'],
                'bill_no' => $data['bill_no'],
                'bill_date' => $data['bill_date'],
                'due_date' => $data['due_date'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'exchange_rate' => $data['exchange_rate'] ?? 1,
                'status' => 'draft',
            ]);
            $subtotal = 0;
            foreach ($data['lines'] as $i => $line) {
                $amount = round(($line['qty'] ?? 1) * ($line['unit_price'] ?? 0), 2);
                $subtotal += $amount;
                ApBillLine::create([
                    'ap_bill_id' => $bill->id,
                    'account_id' => $line['account_id'],
                    'description' => $line['description'],
                    'qty' => $line['qty'] ?? 1,
                    'unit_price' => $line['unit_price'] ?? 0,
                    'amount' => $amount,
                    'line_no' => $i + 1,
                ]);
            }
            $bill->update(['subtotal' => $subtotal, 'total' => $subtotal]);
            return $bill->load('lines');
        });
    }

    public function updateDraft(ApBill $bill, array $data): ApBill
    {
        return DB::transaction(function () use ($bill, $data) {
            $bill->update([
                'supplier_id' => $data['supplier_id'],
                'bill_no' => $data['bill_no'],
                'bill_date' => $data['bill_date'],
                'due_date' => $data['due_date'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'exchange_rate' => $data['exchange_rate'] ?? 1,
            ]);
            $bill->lines()->delete();
            $subtotal = 0;
            foreach ($data['lines'] as $i => $line) {
                $amount = round(($line['qty'] ?? 1) * ($line['unit_price'] ?? 0), 2);
                $subtotal += $amount;
                ApBillLine::create([
                    'ap_bill_id' => $bill->id,
                    'account_id' => $line['account_id'],
                    'description' => $line['description'],
                    'qty' => $line['qty'] ?? 1,
                    'unit_price' => $line['unit_price'] ?? 0,
                    'amount' => $amount,
                    'line_no' => $i + 1,
                ]);
            }
            $bill->update(['subtotal' => $subtotal, 'total' => $subtotal]);
            return $bill->load('lines');
        });
    }

    public function post(ApBill $bill, int $orgId, int $apAccountId): ApBill
    {
        if ($bill->status !== 'draft') return $bill;
        return DB::transaction(function () use ($bill, $orgId, $apAccountId) {
            $entry = JournalEntry::create([
                'organization_id' => $orgId,
                'entry_date' => $bill->bill_date,
                'reference' => 'BILL '.$bill->bill_no,
                'currency' => $bill->currency,
                'exchange_rate' => $bill->exchange_rate,
                'source' => 'purchase',
                'description' => 'Post AP Bill',
                'is_posted' => true,
            ]);
            JournalLine::create([
                'journal_entry_id' => $entry->id,
                'organization_id' => $orgId,
                'account_id' => $apAccountId,
                'debit' => 0,
                'credit' => $bill->total,
                'description' => 'AP for Bill',
                'line_no' => 1,
            ]);
            $i = 2;
            foreach ($bill->lines as $line) {
                JournalLine::create([
                    'journal_entry_id' => $entry->id,
                    'organization_id' => $orgId,
                    'account_id' => $line->account_id,
                    'debit' => $line->amount,
                    'credit' => 0,
                    'description' => $line->description,
                    'line_no' => $i++,
                ]);
            }
            $bill->update(['status' => 'posted']);
            return $bill;
        });
    }
}

