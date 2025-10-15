<?php

namespace App\Repositories;

use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Support\Facades\DB;

class JournalRepository
{
    public function paginate(int $orgId, int $perPage)
    {
        return JournalEntry::with('lines')->where('organization_id', $orgId)->orderByDesc('entry_date')->paginate($perPage);
    }

    public function createPosted(int $orgId, array $data): JournalEntry
    {
        return DB::transaction(function () use ($orgId, $data) {
            $entry = JournalEntry::create([
                'organization_id' => $orgId,
                'entry_date' => $data['entry_date'],
                'reference' => $data['reference'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'exchange_rate' => $data['exchange_rate'] ?? 1,
                'source' => $data['source'] ?? 'manual',
                'description' => $data['description'] ?? null,
                'is_posted' => true,
            ]);
            foreach ($data['lines'] as $i => $line) {
                JournalLine::create([
                    'journal_entry_id' => $entry->id,
                    'organization_id' => $orgId,
                    'account_id' => $line['account_id'],
                    'debit' => (float)($line['debit'] ?? 0),
                    'credit' => (float)($line['credit'] ?? 0),
                    'description' => $line['description'] ?? null,
                    'line_no' => $i + 1,
                ]);
            }
            return $entry->load('lines');
        });
    }
}

