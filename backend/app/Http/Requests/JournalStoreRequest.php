<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class JournalStoreRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    public function rules(): array
    {
        return [
            'entry_date' => 'required|date',
            'reference' => 'nullable|string',
            'currency' => 'nullable|string|size:3',
            'exchange_rate' => 'nullable|numeric|min:0',
            'source' => 'nullable|string',
            'description' => 'nullable|string',
            'lines' => 'required|array|min:2',
            'lines.*.account_id' => 'required|exists:accounts,id',
            'lines.*.debit' => 'nullable|numeric|min:0',
            'lines.*.credit' => 'nullable|numeric|min:0',
            'lines.*.description' => 'nullable|string',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $data = $this->validated() ?: $this->all();
            $lines = collect($data['lines'] ?? []);
            if ($lines->isEmpty()) {
                return;
            }
            $totalDebit = round($lines->sum(fn($l) => (float)($l['debit'] ?? 0)), 2);
            $totalCredit = round($lines->sum(fn($l) => (float)($l['credit'] ?? 0)), 2);
            if ($totalDebit !== $totalCredit) {
                $v->errors()->add('lines', 'Debits and credits must balance');
            }
        });
    }
}

