<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApBillStoreRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }
    public function rules(): array
    {
        return [
            'supplier_id' => 'required|exists:suppliers,id',
            'bill_no' => 'required|string',
            'bill_date' => 'required|date',
            'due_date' => 'nullable|date',
            'currency' => 'nullable|string|size:3',
            'exchange_rate' => 'nullable|numeric|min:0',
            'lines' => 'required|array|min:1',
            'lines.*.account_id' => 'required|exists:accounts,id',
            'lines.*.description' => 'required|string',
            'lines.*.qty' => 'nullable|numeric|min:0',
            'lines.*.unit_price' => 'nullable|numeric|min:0',
        ];
    }
}

