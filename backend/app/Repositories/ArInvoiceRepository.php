<?php

namespace App\Repositories;

use App\Models\ArInvoice;
use App\Models\ArInvoiceLine;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Support\Facades\DB;

class ArInvoiceRepository
{
    public function paginate(int $orgId, int $perPage, string $sort, string $dir, array $filters = [])
    {
        $q = ArInvoice::with('customer')->where('organization_id', $orgId);
        if (!empty($filters['status'])) $q->where('status',$filters['status']);
        if (!empty($filters['customer_id'])) $q->where('customer_id',$filters['customer_id']);
        if (!empty($filters['date_from'])) $q->whereDate('invoice_date','>=',$filters['date_from']);
        if (!empty($filters['date_to'])) $q->whereDate('invoice_date','<=',$filters['date_to']);
        if (!empty($filters['q'])) $q->where('invoice_no','like','%'.$filters['q'].'%');
        return $q->orderBy($sort, $dir)->paginate($perPage);
    }

    public function createDraft(int $orgId, array $data): ArInvoice
    {
        return DB::transaction(function () use ($orgId, $data) {
            $inv = ArInvoice::create([
                'organization_id' => $orgId,
                'customer_id' => $data['customer_id'],
                'invoice_no' => $data['invoice_no'],
                'invoice_date' => $data['invoice_date'],
                'due_date' => $data['due_date'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'exchange_rate' => $data['exchange_rate'] ?? 1,
                'status' => 'draft',
            ]);
            $subtotal = 0;
            foreach ($data['lines'] as $i => $line) {
                $amount = round(($line['qty'] ?? 1) * ($line['unit_price'] ?? 0), 2);
                $subtotal += $amount;
                ArInvoiceLine::create([
                    'ar_invoice_id' => $inv->id,
                    'account_id' => $line['account_id'],
                    'description' => $line['description'],
                    'qty' => $line['qty'] ?? 1,
                    'unit_price' => $line['unit_price'] ?? 0,
                    'amount' => $amount,
                    'line_no' => $i + 1,
                ]);
            }
            $inv->update(['subtotal' => $subtotal, 'total' => $subtotal]);
            return $inv->load('lines');
        });
    }

    public function updateDraft(ArInvoice $inv, array $data): ArInvoice
    {
        return DB::transaction(function () use ($inv, $data) {
            $inv->update([
                'customer_id' => $data['customer_id'],
                'invoice_no' => $data['invoice_no'],
                'invoice_date' => $data['invoice_date'],
                'due_date' => $data['due_date'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'exchange_rate' => $data['exchange_rate'] ?? 1,
            ]);
            $inv->lines()->delete();
            $subtotal = 0;
            foreach ($data['lines'] as $i => $line) {
                $amount = round(($line['qty'] ?? 1) * ($line['unit_price'] ?? 0), 2);
                $subtotal += $amount;
                ArInvoiceLine::create([
                    'ar_invoice_id' => $inv->id,
                    'account_id' => $line['account_id'],
                    'description' => $line['description'],
                    'qty' => $line['qty'] ?? 1,
                    'unit_price' => $line['unit_price'] ?? 0,
                    'amount' => $amount,
                    'line_no' => $i + 1,
                ]);
            }
            $inv->update(['subtotal' => $subtotal, 'total' => $subtotal]);
            return $inv->load('lines');
        });
    }

    public function post(ArInvoice $inv, int $orgId, int $arAccountId): ArInvoice
    {
        if ($inv->status !== 'draft') return $inv;
        return DB::transaction(function () use ($inv, $orgId, $arAccountId) {
            $entry = JournalEntry::create([
                'organization_id' => $orgId,
                'entry_date' => $inv->invoice_date,
                'reference' => 'INV '.$inv->invoice_no,
                'currency' => $inv->currency,
                'exchange_rate' => $inv->exchange_rate,
                'source' => 'sales',
                'description' => 'Post AR Invoice',
                'is_posted' => true,
            ]);
            JournalLine::create([
                'journal_entry_id' => $entry->id,
                'organization_id' => $orgId,
                'account_id' => $arAccountId,
                'debit' => $inv->total,
                'credit' => 0,
                'description' => 'AR for Invoice',
                'line_no' => 1,
            ]);
            $i = 2;
            foreach ($inv->lines as $line) {
                JournalLine::create([
                    'journal_entry_id' => $entry->id,
                    'organization_id' => $orgId,
                    'account_id' => $line->account_id,
                    'debit' => 0,
                    'credit' => $line->amount,
                    'description' => $line->description,
                    'line_no' => $i++,
                ]);
            }
            $inv->update(['status' => 'posted']);
            return $inv;
        });
    }
}

