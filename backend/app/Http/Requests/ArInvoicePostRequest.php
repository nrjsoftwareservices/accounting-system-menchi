<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ArInvoicePostRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }
    public function rules(): array
    {
        return [
            'ar_account_id' => 'required|exists:accounts,id',
        ];
    }
}

